# Teams Extractor MCP Server

This MCP (Model Context Protocol) server exposes Teams messages from the processor database to Claude Desktop.

## Features

- **Resources**: Access recent Teams messages as browsable resources
- **Tools**: Query, search, and analyze Teams messages directly from Claude Desktop

## Available Tools

### 1. `get_recent_messages`
Get the most recent Teams messages with optional filtering.

**Parameters:**
- `limit` (optional): Maximum number of messages to return (default 10, max 100)
- `channel` (optional): Filter by Teams channel name
- `status` (optional): Filter by processing status (received, processed, agent_error, failed)

### 2. `search_messages`
Search Teams messages by text content.

**Parameters:**
- `query` (required): Search query to match in message text
- `limit` (optional): Maximum number of results (default 20, max 100)

### 3. `get_message_by_id`
Get a specific message by its database ID.

**Parameters:**
- `id` (required): The database ID of the message

### 4. `get_statistics`
Get statistics about processed Teams messages including:
- Total message count
- Messages by status
- Messages by channel
- Messages by classification type

### 5. `get_jira_payload`
Get the generated Jira payload for a specific message.

**Parameters:**
- `id` (required): The database ID of the message

## Installation

1. Install dependencies:
```bash
cd mcp-server
pip install -r requirements.txt
```

2. Configure Claude Desktop (see parent README for configuration details)

3. Run the server:
```bash
python server.py
```

## Database Schema

The server reads from the SQLite database at `../data/teams_messages.db` with the following schema:

- `id`: Unique message identifier
- `message_id`: Teams message ID
- `channel`: Teams channel name
- `author`: Message author
- `timestamp`: Message timestamp
- `classification_json`: Message classification (type, keyword)
- `resolution_text`: Full message text
- `quoted_request_json`: Original quoted request
- `permalink`: Teams message URL
- `status`: Processing status
- `jira_payload_json`: Generated Jira payload
- `error`: Error message (if any)
- `created_at`: Record creation timestamp
- `updated_at`: Last update timestamp

## Usage with Claude Desktop

Once configured, you can ask Claude to:

- "Show me the recent Teams messages"
- "Search for messages about ng-ui"
- "Get statistics on processed messages"
- "Show me the Jira payload for message ID 5"

Claude will automatically use the appropriate MCP tools to query the database and provide the information.
