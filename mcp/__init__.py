"""
Teams-to-Jira MCP Agent Package

This package provides MCP server implementations for transforming Teams
deployment messages into structured Jira issue payloads using AI.
"""

from mcp.agent import (
    AgentError,
    JiraPayload,
    TeamsJiraAgent,
    TeamsResolution,
)

__all__ = [
    "AgentError",
    "JiraPayload",
    "TeamsJiraAgent",
    "TeamsResolution",
]

__version__ = "1.0.0"
