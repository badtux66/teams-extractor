# Teams Güncelleme → Jira Automation

This repository ships a browser extension, MCP agent, and n8n workflow template that automate Jira issue creation whenever you confirm deployments inside the Teams channel `Güncelleme Planlama`.

## Components
- `extension/` – Manifest v3 extension that watches the Teams web client, captures your confirmation messages, and posts structured events to n8n.
- `mcp/teams_agent.py` – Model Context Protocol (MCP) server that converts the raw message bundle into a Jira-ready payload using an LLM.
- `n8n/workflows/jira-teams.json` – Importable workflow that glues the webhook, MCP server, and Jira Cloud together.
- `docs/architecture.md` – High-level overview of the design and data contracts.

## Prerequisites
- Chrome / Edge browser (Manifest v3 compatible).
- Access to the Teams web client (https://teams.microsoft.com).
- n8n Cloud workspace (or self-hosted) with Jira credentials configured.
- OpenAI API key (or compatible provider configured through the MCP server).
- Python 3.10+ for running the MCP server.

## 1. Run the MCP Agent
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r mcp/requirements.txt
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4.1-mini  # optional override
uvicorn mcp.teams_agent:app --reload --port 8080
```

- The agent exposes an HTTP endpoint at `POST /transform` and the MCP tool `prepare_jira_payload`.
- Protect access with a firewall or SSH tunnel if the server is exposed.

## 2. Import the n8n Workflow
1. In n8n, go to **Workflows → Import from File** and select `n8n/workflows/jira-teams.json`.
2. Configure the **Teams Webhook** path (defaults to `/webhook/teams-guncelleme`).
3. Bind Jira credentials on the **Create Jira Issue** node.
4. Optional: edit the Function node to map custom Jira fields (e.g., replace `customfield_environment` with your field IDs) and project key.
5. Activate the workflow and note the webhook URL and optional API key.

## 3. Load the Browser Extension
1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select the `extension/` folder.
3. Open the extension options page:
   - Paste the n8n webhook URL.
   - Set the webhook API key if you require one (recommended; configure the same header in n8n).
   - Enter your Teams display name (only your messages are processed).
   - Leave `Channel Name` as `Güncelleme Planlama` or adjust if you use multiple rooms.
   - Adjust keywords if you have additional confirmation phrases.
4. Save the settings.

## 4. Test the Loop
1. Post a test request and reply with `Güncellendi` in the `Güncelleme Planlama` channel.
2. Watch the extension logs (`chrome://extensions → Inspect views`) to confirm the message is captured.
3. In n8n, inspect the execution to ensure the MCP agent enriched the payload and Jira issue was created.
4. Verify the Jira issue summary/description look correct.

## Customisation Tips
- Update DOM selectors inside `extension/contentScript.js` if Microsoft changes the Teams markup. The selectors are grouped at the top of the file.
- Extend the MCP prompt in `mcp/teams_agent.py` to set project/component defaults or map to additional custom fields.
- Add extra validation in n8n (for example, prevent duplicate creation by checking Jira for an existing summary before creating a new issue).

## Logging & Monitoring
- Extension retries failed webhook calls every minute and logs to the service worker console.
- The MCP agent exposes `/health` showing the active model; pipe its logs to your favourite aggregator.
- n8n provides execution history – enable Slack or email alerts on failure runs.

## Next Steps
- Add a Teams bot in n8n to comment back to the channel with the created issue key.
- Persist historical data (e.g., run ID, Jira key, timestamps) into a warehouse for reporting.
- Package the extension (crx) and distribute internally via Group Policy or the Chrome Web Store private listing.
