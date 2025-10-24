"""Confluence integration for creating and updating documentation."""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

import httpx

from ..core.models import ExtractionResult
from ..exporters.markdown_exporter import MarkdownExporter

logger = logging.getLogger(__name__)


class ConfluenceError(Exception):
    """Raised when Confluence operations fail."""


class ConfluenceClient:
    """
    Client for Confluence Cloud/Server integration.

    Features:
    - Create pages from extraction results
    - Update existing pages
    - Add tables for incident tracking
    - Manage page hierarchies
    """

    def __init__(
        self,
        confluence_url: str,
        username: str,
        api_token: str,
        default_space: Optional[str] = None,
    ):
        """
        Initialize Confluence client.

        Args:
            confluence_url: Confluence instance URL
            username: Confluence username/email
            api_token: Confluence API token
            default_space: Default space key
        """
        self.confluence_url = confluence_url.rstrip("/")
        self.username = username
        self.api_token = api_token
        self.default_space = default_space

        self.http_client = httpx.AsyncClient(
            auth=(username, api_token),
            timeout=30.0,
        )

        logger.info(f"Initialized Confluence client for {confluence_url}")

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make authenticated request to Confluence API."""
        url = f"{self.confluence_url}/rest/api/{endpoint.lstrip('/')}"

        try:
            response = await self.http_client.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                headers={"Content-Type": "application/json"},
            )

            response.raise_for_status()
            return response.json() if response.content else {}

        except httpx.HTTPStatusError as exc:
            error_detail = str(exc)
            try:
                error_data = exc.response.json()
                error_detail = error_data.get("message", str(exc))
            except Exception:
                pass

            raise ConfluenceError(f"Confluence API error: {error_detail}") from exc
        except Exception as exc:
            raise ConfluenceError(f"Confluence request failed: {exc}") from exc

    async def create_page(
        self,
        space: Optional[str] = None,
        title: str = "",
        content: str = "",
        parent_id: Optional[str] = None,
        labels: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Create a Confluence page.

        Args:
            space: Space key
            title: Page title
            content: Page content (HTML or storage format)
            parent_id: Parent page ID
            labels: Page labels

        Returns:
            Created page data
        """
        space = space or self.default_space
        if not space:
            raise ConfluenceError("Space key required")

        payload = {
            "type": "page",
            "title": title,
            "space": {"key": space},
            "body": {
                "storage": {
                    "value": content,
                    "representation": "storage",
                }
            },
        }

        if parent_id:
            payload["ancestors"] = [{"id": parent_id}]

        logger.info(f"Creating Confluence page in space {space}: {title}")

        result = await self._request("POST", "content", json_data=payload)
        page_id = result.get("id")

        # Add labels if provided
        if labels and page_id:
            await self.add_labels(page_id, labels)

        logger.info(f"Created page {page_id}")

        return result

    async def update_page(
        self,
        page_id: str,
        title: str,
        content: str,
        version_number: int,
    ) -> Dict[str, Any]:
        """
        Update a Confluence page.

        Args:
            page_id: Page ID
            title: Updated title
            content: Updated content
            version_number: Current version number + 1

        Returns:
            Updated page data
        """
        payload = {
            "type": "page",
            "title": title,
            "body": {
                "storage": {
                    "value": content,
                    "representation": "storage",
                }
            },
            "version": {"number": version_number},
        }

        logger.info(f"Updating Confluence page {page_id} to version {version_number}")

        return await self._request("PUT", f"content/{page_id}", json_data=payload)

    async def get_page(self, page_id: str) -> Dict[str, Any]:
        """
        Get page details.

        Args:
            page_id: Page ID

        Returns:
            Page data
        """
        params = {"expand": "body.storage,version"}
        return await self._request("GET", f"content/{page_id}", params=params)

    async def add_labels(self, page_id: str, labels: List[str]) -> None:
        """
        Add labels to a page.

        Args:
            page_id: Page ID
            labels: List of label names
        """
        payload = [{"name": label} for label in labels]

        await self._request("POST", f"content/{page_id}/label", json_data=payload)

    async def create_page_from_extraction(
        self,
        result: ExtractionResult,
        space: Optional[str] = None,
        title: str = "Teams Message Export",
        parent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Confluence page from extraction result.

        Args:
            result: Extraction result
            space: Space key
            title: Page title
            parent_id: Parent page ID

        Returns:
            Created page data
        """
        stats = result.get_statistics()

        # Build HTML content
        html = "<h2>Extraction Summary</h2>"
        html += f"<p><strong>Extraction Date:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>"
        html += f"<p><strong>Total Messages:</strong> {stats['total_messages']}</p>"
        html += f"<p><strong>Duration:</strong> {stats['duration_seconds']:.1f} seconds</p>"

        # Statistics table
        html += "<h3>Statistics</h3>"
        html += "<table><tbody>"
        html += f"<tr><td><strong>Total Messages</strong></td><td>{stats['total_messages']}</td></tr>"
        html += f"<tr><td><strong>Threads</strong></td><td>{stats['total_threads']}</td></tr>"
        html += f"<tr><td><strong>Authors</strong></td><td>{stats['authors']}</td></tr>"
        html += f"<tr><td><strong>Channels</strong></td><td>{stats['channels']}</td></tr>"
        html += f"<tr><td><strong>With Attachments</strong></td><td>{stats['with_attachments']}</td></tr>"
        html += f"<tr><td><strong>With Reactions</strong></td><td>{stats['with_reactions']}</td></tr>"
        html += "</tbody></table>"

        # Messages
        html += "<h2>Messages</h2>"

        threads = result.get_threads()
        for i, thread in enumerate(threads[:50], 1):  # Limit to 50 threads
            root = thread.root_message

            html += f"<h3>Thread {i}: {root.subject or '(No Subject)'}</h3>"
            html += f"<p><strong>From:</strong> {root.author_name}<br/>"
            html += f"<strong>Date:</strong> {root.created_at.strftime('%Y-%m-%d %H:%M:%S')}<br/>"
            html += f"<strong>Channel:</strong> #{root.channel_name or 'Unknown'}</p>"
            html += f"<div style='background: #f4f5f7; padding: 10px; border-left: 3px solid #0052CC;'>"
            html += root.body_content[:500]
            html += "</div>"

            if thread.replies:
                html += f"<p><em>{len(thread.replies)} replies</em></p>"

        # Create page
        return await self.create_page(
            space=space,
            title=title,
            content=html,
            parent_id=parent_id,
            labels=["teams-extraction", "automated"],
        )

    async def update_incident_tracking_table(
        self,
        page_id: str,
        incident_data: Dict[str, Any],
    ) -> None:
        """
        Update an incident tracking table on a Confluence page.

        Args:
            page_id: Page ID
            incident_data: Incident data to add to table
        """
        # Get current page
        page = await self.get_page(page_id)
        current_content = page["body"]["storage"]["value"]
        current_version = page["version"]["number"]

        # Build new row for table
        new_row = "<tr>"
        new_row += f"<td>{incident_data.get('date', datetime.now().strftime('%Y-%m-%d'))}</td>"
        new_row += f"<td>{incident_data.get('title', 'Incident')}</td>"
        new_row += f"<td>{incident_data.get('severity', 'Medium')}</td>"
        new_row += f"<td>{incident_data.get('status', 'Open')}</td>"
        new_row += f"<td>{incident_data.get('messages', 0)}</td>"
        new_row += f"<td>{incident_data.get('channels', 0)}</td>"
        new_row += "</tr>"

        # Find the table and insert row
        # This is a simple implementation - in production you'd want more robust HTML parsing
        if "</tbody>" in current_content:
            updated_content = current_content.replace("</tbody>", f"{new_row}</tbody>")
        else:
            # Create table if it doesn't exist
            table_html = """
<h2>Incident Tracking</h2>
<table>
<thead>
<tr>
<th>Date</th>
<th>Title</th>
<th>Severity</th>
<th>Status</th>
<th>Messages</th>
<th>Channels</th>
</tr>
</thead>
<tbody>
{new_row}
</tbody>
</table>
"""
            updated_content = current_content + table_html.replace("{new_row}", new_row)

        # Update page
        await self.update_page(
            page_id=page_id,
            title=page["title"],
            content=updated_content,
            version_number=current_version + 1,
        )

        logger.info(f"Updated incident tracking table on page {page_id}")
