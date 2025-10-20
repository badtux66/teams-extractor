# Teams → Jira Automation Overview

## Objectives
- Capture status responses the moment they are posted in the Teams channel `Güncelleme Planlama`.
- Classify the message as a localized **Güncelleştirme** or global **Yaygınlaştırma** rollout.
- Extract context (requester, module, versions, blockers) from the quoted request thread.
- Create or update Jira issues automatically, without relying on Microsoft Graph admin consent.

## High-Level Flow
1. **Browser Extension (Manifest v3)**
   - Runs on `https://teams.microsoft.com/*`.
   - Observes DOM mutations inside the target channel and collects:
     - Responder display name.
     - Original request text (from the quoted card).
     - Resolution message containing trigger keywords: `Güncellendi`, `Güncellenmiştir`, `Yaygınlaştırıldı`, `Yaygınlaştırılmıştır`.
   - Sends the structured payload to the local processor (`http://localhost:8090/ingest`) with an optional `X-API-Key`.

2. **Local Python Processor**
   - Persists every payload in SQLite (`data/teams_messages.db`) for auditing and replay.
   - Uses the shared **Teams Jira MCP agent** to enrich the bundle into a Jira-ready schema.
   - Forwards the enriched payload to n8n via the configured webhook, including metadata about the stored record.

3. **n8n Cloud Workflow**
   - Receives the processed payload from the local processor.
   - Maps fields directly into the Jira REST request and creates/updates the relevant issue.
   - Can notify Teams or perform side-effects (Sheets, Slack, etc.).

4. **MCP Agent (LLM Tooling)**
   - Shared module (`mcp/agent.py`) leveraged by both the local processor and the standalone MCP server.
   - Converts Teams resolutions into deterministic Jira payloads using an LLM with response-format enforcement.

5. **Jira**
   - Stores the automated ticket with summary, description, and custom fields aligned to the rollout type.
   - Traceability preserved via the Teams permalink stored in the payload metadata.

## Data Contracts

### Browser → Local Processor
```json
{
  "channel": "Güncelleme Planlama",
  "messageId": "19:xxxx",
  "timestamp": "2025-10-16T08:05:00Z",
  "author": "Vahid Çataltaş",
  "resolutionText": "Güncellendi...",
  "quotedRequest": {
    "author": "Burak Balcı",
    "text": "Merhaba, ng-ui için 4.48.4 sürümünü devreye alma imkanımız var mı..."
  },
  "extraContext": {
    "reactions": ["like", "heart"]
  }
}
```

### Processor → n8n Webhook
```json
{
  "processor": {
    "id": 42,
    "db_path": "/abs/path/data/teams_messages.db"
  },
  "resolution": {
    "channel": "Güncelleme Planlama",
    "messageId": "19:xxxx",
    "author": "Vahid Çataltaş",
    "timestamp": "2025-10-16T08:05:00Z",
    "classification": {
      "type": "localized",
      "keyword": "Güncellendi"
    },
    "resolutionText": "Güncellendi...",
    "quotedRequest": {
      "author": "Burak Balcı",
      "text": "Merhaba, ng-ui için 4.48.4 sürümünü devreye alma imkanımız var mı..."
    },
    "permalink": "https://teams.microsoft.com/l/message/..."
  },
  "jira_payload": {
    "issue_type": "Güncelleştirme",
    "summary": "[ng-ui] 4.48.4 deploy tamamlandı",
    "description": "Talep eden: Burak Balcı\nÇevre: su9\nİşlem: Güncelleme 4.48.4 -> prod\nNotlar: ...",
    "labels": ["ng-ui", "guncelleme", "su9"],
    "custom_fields": {
      "environment": "su9",
      "version": "4.48.4"
    },
    "comment": "Teams kaydı: https://teams.microsoft.com/l/message/..."
  }
}
```

## Component Responsibilities

| Component | Responsibility | Tech |
|-----------|----------------|------|
| `extension/` | Detect Teams confirmations, queue reliably, send to local processor. | Manifest v3, MutationObserver, fetch() |
| `processor/server.py` | Persist messages, invoke MCP agent, forward to n8n, expose health API. | FastAPI, SQLite, httpx |
| `mcp/agent.py` | Shared LLM transformation logic reused by processor and standalone MCP server. | Python, OpenAI SDK, Pydantic |
| `n8n` workflow | Execute Jira API call using processed data, handle notifications. | Webhook → Function → Jira Cloud Node |

## Failure Handling
- Extension maintains an IndexedDB queue; messages retry if the local processor is temporarily unreachable.
- Processor stores every payload before enrichment; statuses (`received`, `processed`, `forwarded`) track success.
- Processor retries n8n delivery on the next extension flush (you can also re-run by calling the REST endpoints).
- n8n can still notify Teams or create incidents on failure runs.

## Security Considerations
- Local processor accepts an optional `X-API-Key`. Because it binds to localhost by default, exposure is limited.
- MCP agent runs locally and reuses the OpenAI API key from environment variables.
- Jira credentials stored in n8n credentials vault.

## Next Steps
1. Finalize DOM selectors in the extension after inspecting the current Teams markup.
2. Launch the processor (`python -m processor.server`) and verify `/health`.
3. Import `n8n/workflows/jira-teams.json`, set Jira credentials, and update any custom field IDs.
4. Dry run in a private Teams channel, confirm rows land in SQLite and Jira tickets look correct.
