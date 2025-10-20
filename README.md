# Teams Güncelleme → Jira Automation

This repository ships a browser extension, local Python processor, MCP agent module, and n8n workflow template that automate Jira issue creation whenever you confirm deployments inside the Teams channel `Güncelleme Planlama`.

## Components
- `extension/` – Manifest v3 extension that watches the Teams web client, captures your confirmation messages, and posts structured events to the local processor.
- `processor/server.py` – FastAPI service that stores messages in SQLite, invokes the LLM agent, and forwards enriched payloads to n8n.
- `mcp/agent.py` & `mcp/teams_agent.py` – Shared LLM transformation logic plus an optional MCP server (if you want to expose the tool over MCP).
- `n8n/workflows/jira-teams.json` – Importable workflow that accepts processed payloads and creates Jira issues.
- `docs/architecture.md` – High-level overview of the design and data contracts.

## Prerequisites
- Chrome / Edge browser (Manifest v3 compatible).
- Access to the Teams web client (https://teams.microsoft.com).
- n8n Cloud workspace (or self-hosted) with Jira credentials configured.
- OpenAI API key (or compatible provider configured through the MCP server).
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
export N8N_WEBHOOK_URL=https://example.n8n.cloud/webhook/teams-guncelleme
export N8N_API_KEY=my-shared-secret  # optional
python -m processor.server
```

- The service listens on `http://0.0.0.0:8090` by default.
- Messages are written to `data/teams_messages.db`.
- Hit `http://localhost:8090/health` to verify the model and n8n connectivity.

> Optional: If you also need an MCP endpoint for other tools, start `uvicorn mcp.teams_agent:app --port 8080` after exporting the same `OPENAI_API_KEY`.

## 3. Import the n8n Workflow
1. In n8n, go to **Workflows → Import from File** and select `n8n/workflows/jira-teams.json`.
2. Set the webhook path if you want a custom slug (defaults to `/webhook/teams-guncelleme`).
3. Bind Jira credentials on the **Create Jira Issue** node.
4. Update the Function node with your Jira custom field IDs or default project key.
5. Activate the workflow and copy the live webhook URL (use it in `N8N_WEBHOOK_URL`).

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

## 5. Test the Loop
1. Post a test request and reply with `Güncellendi` in the `Güncelleme Planlama` channel.
2. Watch the extension logs (`chrome://extensions → Inspect views`) to confirm the message is captured and sent to the processor.
3. Check `http://localhost:8090/messages/{id}` (ID returned in the extension logs) to see the stored record and Jira payload.
4. In n8n, inspect the execution to ensure the issue was created with the supplied payload.
5. Verify the Jira issue summary/description look correct.

## Customisation Tips
- Update DOM selectors inside `extension/contentScript.js` if Microsoft changes the Teams markup. The selectors are grouped at the top of the file.
- Extend the MCP prompt or default field mapping in `mcp/agent.py` / `processor/server.py` to match your Jira taxonomy.
- Add extra validation in n8n (for example, prevent duplicate creation by checking Jira for an existing summary before creating a new issue).
- Use the SQLite database for analytics or to replay messages into Jira.

## Logging & Monitoring
- Extension retries failed processor calls every minute and logs to the service worker console.
- The processor exposes `/health` (model + n8n connectivity) and stores every message with status transitions.
- The MCP agent (optional) exposes `/health` showing the active model; pipe its logs to your favourite aggregator.
- n8n provides execution history – enable Slack or email alerts on failure runs.

## Next Steps
- Add a Teams bot in n8n to comment back to the channel with the created issue key.
- Persist historical data (e.g., run ID, Jira key, timestamps) into a warehouse for reporting.
- Package the extension (crx) and distribute internally via Group Policy or the Chrome Web Store private listing.
