# Teams Güncelleme → Claude Desktop Integration

This repository ships a browser extension, local Python processor, MCP agent module, and MCP server that expose Teams messages to Claude Desktop for analysis and processing.

## Components
- `extension/` – Manifest v3 extension that watches the Teams web client, captures your confirmation messages, and posts structured events to the local processor.
- `processor/server.py` – FastAPI service that stores messages in SQLite and invokes the LLM agent for message classification and Jira payload generation.
- `mcp/agent.py` & `mcp/teams_agent.py` – Shared LLM transformation logic for message processing.
- `mcp-server/` – MCP server that exposes Teams messages to Claude Desktop via the Model Context Protocol.
- `docs/architecture.md` – High-level overview of the design and data contracts.

## Prerequisites
- Chrome / Edge browser (Manifest v3 compatible).
- Access to the Teams web client (https://teams.microsoft.com).
- Claude Desktop application installed.
- OpenAI API key for message processing.
- Python 3.10+ for the processor and MCP server.

## 1. Install Python Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r mcp/requirements.txt
```

The requirements file covers both the LLM agent and the local processor (FastAPI, httpx, etc.).

## 2. Run the Local Processor
```bash
export OPENAI_API_KEY=sk-...
python -m processor.server
```

- The service listens on `http://0.0.0.0:8090` by default.
- Messages are written to `data/teams_messages.db`.
- Hit `http://localhost:8090/health` to verify the processor is running.

## 3. Configure Claude Desktop MCP Integration

### Option 1: Manual Configuration
Add the MCP server to your Claude Desktop configuration file:

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:
```json
{
  "mcpServers": {
    "teams-extractor": {
      "command": "python",
      "args": [
        "/path/to/teams-extractor/mcp-server/server.py"
      ],
      "env": {
        "PYTHONPATH": "/path/to/teams-extractor"
      }
    }
  }
}
```

Replace `/path/to/teams-extractor` with the actual path to this repository.

### Option 2: Use the Provided Configuration
Copy the provided configuration template:
```bash
cp claude-desktop-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Edit the file to update paths to match your installation
```

### Start the MCP Server
```bash
cd mcp-server
./start-mcp-server.sh  # Linux/macOS
# or
start-mcp-server.bat   # Windows
```

Restart Claude Desktop to load the MCP server.

## 4. Load the Browser Extension
1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select the `extension/` folder.
3. Open the extension options page:
   - Paste the Processor URL, e.g., `http://localhost:8090/ingest`.
   - Set the optional API key if you protected the processor with `X-API-Key`.
   - Enter your Teams display name (only your messages are processed).
   - Leave `Channel Name` as `Güncelleme Planlama` or adjust if you use multiple rooms.
   - Adjust keywords if you have additional confirmation phrases.
4. Save the settings.

## 5. Test the Integration
1. Post a test request and reply with `Güncellendi` in the `Güncelleme Planlama` channel.
2. Watch the extension logs (`chrome://extensions → Inspect views`) to confirm the message is captured and sent to the processor.
3. Check `http://localhost:8090/messages/{id}` (ID returned in the extension logs) to see the stored record and Jira payload.
4. Open Claude Desktop and ask: "Show me the recent Teams messages"
5. Claude will use the MCP server to query the database and display the messages.

### Example Claude Desktop Queries
- "Show me the most recent Teams messages from Güncelleme Planlama channel"
- "Search for messages about ng-ui deployments"
- "Get statistics on processed messages"
- "Show me the Jira payload for message ID 5"
- "Find all messages with errors"

## Customisation Tips
- Update DOM selectors inside `extension/contentScript.js` if Microsoft changes the Teams markup. The selectors are grouped at the top of the file.
- Extend the MCP prompt or default field mapping in `mcp/agent.py` / `processor/server.py` to match your Jira taxonomy.
- Add custom MCP tools in `mcp-server/server.py` for additional functionality (e.g., filtering by date ranges, exporting to CSV).
- Use the SQLite database for analytics or to build custom dashboards.
- Integrate with Jira API directly from Claude Desktop by creating additional MCP tools.

## Logging & Monitoring
- Extension retries failed processor calls every minute and logs to the service worker console.
- The processor exposes `/health` endpoint showing the active model and database path.
- Every message is stored with status transitions in SQLite (`data/teams_messages.db`).
- The MCP server logs all tool calls and queries to stdout.
- Monitor the database directly or build custom dashboards using the SQLite data.

## Architecture

### Data Flow
```
Teams Channel
    ↓ (Browser Extension captures messages)
Processor (FastAPI)
    ↓ (Stores in SQLite + AI processing)
SQLite Database
    ↓ (Exposed via MCP)
MCP Server
    ↓ (Model Context Protocol)
Claude Desktop
    → Query, analyze, and process messages
```

### Direct Jira Integration (Optional)
You can create Jira issues directly from Claude Desktop by:
1. Asking Claude to create a Jira issue based on a Teams message
2. Extending the MCP server with Jira API integration tools
3. Using the generated Jira payloads from the processor

## Next Steps
- Add Jira API integration to the MCP server for direct issue creation from Claude Desktop.
- Build custom analytics dashboards using the SQLite database.
- Package the extension (crx) and distribute internally via Group Policy or the Chrome Web Store private listing.
- Add more sophisticated message classification using custom prompts.
