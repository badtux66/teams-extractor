#!/usr/bin/env python3
"""
MCP Server for Teams Message Extractor

This server exposes Teams messages from the processor database to Claude Desktop
via the Model Context Protocol (MCP).
"""

import json
import sqlite3
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Resource, TextContent, Tool

# Database path - can be overridden via environment variable
DB_PATH = Path("../data/teams_messages.db")

app = Server("teams-extractor")


def get_db_connection():
    """Get a connection to the Teams messages database."""
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def format_message(row: sqlite3.Row) -> dict[str, Any]:
    """Format a database row into a structured message."""
    return {
        "id": row["id"],
        "message_id": row["message_id"],
        "channel": row["channel"],
        "author": row["author"],
        "timestamp": row["timestamp"],
        "classification": json.loads(row["classification_json"]) if row["classification_json"] else None,
        "resolution_text": row["resolution_text"],
        "quoted_request": json.loads(row["quoted_request_json"]) if row["quoted_request_json"] else None,
        "permalink": row["permalink"],
        "status": row["status"],
        "jira_payload": json.loads(row["jira_payload_json"]) if row["jira_payload_json"] else None,
        "error": row["error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@app.list_resources()
async def list_resources() -> list[Resource]:
    """List available resources (recent messages)."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM messages ORDER BY created_at DESC LIMIT 10"
        )
        resources = []
        for row in cursor:
            msg = format_message(row)
            resources.append(
                Resource(
                    uri=f"teams://message/{msg['id']}",
                    name=f"Message {msg['id']} - {msg['author']}",
                    mimeType="application/json",
                    description=f"{msg['resolution_text'][:100]}...",
                )
            )
        return resources
    finally:
        conn.close()


@app.read_resource()
async def read_resource(uri: str) -> str:
    """Read a specific message resource."""
    if not uri.startswith("teams://message/"):
        raise ValueError(f"Invalid resource URI: {uri}")

    message_id = uri.split("/")[-1]
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Message {message_id} not found")

        msg = format_message(row)
        return json.dumps(msg, indent=2, ensure_ascii=False)
    finally:
        conn.close()


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="get_recent_messages",
            description="Get the most recent Teams messages with optional filtering",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "number",
                        "description": "Maximum number of messages to return (default 10, max 100)",
                        "default": 10,
                    },
                    "channel": {
                        "type": "string",
                        "description": "Filter by Teams channel name",
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by processing status (received, processed, agent_error, failed)",
                    },
                },
            },
        ),
        Tool(
            name="search_messages",
            description="Search Teams messages by text content",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query to match in message text",
                    },
                    "limit": {
                        "type": "number",
                        "description": "Maximum number of results (default 20, max 100)",
                        "default": 20,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_message_by_id",
            description="Get a specific message by its database ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {
                        "type": "number",
                        "description": "The database ID of the message",
                    },
                },
                "required": ["id"],
            },
        ),
        Tool(
            name="get_statistics",
            description="Get statistics about processed Teams messages",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="get_jira_payload",
            description="Get the generated Jira payload for a specific message",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {
                        "type": "number",
                        "description": "The database ID of the message",
                    },
                },
                "required": ["id"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls."""
    conn = get_db_connection()
    try:
        if name == "get_recent_messages":
            limit = min(int(arguments.get("limit", 10)), 100)
            channel = arguments.get("channel")
            status = arguments.get("status")

            query = "SELECT * FROM messages WHERE 1=1"
            params = []

            if channel:
                query += " AND channel = ?"
                params.append(channel)
            if status:
                query += " AND status = ?"
                params.append(status)

            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)

            cursor = conn.execute(query, params)
            messages = [format_message(row) for row in cursor]

            return [TextContent(
                type="text",
                text=json.dumps(messages, indent=2, ensure_ascii=False),
            )]

        elif name == "search_messages":
            query = arguments["query"]
            limit = min(int(arguments.get("limit", 20)), 100)

            cursor = conn.execute(
                """
                SELECT * FROM messages
                WHERE resolution_text LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (f"%{query}%", limit),
            )
            messages = [format_message(row) for row in cursor]

            return [TextContent(
                type="text",
                text=json.dumps(messages, indent=2, ensure_ascii=False),
            )]

        elif name == "get_message_by_id":
            message_id = arguments["id"]
            cursor = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,))
            row = cursor.fetchone()

            if not row:
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": f"Message {message_id} not found"}, indent=2),
                )]

            message = format_message(row)
            return [TextContent(
                type="text",
                text=json.dumps(message, indent=2, ensure_ascii=False),
            )]

        elif name == "get_statistics":
            stats = {}

            # Total messages
            cursor = conn.execute("SELECT COUNT(*) as count FROM messages")
            stats["total_messages"] = cursor.fetchone()["count"]

            # Messages by status
            cursor = conn.execute(
                "SELECT status, COUNT(*) as count FROM messages GROUP BY status"
            )
            stats["by_status"] = {row["status"]: row["count"] for row in cursor}

            # Messages by channel
            cursor = conn.execute(
                "SELECT channel, COUNT(*) as count FROM messages GROUP BY channel"
            )
            stats["by_channel"] = {row["channel"]: row["count"] for row in cursor}

            # Messages by classification type
            cursor = conn.execute(
                "SELECT classification_json FROM messages WHERE classification_json IS NOT NULL"
            )
            type_counts = {}
            for row in cursor:
                classification = json.loads(row["classification_json"])
                msg_type = classification.get("type", "unknown")
                type_counts[msg_type] = type_counts.get(msg_type, 0) + 1
            stats["by_classification"] = type_counts

            return [TextContent(
                type="text",
                text=json.dumps(stats, indent=2, ensure_ascii=False),
            )]

        elif name == "get_jira_payload":
            message_id = arguments["id"]
            cursor = conn.execute(
                "SELECT jira_payload_json FROM messages WHERE id = ?", (message_id,)
            )
            row = cursor.fetchone()

            if not row:
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": f"Message {message_id} not found"}, indent=2),
                )]

            if not row["jira_payload_json"]:
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": "No Jira payload available for this message"}, indent=2),
                )]

            jira_payload = json.loads(row["jira_payload_json"])
            return [TextContent(
                type="text",
                text=json.dumps(jira_payload, indent=2, ensure_ascii=False),
            )]

        else:
            raise ValueError(f"Unknown tool: {name}")

    finally:
        conn.close()


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
