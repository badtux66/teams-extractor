"""Integration modules for external services."""

from .jira_client import JiraClient
from .confluence_client import ConfluenceClient
from .email_client import EmailClient

__all__ = [
    "JiraClient",
    "ConfluenceClient",
    "EmailClient",
]
