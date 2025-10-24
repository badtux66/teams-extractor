"""Core Teams message extraction engine."""

import asyncio
import logging
import re
from datetime import datetime
from typing import List, Optional

from .graph_client import GraphAPIClient, GraphAPIError
from .models import (
    ExtractionConfig,
    ExtractionResult,
    TeamsChannel,
    TeamsMessage,
    ChannelType,
)

logger = logging.getLogger(__name__)


class TeamsExtractor:
    """
    Core extraction engine for Teams messages.

    Handles:
    - Team and channel discovery
    - Message extraction with pagination
    - Filtering (time, content, user, channel)
    - Thread extraction
    - Rate limiting and error handling
    """

    def __init__(self, graph_client: GraphAPIClient):
        """
        Initialize extractor.

        Args:
            graph_client: Authenticated Graph API client
        """
        self.graph_client = graph_client
        self.logger = logger

    async def extract_messages(
        self,
        config: ExtractionConfig,
        progress_callback: Optional[callable] = None,
    ) -> ExtractionResult:
        """
        Extract messages based on configuration.

        Args:
            config: Extraction configuration
            progress_callback: Optional callback(current, total, message) for progress updates

        Returns:
            ExtractionResult with extracted messages and metadata
        """
        start_time = datetime.now()
        all_messages: List[TeamsMessage] = []
        errors: List[str] = []

        try:
            # 1. Discover teams and channels
            self.logger.info("Discovering teams and channels...")
            channels_to_scan = await self._discover_channels(config)

            self.logger.info(f"Found {len(channels_to_scan)} channels to scan")

            # 2. Extract messages from each channel
            total_channels = len(channels_to_scan)
            for idx, channel in enumerate(channels_to_scan, 1):
                try:
                    if progress_callback:
                        progress_callback(idx, total_channels, f"Scanning {channel.display_name}")

                    self.logger.info(
                        f"[{idx}/{total_channels}] Extracting from {channel.display_name} "
                        f"(Team: {channel.team_id})"
                    )

                    channel_messages = await self._extract_channel_messages(
                        channel=channel,
                        config=config,
                    )

                    # Apply filters
                    filtered_messages = self._apply_filters(channel_messages, config)

                    all_messages.extend(filtered_messages)

                    self.logger.info(
                        f"  Extracted {len(filtered_messages)} messages "
                        f"(filtered from {len(channel_messages)})"
                    )

                    # Check if we've reached max messages
                    if config.max_messages and len(all_messages) >= config.max_messages:
                        all_messages = all_messages[:config.max_messages]
                        self.logger.info(f"Reached max_messages limit ({config.max_messages})")
                        break

                except Exception as exc:
                    error_msg = f"Error extracting from channel {channel.display_name}: {exc}"
                    self.logger.error(error_msg)
                    errors.append(error_msg)
                    continue

        except Exception as exc:
            error_msg = f"Fatal error during extraction: {exc}"
            self.logger.error(error_msg)
            errors.append(error_msg)

        end_time = datetime.now()

        result = ExtractionResult(
            messages=all_messages,
            total_extracted=len(all_messages),
            start_time=start_time,
            end_time=end_time,
            config=config,
            errors=errors,
        )

        self.logger.info(
            f"Extraction complete: {result.total_extracted} messages in "
            f"{result.get_duration_seconds():.1f}s"
        )
        self.logger.info(f"Statistics: {result.get_statistics()}")

        return result

    async def _discover_channels(self, config: ExtractionConfig) -> List[TeamsChannel]:
        """
        Discover channels to scan based on configuration.

        Args:
            config: Extraction configuration

        Returns:
            List of channels to scan
        """
        channels_to_scan = []

        # Get all teams
        teams = await self.graph_client.get_teams()

        for team in teams:
            team_id = team["id"]
            team_name = team.get("displayName", "Unknown")

            # Filter by team_ids if specified
            if config.team_ids and team_id not in config.team_ids:
                continue

            try:
                # Get channels for this team
                channel_data = await self.graph_client.get_team_channels(team_id)

                for ch in channel_data:
                    channel = TeamsChannel.from_dict(ch, team_id)

                    # Apply channel filters
                    if config.channel_ids and channel.id not in config.channel_ids:
                        continue

                    if config.channel_names and channel.display_name not in config.channel_names:
                        continue

                    channels_to_scan.append(channel)

            except GraphAPIError as exc:
                self.logger.warning(f"Could not access channels for team {team_name}: {exc}")
                continue

        return channels_to_scan

    async def _extract_channel_messages(
        self,
        channel: TeamsChannel,
        config: ExtractionConfig,
    ) -> List[TeamsMessage]:
        """
        Extract messages from a single channel.

        Args:
            channel: Channel to extract from
            config: Extraction configuration

        Returns:
            List of messages from the channel
        """
        messages = []

        try:
            # Get channel messages
            raw_messages = await self.graph_client.get_channel_messages(
                team_id=channel.team_id,
                channel_id=channel.id,
                top=config.batch_size,
            )

            for msg_data in raw_messages:
                try:
                    # Parse message
                    message = TeamsMessage.from_dict(
                        data=msg_data,
                        team_id=channel.team_id,
                        channel_id=channel.id,
                        team_name=None,  # Could fetch if needed
                        channel_name=channel.display_name,
                    )

                    messages.append(message)

                    # Get replies if enabled
                    if config.include_replies:
                        replies_data = msg_data.get("replies", [])

                        # If replies not expanded, fetch them
                        if not replies_data and msg_data.get("replyToId") is None:
                            try:
                                replies_data = await self.graph_client.get_message_replies(
                                    team_id=channel.team_id,
                                    channel_id=channel.id,
                                    message_id=message.id,
                                )
                            except Exception as exc:
                                self.logger.debug(f"Could not fetch replies for message {message.id}: {exc}")

                        # Parse replies
                        for reply_data in replies_data:
                            reply = TeamsMessage.from_dict(
                                data=reply_data,
                                team_id=channel.team_id,
                                channel_id=channel.id,
                                team_name=None,
                                channel_name=channel.display_name,
                            )
                            messages.append(reply)

                except Exception as exc:
                    self.logger.warning(f"Error parsing message: {exc}")
                    continue

        except GraphAPIError as exc:
            self.logger.error(f"Error fetching messages from channel {channel.display_name}: {exc}")
            raise

        return messages

    def _apply_filters(
        self,
        messages: List[TeamsMessage],
        config: ExtractionConfig,
    ) -> List[TeamsMessage]:
        """
        Apply all configured filters to messages.

        Args:
            messages: Messages to filter
            config: Extraction configuration

        Returns:
            Filtered messages
        """
        filtered = messages

        # Time filters
        if config.start_date:
            filtered = [m for m in filtered if m.created_at >= config.start_date]

        if config.end_date:
            filtered = [m for m in filtered if m.created_at <= config.end_date]

        # Message type filters
        if not config.include_system_messages:
            from .models import MessageType
            filtered = [m for m in filtered if m.message_type != MessageType.SYSTEM]

        if not config.include_deleted:
            filtered = [m for m in filtered if m.deleted_at is None]

        # User filters
        if config.author_ids:
            filtered = [m for m in filtered if m.author_id in config.author_ids]

        if config.author_names:
            filtered = [m for m in filtered if m.author_name in config.author_names]

        if config.author_emails:
            filtered = [
                m for m in filtered
                if m.author_email and m.author_email in config.author_emails
            ]

        # Content filters - keywords (case-insensitive)
        if config.keywords:
            filtered = [
                m for m in filtered
                if any(
                    keyword.lower() in m.body_content.lower()
                    for keyword in config.keywords
                )
            ]

        # Content filters - regex patterns
        if config.regex_patterns:
            compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in config.regex_patterns]
            filtered = [
                m for m in filtered
                if any(pattern.search(m.body_content) for pattern in compiled_patterns)
            ]

        return filtered

    async def extract_incident_messages(
        self,
        start_time: datetime,
        end_time: datetime,
        keywords: Optional[List[str]] = None,
        team_ids: Optional[List[str]] = None,
        channel_names: Optional[List[str]] = None,
    ) -> ExtractionResult:
        """
        Convenience method for extracting incident-related messages.

        Args:
            start_time: Incident start time
            end_time: Incident end time
            keywords: Keywords to search for (default: common incident keywords)
            team_ids: Specific teams to search
            channel_names: Specific channels to search

        Returns:
            ExtractionResult with incident messages
        """
        if keywords is None:
            keywords = [
                "incident",
                "outage",
                "down",
                "error",
                "critical",
                "urgent",
                "emergency",
                "issue",
                "problem",
                "failure",
                "alert",
            ]

        config = ExtractionConfig(
            start_date=start_time,
            end_date=end_time,
            keywords=keywords,
            team_ids=team_ids or [],
            channel_names=channel_names or [],
            include_replies=True,
            include_system_messages=False,
        )

        return await self.extract_messages(config)

    async def extract_user_messages(
        self,
        user_email: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> ExtractionResult:
        """
        Extract all messages from a specific user.

        Args:
            user_email: User email address
            start_date: Optional start date
            end_date: Optional end date

        Returns:
            ExtractionResult with user's messages
        """
        config = ExtractionConfig(
            start_date=start_date,
            end_date=end_date,
            author_emails=[user_email],
            include_replies=True,
        )

        return await self.extract_messages(config)
