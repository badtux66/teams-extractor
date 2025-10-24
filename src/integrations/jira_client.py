"""Jira integration for creating and updating issues from Teams messages."""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

import httpx

from ..core.models import ExtractionResult, TeamsMessage, TeamsThread

logger = logging.getLogger(__name__)


class JiraError(Exception):
    """Raised when Jira operations fail."""


class JiraClient:
    """
    Client for Jira Cloud/Server integration.

    Features:
    - Create issues from Teams messages
    - Update existing issues
    - Add comments with message content
    - Link issues to Teams messages
    - Bulk operations
    """

    def __init__(
        self,
        jira_url: str,
        username: str,
        api_token: str,
        default_project: Optional[str] = None,
        default_issue_type: str = "Task",
    ):
        """
        Initialize Jira client.

        Args:
            jira_url: Jira instance URL (e.g., https://yourcompany.atlassian.net)
            username: Jira username/email
            api_token: Jira API token
            default_project: Default project key
            default_issue_type: Default issue type (Task, Bug, Story, etc.)
        """
        self.jira_url = jira_url.rstrip("/")
        self.username = username
        self.api_token = api_token
        self.default_project = default_project
        self.default_issue_type = default_issue_type

        self.http_client = httpx.AsyncClient(
            auth=(username, api_token),
            timeout=30.0,
        )

        logger.info(f"Initialized Jira client for {jira_url}")

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
        """Make authenticated request to Jira API."""
        url = f"{self.jira_url}/rest/api/3/{endpoint.lstrip('/')}"

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
            error_detail = ""
            try:
                error_data = exc.response.json()
                error_detail = error_data.get("errorMessages", [str(exc)])[0]
            except Exception:
                error_detail = str(exc)

            raise JiraError(f"Jira API error: {error_detail}") from exc
        except Exception as exc:
            raise JiraError(f"Jira request failed: {exc}") from exc

    async def create_issue(
        self,
        project: Optional[str] = None,
        summary: str = "",
        description: str = "",
        issue_type: Optional[str] = None,
        labels: Optional[List[str]] = None,
        priority: Optional[str] = None,
        assignee: Optional[str] = None,
        custom_fields: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a Jira issue.

        Args:
            project: Project key
            summary: Issue summary
            description: Issue description
            issue_type: Issue type (Task, Bug, Story, etc.)
            labels: Issue labels
            priority: Priority name
            assignee: Assignee account ID or email
            custom_fields: Custom field values

        Returns:
            Created issue data
        """
        project = project or self.default_project
        if not project:
            raise JiraError("Project key required")

        issue_type = issue_type or self.default_issue_type

        # Build issue payload
        fields = {
            "project": {"key": project},
            "summary": summary,
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": description,
                            }
                        ]
                    }
                ]
            },
            "issuetype": {"name": issue_type},
        }

        if labels:
            fields["labels"] = labels

        if priority:
            fields["priority"] = {"name": priority}

        if assignee:
            fields["assignee"] = {"accountId": assignee}

        if custom_fields:
            fields.update(custom_fields)

        payload = {"fields": fields}

        logger.info(f"Creating Jira issue in project {project}: {summary}")

        result = await self._request("POST", "issue", json_data=payload)
        logger.info(f"Created issue {result.get('key')}")

        return result

    async def add_comment(
        self,
        issue_key: str,
        comment: str,
    ) -> Dict[str, Any]:
        """
        Add a comment to a Jira issue.

        Args:
            issue_key: Issue key (e.g., PROJ-123)
            comment: Comment text

        Returns:
            Comment data
        """
        payload = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": comment,
                            }
                        ]
                    }
                ]
            }
        }

        logger.debug(f"Adding comment to {issue_key}")

        return await self._request("POST", f"issue/{issue_key}/comment", json_data=payload)

    async def update_issue(
        self,
        issue_key: str,
        fields: Dict[str, Any],
    ) -> None:
        """
        Update a Jira issue.

        Args:
            issue_key: Issue key (e.g., PROJ-123)
            fields: Fields to update
        """
        payload = {"fields": fields}

        logger.info(f"Updating issue {issue_key}")

        await self._request("PUT", f"issue/{issue_key}", json_data=payload)

    async def create_issue_from_message(
        self,
        message: TeamsMessage,
        project: Optional[str] = None,
        issue_type: Optional[str] = None,
        add_message_as_comment: bool = True,
    ) -> Dict[str, Any]:
        """
        Create a Jira issue from a Teams message.

        Args:
            message: Teams message
            project: Jira project key
            issue_type: Issue type
            add_message_as_comment: Add full message as comment

        Returns:
            Created issue data
        """
        # Build summary from subject or first line
        summary = message.subject or message.body_content.strip().split('\n')[0][:100]

        # Build description
        description = f"From Teams message by {message.author_name}\n"
        description += f"Channel: #{message.channel_name}\n"
        description += f"Date: {message.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        description += message.body_content[:1000]  # Limit description length

        # Labels
        labels = [message.channel_name.lower().replace(" ", "-")] if message.channel_name else []
        labels.append("teams-message")

        # Create issue
        issue = await self.create_issue(
            project=project,
            summary=summary,
            description=description,
            issue_type=issue_type,
            labels=labels,
        )

        # Add link to Teams message
        if message.web_url:
            await self.add_comment(
                issue_key=issue["key"],
                comment=f"Teams message link: {message.web_url}",
            )

        # Add full message as comment if requested
        if add_message_as_comment and len(message.body_content) > 1000:
            await self.add_comment(
                issue_key=issue["key"],
                comment=f"Full message:\n\n{message.body_content}",
            )

        return issue

    async def create_issue_from_thread(
        self,
        thread: TeamsThread,
        project: Optional[str] = None,
        issue_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a Jira issue from a Teams thread.

        Args:
            thread: Teams thread
            project: Jira project key
            issue_type: Issue type

        Returns:
            Created issue data
        """
        root = thread.root_message

        # Build summary
        summary = root.subject or root.body_content.strip().split('\n')[0][:100]

        # Build description with thread context
        description = f"Thread from Teams by {root.author_name}\n"
        description += f"Channel: #{root.channel_name}\n"
        description += f"Date: {root.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
        description += f"Replies: {len(thread.replies)}\n\n"
        description += f"Original message:\n{root.body_content[:500]}\n"

        labels = [root.channel_name.lower().replace(" ", "-")] if root.channel_name else []
        labels.append("teams-thread")

        # Create issue
        issue = await self.create_issue(
            project=project,
            summary=summary,
            description=description,
            issue_type=issue_type,
            labels=labels,
        )

        # Add root message link
        if root.web_url:
            await self.add_comment(
                issue_key=issue["key"],
                comment=f"Teams thread link: {root.web_url}",
            )

        # Add replies as comments
        for i, reply in enumerate(thread.replies[:10], 1):  # Limit to first 10 replies
            comment = f"Reply {i} by {reply.author_name} at {reply.created_at.strftime('%Y-%m-%d %H:%M:%S')}:\n\n"
            comment += reply.body_content[:500]

            await self.add_comment(issue_key=issue["key"], comment=comment)

        return issue

    async def create_incident_issue(
        self,
        result: ExtractionResult,
        project: Optional[str] = None,
        incident_title: str = "Incident from Teams Messages",
        incident_severity: str = "Medium",
    ) -> Dict[str, Any]:
        """
        Create an incident issue from extraction result.

        Args:
            result: Extraction result
            project: Jira project key
            incident_title: Incident title
            incident_severity: Incident severity

        Returns:
            Created issue data
        """
        stats = result.get_statistics()

        # Build description
        description = f"Incident Report\n\n"
        description += f"Period: {result.config.start_date} to {result.config.end_date}\n"
        description += f"Total Messages: {stats['total_messages']}\n"
        description += f"Participants: {stats['authors']}\n"
        description += f"Channels: {stats['channels']}\n\n"

        if result.config.keywords:
            description += f"Keywords: {', '.join(result.config.keywords)}\n\n"

        description += "Message Timeline:\n"

        # Add timeline of messages
        for msg in sorted(result.messages, key=lambda m: m.created_at)[:20]:
            timestamp = msg.created_at.strftime('%H:%M:%S')
            preview = msg.body_content.strip()[:80]
            description += f"- {timestamp} - {msg.author_name}: {preview}\n"

        # Create issue
        issue = await self.create_issue(
            project=project,
            summary=incident_title,
            description=description,
            issue_type="Incident",
            labels=["incident", "teams-extraction"],
            priority=incident_severity,
        )

        return issue

    async def bulk_create_issues_from_messages(
        self,
        messages: List[TeamsMessage],
        project: Optional[str] = None,
        issue_type: Optional[str] = None,
        max_concurrent: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Create multiple Jira issues from messages concurrently.

        Args:
            messages: List of messages
            project: Jira project key
            issue_type: Issue type
            max_concurrent: Maximum concurrent requests

        Returns:
            List of created issues
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def create_with_limit(msg: TeamsMessage) -> Optional[Dict[str, Any]]:
            async with semaphore:
                try:
                    return await self.create_issue_from_message(
                        message=msg,
                        project=project,
                        issue_type=issue_type,
                    )
                except Exception as exc:
                    logger.error(f"Failed to create issue for message {msg.id}: {exc}")
                    return None

        logger.info(f"Creating {len(messages)} Jira issues...")

        tasks = [create_with_limit(msg) for msg in messages]
        results = await asyncio.gather(*tasks)

        created_issues = [r for r in results if r is not None]

        logger.info(f"Created {len(created_issues)}/{len(messages)} issues")

        return created_issues
