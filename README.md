# Teams Güncelleme → Jira Automation

Automate Jira issue creation from Microsoft Teams deployment confirmations. This system captures messages from Teams, uses AI to extract structured information, and automatically creates Jira tickets for audit trails and tracking.

## Overview

This repository provides a complete automation pipeline:
1. **Browser Extension** - Monitors Teams web client for deployment confirmations
2. **Local Processor** - Processes messages using OpenAI and stores them in SQLite
3. **AI Agent** - Transforms natural language into structured Jira payloads
4. **n8n Integration** - Creates Jira issues from processed data

**Use Case**: Organizations using Microsoft Teams for deployment communications who need automated Jira ticketing for compliance and tracking.

## Components

- **`extension/`** – Manifest v3 browser extension that:
  - Watches the Teams web client using MutationObserver
  - Captures deployment confirmation messages
  - Classifies messages as local or global updates
  - Sends structured events to the local processor
  - Implements retry logic with queue management

- **`processor/server.py`** – FastAPI service that:
  - Receives messages via REST API
  - Persists all messages in SQLite with status tracking
  - Invokes OpenAI LLM for intelligent extraction
  - Forwards enriched payloads to n8n webhooks
  - Provides correlation IDs for request tracking
  - Supports optional API key authentication

- **`mcp/agent.py`** – Core LLM transformation logic:
  - Pydantic models for data validation
  - OpenAI integration for natural language processing
  - Extracts: summary, description, components, versions
  - Maps Teams classifications to Jira issue types

- **`mcp/teams_agent.py`** – Optional MCP server wrapper for exposing the agent over the Model Context Protocol

- **`n8n/workflows/jira-teams.json`** – n8n workflow template that:
  - Accepts webhook payloads from processor
  - Validates and enriches data
  - Creates Jira issues via REST API
  - Handles error notifications

- **`docs/architecture.md`** – Detailed technical documentation including data flow, contracts, and security considerations

## Prerequisites

### Required
- **Browser**: Chrome or Edge (Manifest v3 compatible)
- **Teams Access**: Microsoft Teams web client (https://teams.microsoft.com)
- **Python**: 3.10 or higher
- **OpenAI API**: Valid API key with access to GPT models
- **n8n**: Cloud workspace or self-hosted instance
- **Jira**: Credentials configured in n8n

### Optional
- **Docker**: For containerized deployment
- **Git**: For version control and updates

## 1. Install Python Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r mcp/requirements.txt
```

The requirements file covers both the LLM agent and the local processor (FastAPI, httpx, etc.).

## 2. Configure Environment Variables

Create a `.env` file or export these variables:

```bash
# Required
export OPENAI_API_KEY=sk-...
export N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook/teams-guncelleme

# Optional
export N8N_API_KEY=my-shared-secret              # n8n webhook authentication
export PROCESSOR_API_KEY=your-secret-key         # Require API key for processor endpoints
export ALLOWED_ORIGINS=http://localhost:3000     # CORS allowed origins (comma-separated)
export OPENAI_MODEL=gpt-4-turbo                  # Default: gpt-4.1-mini
export HOST=0.0.0.0                              # Default: 0.0.0.0
export PORT=8090                                 # Default: 8090
export PROCESSOR_DATA_DIR=data                   # Default: data/
```

## 3. Run the Local Processor

```bash
python -m processor.server
```

- The service listens on `http://0.0.0.0:8090` by default
- Messages are persisted to `data/teams_messages.db`
- All requests include correlation IDs for tracking
- Check health: `curl http://localhost:8090/health`

**Health Check Response:**
```json
{
  "status": "ok",
  "model": "gpt-4.1-mini",
  "db": "/path/to/data/teams_messages.db",
  "n8n_connected": true
}
```

> **Optional MCP Server**: If you need an MCP endpoint for other tools:
> ```bash
> uvicorn mcp.teams_agent:app --port 8080
> ```

## 4. Import the n8n Workflow
1. In n8n, go to **Workflows → Import from File** and select `n8n/workflows/jira-teams.json`.
2. Set the webhook path if you want a custom slug (defaults to `/webhook/teams-guncelleme`).
3. Bind Jira credentials on the **Create Jira Issue** node.
4. Update the Function node with your Jira custom field IDs or default project key.
5. Activate the workflow and copy the live webhook URL (use it in `N8N_WEBHOOK_URL`).

## 5. Load the Browser Extension
1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select the `extension/` folder.
3. Open the extension options page:
   - Paste the Processor URL, e.g., `http://localhost:8090/ingest`.
   - Set the optional API key if you protected the processor with `X-API-Key`.
   - Enter your Teams display name (only your messages are processed).
   - Leave `Channel Name` as `Güncelleme Planlama` or adjust if you use multiple rooms.
   - Adjust keywords if you have additional confirmation phrases.
4. Save the settings.

## 6. Test the Loop
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

## Security Best Practices

### API Key Protection
- **Always** set `PROCESSOR_API_KEY` in production to require authentication
- Store API keys in environment variables, never commit them to git
- Use different API keys for development and production

### CORS Configuration
- Set `ALLOWED_ORIGINS` to restrict which domains can call your processor
- Default allows localhost only for security
- Example: `ALLOWED_ORIGINS=https://teams.microsoft.com,https://your-app.com`

### Network Security
- Run processor behind a firewall or VPN in production
- Consider using HTTPS with reverse proxy (nginx/caddy)
- Restrict network access to n8n webhook endpoints

### Data Privacy
- SQLite database is unencrypted by default
- Consider encrypting sensitive data at rest
- Implement data retention policies
- Review OpenAI's data usage policies

## Troubleshooting

### Extension Issues

**Problem**: Extension not capturing messages
- **Check**: Open developer tools on Teams tab, look for console errors
- **Check**: Verify channel name matches exactly (case-sensitive)
- **Check**: Confirm your Teams display name is correct in settings
- **Fix**: Reload the Teams page after installing/updating extension

**Problem**: Messages not sending to processor
- **Check**: Extension options → verify processor URL is correct
- **Check**: Browser console for network errors
- **Check**: Processor is running and accessible
- **Fix**: Check queue in extension background page (`chrome://extensions` → Details → Inspect views: background page)

**Problem**: Queue backing up
- **Check**: Extension background page for failed messages
- **Reason**: Processor is down or returning errors
- **Fix**: Clear queue after fixing processor, or increase retry limit in `background.js`

### Processor Issues

**Problem**: Processor won't start
- **Check**: Python version is 3.10+: `python --version`
- **Check**: All dependencies installed: `pip install -r mcp/requirements.txt`
- **Check**: `OPENAI_API_KEY` is set and valid
- **Fix**: Check processor logs for specific errors

**Problem**: 401 Unauthorized
- **Reason**: API key mismatch
- **Fix**: Ensure `X-API-Key` header matches `PROCESSOR_API_KEY`
- **Fix**: If not using auth, unset `PROCESSOR_API_KEY` environment variable

**Problem**: CORS errors in browser
- **Check**: Browser console for CORS policy errors
- **Fix**: Add your origin to `ALLOWED_ORIGINS` environment variable
- **Example**: `ALLOWED_ORIGINS=https://teams.microsoft.com`

**Problem**: Messages stuck in "received" status
- **Check**: OpenAI API key is valid and has credits
- **Check**: Processor logs for LLM errors
- **Check**: Message record in database: `sqlite3 data/teams_messages.db "SELECT * FROM messages WHERE id=X;"`
- **Fix**: Check `error` column for details

**Problem**: Messages processed but not reaching n8n
- **Check**: `N8N_WEBHOOK_URL` is correct and accessible
- **Check**: n8n workflow is activated
- **Test**: `curl -X POST $N8N_WEBHOOK_URL -H "Content-Type: application/json" -d '{"test": true}'`
- **Fix**: Check n8n execution logs for errors

### n8n Issues

**Problem**: Webhook not triggering
- **Check**: Workflow is activated (toggle in top-right)
- **Check**: Webhook path matches `N8N_WEBHOOK_URL`
- **Test**: Use n8n's "Test webhook" feature

**Problem**: Jira issue creation fails
- **Check**: Jira credentials are configured correctly
- **Check**: Project key exists and you have permissions
- **Check**: Required fields are provided in payload
- **Fix**: Check n8n execution error details

**Problem**: Duplicate issues created
- **Check**: Message ID deduplication in processor
- **Fix**: Add Jira search node before create to check for existing issues

### Database Issues

**Problem**: Database locked errors
- **Reason**: Multiple processor instances or long-running queries
- **Fix**: Ensure only one processor instance is running
- **Fix**: Check for crashed processes: `ps aux | grep processor`

**Problem**: Corrupted database
- **Backup**: `cp data/teams_messages.db data/teams_messages.db.backup`
- **Check**: `sqlite3 data/teams_messages.db "PRAGMA integrity_check;"`
- **Recover**: Restore from backup or delete and restart (loses history)

### Debugging Tips

**Enable detailed logging:**
```python
# Add to top of processor/server.py
logging.basicConfig(level=logging.DEBUG)
```

**Check correlation IDs:**
- Every request gets a unique correlation ID
- Find it in response headers: `X-Correlation-ID`
- Search logs using correlation ID to trace request flow

**Inspect database directly:**
```bash
sqlite3 data/teams_messages.db
sqlite> .headers on
sqlite> .mode column
sqlite> SELECT id, status, author, created_at FROM messages ORDER BY id DESC LIMIT 10;
```

**Test LLM transformation manually:**
```bash
curl -X POST http://localhost:8090/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "channel": "Test",
    "author": "Test User",
    "classification": {"type": "localized"},
    "resolutionText": "Test update completed"
  }'
```

## Performance Tuning

- **Concurrent Processing**: Processor handles async processing, no need for workers
- **Database Size**: Archive old messages periodically to maintain performance
- **Rate Limiting**: OpenAI has rate limits; consider caching or batch processing for high volume
- **Memory**: Each processor instance uses ~100-200MB RAM
- **Disk**: SQLite grows ~1KB per message; plan storage accordingly

## Advanced Configuration

### Custom Keywords
Edit extension settings to add custom confirmation phrases:
```json
{
  "localized": ["Güncellendi", "Updated", "Deployed"],
  "global": ["Global güncellendi", "Global update", "Rollout complete"]
}
```

### Custom LLM Prompts
Modify `mcp/agent.py` to customize how the AI extracts information:
```python
# Around line 140, adjust the system prompt
self.system_prompt = """Your custom instructions here..."""
```

### Multiple Channels
Configure extension to monitor multiple channels:
1. Clone extension settings for each channel
2. Deploy separate processor instances, or
3. Modify channel filtering logic in `contentScript.js`

## Monitoring & Observability

### Metrics to Track
- **Message Volume**: Messages ingested per hour/day
- **Processing Success Rate**: Percentage reaching "forwarded" status
- **LLM Latency**: Time from ingest to processed
- **n8n Success Rate**: Percentage of successful Jira creations
- **Queue Depth**: Number of messages in retry queue

### Log Aggregation
- Processor logs include correlation IDs for distributed tracing
- Forward logs to ELK/Splunk/DataDog for analysis
- Use correlation ID to link extension → processor → n8n → Jira

### Alerts
Configure n8n to send alerts on:
- Jira creation failures
- Processor returning errors
- Queue depth exceeding threshold

## Backup & Recovery

### Database Backup
```bash
# Daily backup script
cp data/teams_messages.db data/backups/teams_messages.$(date +%Y%m%d).db
```

### Configuration Backup
- Export n8n workflow regularly
- Version control extension settings
- Document environment variable values (without secrets)

## Upgrading

### Extension Updates
1. Update code in `extension/` directory
2. Reload extension in `chrome://extensions`
3. Clear extension storage if schema changed

### Processor Updates
1. Pull latest code
2. Run `pip install -r mcp/requirements.txt --upgrade`
3. Restart processor service
4. Check `/health` endpoint

### Database Migrations
Currently no automated migrations. If schema changes:
1. Backup existing database
2. Export critical data if needed
3. Drop and recreate database
4. Restore data with migration script

## Next Steps
- **Teams Bot**: Add n8n bot to comment back with created issue key
- **Data Warehouse**: Persist historical data for reporting
- **Analytics Dashboard**: Visualize deployment trends
- **Extension Distribution**: Package as CRX for enterprise deployment
- **High Availability**: Deploy multiple processor instances with load balancer
- **Webhook Security**: Add HMAC signature validation
- **Testing**: Add unit and integration tests (see `tests/` for examples)

## Support & Contributing

### Getting Help
- Check this README and `docs/architecture.md` first
- Search existing issues on GitHub
- Review processor logs with correlation IDs
- Test components individually to isolate problems

### Filing Issues
Include:
- Component affected (extension/processor/n8n)
- Error messages and correlation IDs
- Steps to reproduce
- Environment (OS, browser, Python version)
- Configuration (sanitized, no secrets)

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit pull request with description
5. Ensure CI passes

## License

See LICENSE file for details.
