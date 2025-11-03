# Teams Extractor MCP Server for Claude Desktop

Model Context Protocol (MCP) server for querying Teams messages directly from Claude Desktop on your Mac.

> **Note:** This MCP server is designed to run **locally on your Mac**, not in Docker. The MCP protocol uses stdio (standard input/output) communication, which requires the server to run directly on your system where Claude Desktop can access it.

## 🚀 Features

- **6 Powerful Tools** for querying and analyzing Teams messages
- **Full-Text Search** using PostgreSQL's built-in search capabilities
- **Real-Time Data** - Queries live PostgreSQL database
- **Easy Setup** - Automated configuration script for Claude Desktop on Mac
- **Zero Configuration** - Uses stdio protocol, no ports or networking required
- **Local Installation** - Runs directly on your Mac, not in Docker

## 📋 Prerequisites

- **macOS** (for Claude Desktop on Mac)
- **Node.js 18+** installed (`brew install node`)
- **Claude Desktop** application installed on your Mac
- **PostgreSQL database** with Teams messages running (can be local or remote)
- Database credentials/connection URL

## 🛠️ Installation on Mac

### Install via Claude Desktop Extension UI (Recommended)

1. Build the Claude extension package from the repository root:
   ```bash
   bash scripts/build_claude_extension.sh
   ```
   The script copies the MCP server, installs production dependencies, and produces `dist/claude-extension/teams-extractor-mcp.zip`.
2. Open Claude Desktop and navigate to **Developer → Extensions → Install Extension**
3. Choose the generated `teams-extractor-mcp.zip`
4. When prompted, paste your PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/teams_extractor`)
5. Ensure **Use Built-in Node.js for MCP** is enabled in the Claude settings (the default on macOS)
6. Restart Claude Desktop — the `teams-extractor-mcp` server and its tools will be available immediately

### Command Line Setup (macOS)

If you prefer a script that edits Claude's configuration file directly:

```bash
cd mcp-server
./setup-claude.sh
```

The script will:
1. ✅ Check Node.js installation
2. ✅ Install npm dependencies
3. ✅ Prompt for your database URL
4. ✅ Test database connection
5. ✅ Configure Claude Desktop automatically (updates `~/Library/Application Support/Claude/claude_desktop_config.json`)
6. ✅ Create backup of existing configuration

After running the script, just **restart Claude Desktop** and you're ready to go!

### Manual Setup (Advanced)

If you prefer to set it up manually:

1. **Install Dependencies:**
   ```bash
   cd mcp-server
   npm install
   ```

2. **Test MCP Server (optional):**
   ```bash
   export MCP_DATABASE_URL="postgresql://user:password@localhost:5432/teams_extractor"
   node index.js
   ```
   Press Ctrl+C to stop the test.

3. **Configure Claude Desktop:**

   Edit the Claude Desktop configuration file on your Mac:
   ```bash
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   Add this configuration (replace `/absolute/path/to/mcp-server` with the actual path):
   ```json
   {
     "mcpServers": {
       "teams-extractor": {
         "command": "node",
         "args": [
           "/absolute/path/to/teams-extractor/mcp-server/index.js"
         ],
         "env": {
           "MCP_DATABASE_URL": "postgresql://user:password@localhost:5432/teams_extractor"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop**

   Completely quit and restart the Claude Desktop app.

## 🔧 Available Tools

### 1. list_messages

List Teams messages with optional filtering.

**Parameters:**
- `channel_id` (string, optional) - Filter by channel ID
- `channel_name` (string, optional) - Filter by channel name (partial match)
- `sender_name` (string, optional) - Filter by sender name (partial match)
- `from_date` (string, optional) - Filter from date (ISO 8601)
- `to_date` (string, optional) - Filter to date (ISO 8601)
- `limit` (number, optional) - Number of results (default: 50, max: 500)
- `offset` (number, optional) - Pagination offset (default: 0)

**Example prompts:**
- "Show me the latest 20 Teams messages"
- "List messages from the Engineering channel"
- "Show messages from John Smith in the last 7 days"

### 2. search_messages

Full-text search across all message content.

**Parameters:**
- `query` (string, required) - Search query
- `channel_name` (string, optional) - Filter by channel
- `sender_name` (string, optional) - Filter by sender
- `limit` (number, optional) - Number of results (default: 20, max: 100)

**Example prompts:**
- "Search for messages about the project deadline"
- "Find all mentions of bug fixes"
- "Search for deployment in the DevOps channel"

### 3. get_statistics

Get comprehensive statistics about Teams messages.

**Parameters:**
- `days` (number, optional) - Number of days to include (default: 30)

**Returns:**
- Total message count
- Messages in period
- Top 10 channels by activity
- Top 10 senders by message count
- Daily activity breakdown

**Example prompts:**
- "Show me Teams statistics for the last 7 days"
- "What are the overall message statistics?"
- "Who are the most active users this month?"

### 4. get_message

Get detailed information about a specific message.

**Parameters:**
- `message_id` (string, required) - Message ID

**Example prompts:**
- "Get details for message ID abc123"
- "Show me the full message with ID xyz789"

### 5. get_channel_summary

Get activity summary for a specific channel.

**Parameters:**
- `channel_name` (string, required) - Channel name
- `days` (number, optional) - Days to include (default: 7)

**Returns:**
- Message count
- Unique senders
- First and last message timestamps
- Top 5 senders in channel
- 10 most recent messages

**Example prompts:**
- "Summarize activity in the Engineering channel"
- "What's happening in the Product channel this week?"
- "Show me the Marketing channel summary"

### 6. get_sender_activity

Get activity summary for a specific person.

**Parameters:**
- `sender_name` (string, required) - Sender name
- `days` (number, optional) - Days to include (default: 7)

**Returns:**
- Total message count
- Active channels
- First and last message timestamps
- Top 5 channels where sender is active
- 10 most recent messages from sender

**Example prompts:**
- "Show me Sarah's activity this week"
- "What channels is John active in?"
- "Analyze Alice's Teams activity"

## 💬 Example Conversations with Claude

### Getting Started

**You:** "Can you show me the available Teams message tools?"

**Claude:** "I have access to 6 tools for querying your Teams messages: list_messages, search_messages, get_statistics, get_message, get_channel_summary, and get_sender_activity. What would you like to explore?"

### Listing Messages

**You:** "Show me the latest 10 messages from the Engineering channel"

**Claude:** [Uses list_messages tool with channel_name="Engineering" and limit=10]

### Searching

**You:** "Find all messages about the quarterly review"

**Claude:** [Uses search_messages tool with query="quarterly review"]

### Analytics

**You:** "What are the Teams statistics for this month?"

**Claude:** [Uses get_statistics tool with days=30]

### Channel Insights

**You:** "Summarize what's been happening in the Product channel"

**Claude:** [Uses get_channel_summary tool with channel_name="Product"]

### User Activity

**You:** "How active has Sarah been this week?"

**Claude:** [Uses get_sender_activity tool with sender_name="Sarah" and days=7]

## 🔍 Troubleshooting

### Tool Not Showing in Claude Desktop

1. Check configuration file location is correct for your OS
2. Verify JSON syntax is valid (use a JSON validator)
3. Ensure absolute path to index.js is correct
4. Restart Claude Desktop completely
5. Check Claude Desktop logs for errors

### Database Connection Errors

1. Verify DATABASE_URL is correct
2. Check PostgreSQL is running: `pg_isready -h localhost`
3. Test connection manually:
   ```bash
   psql "postgresql://user:password@localhost:5432/teams_extractor" -c "SELECT COUNT(*) FROM teams.messages"
   ```
4. Ensure database user has read permissions on teams schema

### MCP Server Not Starting

1. Check Node.js version: `node -v` (must be 18+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Test server manually:
   ```bash
   export MCP_DATABASE_URL="postgresql://..."
   node index.js
   ```
4. Check for error messages in terminal

### Permission Errors

1. Ensure MCP server files are readable:
   ```bash
   chmod +x index.js
   chmod +r package.json
   ```
2. Check Claude Desktop can access the directory
3. On Mac, grant Claude full disk access in System Preferences

## 🔐 Security Considerations

- **Database Credentials**: Stored in Claude Desktop config file (user-only permissions)
- **Read-Only Access**: MCP server only performs SELECT queries
- **No Network Exposure**: Uses stdio protocol, no ports opened
- **Local Only**: Only accessible to Claude Desktop on your machine

### Best Practices

1. **Use Read-Only Database User:**
   ```sql
   CREATE USER mcp_reader WITH PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE teams_extractor TO mcp_reader;
   GRANT USAGE ON SCHEMA teams TO mcp_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA teams TO mcp_reader;
   ```

2. **Protect Config File:**
   ```bash
   chmod 600 ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

3. **Use Environment Variables:** Consider using a .env file instead of hardcoding credentials

## 📊 Performance

- **Fast Queries**: PostgreSQL indexes on key columns (timestamp, sender, channel)
- **Full-Text Search**: Uses PostgreSQL's native GIN indexes
- **Pagination**: All list operations support limit/offset
- **Connection Pooling**: Maximum 5 concurrent connections to database

## 🐛 Debugging

Enable debug logging:

```bash
export DEBUG=mcp:*
export MCP_DATABASE_URL="postgresql://..."
node index.js
```

Test specific tool:

```bash
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "list_messages", "arguments": {"limit": 5}}, "id": 1}' | node index.js
```

## 📝 Development

### Adding New Tools

1. Add tool definition in `ListToolsRequestSchema` handler
2. Implement handler function (e.g., `handleYourTool`)
3. Add case to `CallToolRequestSchema` handler
4. Test with sample data
5. Update documentation

### Testing

```bash
# Install dev dependencies
npm install --save-dev

# Run tests (if configured)
npm test

# Lint code
npm run lint
```

## 🆘 Support

If you encounter issues:

1. Check this README's troubleshooting section
2. Review Claude Desktop logs
3. Test database connection independently
4. Verify Node.js and npm versions
5. Check MCP SDK documentation: https://modelcontextprotocol.io

## 📚 Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/mcp)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Main Project Documentation](../README.md)

## 🎯 Roadmap

- [ ] Add support for message threads
- [ ] Implement aggregation queries
- [ ] Add export functionality
- [ ] Support for attachments metadata
- [ ] Time-based trending analysis
- [ ] Sentiment analysis integration
- [ ] Custom query builder tool

## 📄 License

Same as main project (see root LICENSE file)
