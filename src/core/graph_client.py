"""Microsoft Graph API client for Teams message extraction."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
from msal import ConfidentialClientApplication, PublicClientApplication

logger = logging.getLogger(__name__)


class GraphAPIError(Exception):
    """Raised when Graph API operations fail."""


class GraphAPIClient:
    """
    Microsoft Graph API client with authentication and rate limiting.

    Supports both:
    - Service Principal (client credentials flow) - for automated/server scenarios
    - Delegated (device code flow) - for user-based scenarios
    """

    GRAPH_API_ENDPOINT = "https://graph.microsoft.com/v1.0"
    SCOPES = [
        "https://graph.microsoft.com/.default"  # For service principal
    ]
    DELEGATED_SCOPES = [
        "ChannelMessage.Read.All",
        "Channel.ReadBasic.All",
        "Team.ReadBasic.All",
        "User.Read",
    ]

    def __init__(
        self,
        tenant_id: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        use_delegated_auth: bool = False,
        rate_limit_pause: float = 0.5,
    ):
        """
        Initialize Graph API client.

        Args:
            tenant_id: Azure AD tenant ID
            client_id: Application (client) ID
            client_secret: Client secret (for service principal auth)
            use_delegated_auth: Use delegated auth (device code flow) instead of service principal
            rate_limit_pause: Pause between API calls to avoid rate limiting
        """
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.use_delegated_auth = use_delegated_auth
        self.rate_limit_pause = rate_limit_pause

        self.access_token: Optional[str] = None
        self.token_expires_at: float = 0
        self.http_client: Optional[httpx.AsyncClient] = None

        # Initialize MSAL application
        if use_delegated_auth:
            self.msal_app = PublicClientApplication(
                client_id=client_id,
                authority=f"https://login.microsoftonline.com/{tenant_id}",
            )
        else:
            if not client_secret:
                raise GraphAPIError("Client secret required for service principal authentication")
            self.msal_app = ConfidentialClientApplication(
                client_id=client_id,
                client_credential=client_secret,
                authority=f"https://login.microsoftonline.com/{tenant_id}",
            )

        # Rate limiting
        self.last_request_time = 0.0
        self.retry_after = 0
        self.request_count = 0

        logger.info(
            f"Initialized Graph API client (auth_type={'delegated' if use_delegated_auth else 'service_principal'})"
        )

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def connect(self):
        """Initialize HTTP client and authenticate."""
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(timeout=30.0)

        await self.authenticate()

    async def close(self):
        """Close HTTP client."""
        if self.http_client:
            await self.http_client.aclose()
            self.http_client = None

    async def authenticate(self):
        """Authenticate and obtain access token."""
        try:
            if self.use_delegated_auth:
                # Device code flow for delegated auth
                flow = self.msal_app.initiate_device_flow(scopes=self.DELEGATED_SCOPES)

                if "user_code" not in flow:
                    raise GraphAPIError(
                        f"Failed to create device flow: {flow.get('error_description')}"
                    )

                logger.info(f"To authenticate, visit: {flow['verification_uri']}")
                logger.info(f"And enter the code: {flow['user_code']}")

                # Wait for user to authenticate
                result = self.msal_app.acquire_token_by_device_flow(flow)
            else:
                # Service principal auth
                result = self.msal_app.acquire_token_for_client(scopes=self.SCOPES)

            if "access_token" in result:
                self.access_token = result["access_token"]
                # Set expiry time (with 5 minute buffer)
                self.token_expires_at = time.time() + result.get("expires_in", 3600) - 300
                logger.info("Successfully authenticated with Microsoft Graph API")
            else:
                error_desc = result.get("error_description", result.get("error"))
                raise GraphAPIError(f"Authentication failed: {error_desc}")

        except Exception as exc:
            raise GraphAPIError(f"Authentication error: {exc}") from exc

    async def ensure_authenticated(self):
        """Ensure we have a valid access token."""
        if not self.access_token or time.time() >= self.token_expires_at:
            await self.authenticate()

    async def _rate_limit_wait(self):
        """Wait if needed to respect rate limits."""
        # Wait for retry-after if set
        if self.retry_after > time.time():
            wait_time = self.retry_after - time.time()
            logger.warning(f"Rate limited, waiting {wait_time:.1f} seconds")
            await asyncio.sleep(wait_time)
            self.retry_after = 0

        # Normal rate limiting pause
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit_pause:
            await asyncio.sleep(self.rate_limit_pause - elapsed)

        self.last_request_time = time.time()

    async def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        max_retries: int = 4,
    ) -> Dict[str, Any]:
        """
        Make authenticated request to Graph API with retry logic.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (relative to Graph API base)
            params: Query parameters
            json_data: JSON body data
            max_retries: Maximum number of retries on failure

        Returns:
            Response data as dictionary
        """
        await self.ensure_authenticated()
        await self._rate_limit_wait()

        url = f"{self.GRAPH_API_ENDPOINT}/{endpoint.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        retry_count = 0
        backoff_seconds = 2

        while retry_count <= max_retries:
            try:
                response = await self.http_client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data,
                    headers=headers,
                )

                self.request_count += 1

                # Handle rate limiting (429)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    self.retry_after = time.time() + retry_after
                    logger.warning(f"Rate limited (429), will retry after {retry_after}s")
                    retry_count += 1
                    await asyncio.sleep(retry_after)
                    continue

                # Handle server errors (5xx) with exponential backoff
                if 500 <= response.status_code < 600:
                    if retry_count < max_retries:
                        logger.warning(
                            f"Server error {response.status_code}, retrying in {backoff_seconds}s"
                        )
                        await asyncio.sleep(backoff_seconds)
                        backoff_seconds *= 2
                        retry_count += 1
                        continue
                    else:
                        raise GraphAPIError(
                            f"Server error after {max_retries} retries: {response.status_code}"
                        )

                # Raise for other error status codes
                response.raise_for_status()

                # Return JSON response
                return response.json()

            except httpx.HTTPStatusError as exc:
                error_detail = ""
                try:
                    error_data = exc.response.json()
                    error_detail = error_data.get("error", {}).get("message", str(exc))
                except Exception:
                    error_detail = str(exc)

                raise GraphAPIError(
                    f"HTTP {exc.response.status_code} error: {error_detail}"
                ) from exc

            except Exception as exc:
                if retry_count < max_retries:
                    logger.warning(f"Request failed: {exc}, retrying in {backoff_seconds}s")
                    await asyncio.sleep(backoff_seconds)
                    backoff_seconds *= 2
                    retry_count += 1
                else:
                    raise GraphAPIError(f"Request failed after {max_retries} retries: {exc}") from exc

        raise GraphAPIError(f"Request failed after {max_retries} retries")

    async def get_paginated(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        max_pages: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all results from a paginated endpoint.

        Args:
            endpoint: API endpoint
            params: Query parameters
            max_pages: Maximum number of pages to fetch (None = all)

        Returns:
            List of all items from all pages
        """
        all_items = []
        page_count = 0
        next_link = None

        while True:
            if max_pages and page_count >= max_pages:
                break

            if next_link:
                # Use the @odata.nextLink for pagination
                response = await self.request("GET", next_link.replace(self.GRAPH_API_ENDPOINT + "/", ""))
            else:
                response = await self.request("GET", endpoint, params=params)

            items = response.get("value", [])
            all_items.extend(items)
            page_count += 1

            logger.debug(f"Fetched page {page_count}, got {len(items)} items (total: {len(all_items)})")

            # Check for next page
            next_link = response.get("@odata.nextLink")
            if not next_link:
                break

        logger.info(f"Fetched {len(all_items)} items across {page_count} pages")
        return all_items

    # Teams-specific methods

    async def get_teams(self) -> List[Dict[str, Any]]:
        """Get all teams the authenticated user/app has access to."""
        try:
            teams = await self.get_paginated("me/joinedTeams")
            logger.info(f"Found {len(teams)} teams")
            return teams
        except GraphAPIError:
            # Fallback for service principal - get all teams
            teams = await self.get_paginated("groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')")
            logger.info(f"Found {len(teams)} teams (via groups)")
            return teams

    async def get_team_channels(self, team_id: str) -> List[Dict[str, Any]]:
        """Get all channels for a team."""
        channels = await self.get_paginated(f"teams/{team_id}/channels")
        logger.info(f"Found {len(channels)} channels in team {team_id}")
        return channels

    async def get_channel_messages(
        self,
        team_id: str,
        channel_id: str,
        top: int = 50,
        max_pages: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Get messages from a channel."""
        endpoint = f"teams/{team_id}/channels/{channel_id}/messages"
        params = {"$top": top, "$expand": "replies"}

        messages = await self.get_paginated(endpoint, params=params, max_pages=max_pages)
        logger.info(f"Fetched {len(messages)} messages from channel {channel_id}")
        return messages

    async def get_message_replies(
        self,
        team_id: str,
        channel_id: str,
        message_id: str,
    ) -> List[Dict[str, Any]]:
        """Get replies to a specific message."""
        endpoint = f"teams/{team_id}/channels/{channel_id}/messages/{message_id}/replies"
        replies = await self.get_paginated(endpoint)
        logger.debug(f"Fetched {len(replies)} replies for message {message_id}")
        return replies

    def get_request_count(self) -> int:
        """Get total number of API requests made."""
        return self.request_count
