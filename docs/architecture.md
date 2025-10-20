# Teams → Jira Automation Overview

## Objectives
- Capture status responses the moment they are posted in the Teams channel `Güncelleme Planlama`.
- Classify the message as a localized **Güncelleştirme** or global **Yaygınlaştırma** rollout.
- Extract context (requester, module, versions, blockers) from the quoted request thread.
- Create or update Jira issues automatically, without relying on Microsoft Graph admin consent.

## High-Level Flow
1. **Browser Extension (Manifest v3)**
   - Runs on `https://teams.microsoft.com/*`.
   - Content script observes DOM mutations inside the target channel and collects:
     - Responder display name.
     - Original request text (from the quoted card).
     - Resolution message that contains one of the trigger keywords: `Güncellendi`, `Güncellenmiştir`, `Yaygınlaştırıldı`, `Yaygınlaştırılmıştır`.
   - When a trigger fires, a background service worker packages the payload and posts it to `n8n` via an authenticated webhook.

2. **n8n Cloud Workflow**
   - Receives webhook payload.
   - Calls the **Teams Resolution MCP Server** over HTTP (hosted locally or on an always-on machine) to transform the free-form message bundle into a normalized Jira payload.
   - Builds the Jira request body (Issue Type, Summary, Description, Labels, Components, Custom Fields) and executes the Jira `Create` or `Update` REST call.
   - Persists run metadata back to Jira (comment) and optionally into a Google Sheet / DB for auditing.

3. **MCP Agent (LLM Tooling)**
   - Exposes a single tool `prepare_jira_payload` that:
     - Accepts the structured bundle from the browser extension.
     - Uses a prompt/LLM to infer environment, system, and version details.
     - Emits structured JSON ready for Jira.
   - Implemented with Python `mcp` server and the OpenAI API (configurable provider). Runs alongside an embedding cache for cost control.

4. **Jira**
   - Receives REST request to create an issue.
   - Workflow fields stored to match PMO expectations (e.g., Issue Type `Güncelleştirme` vs `Yaygınlaştırma`).
   - Adds a backlink to the Teams message (deep link).

## Data Contracts

### Browser → n8n Webhook
```json
{
  "channel": "Güncelleme Planlama",
  "teamsMessageId": "19:xxxx",
  "postedAt": "2025-10-16T08:05:00Z",
  "responder": "Vahid Çataltaş",
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

### MCP Output → n8n
```json
{
  "issueType": "Güncelleştirme",
  "summary": "[ng-ui] 4.48.4 deploy tamamlandı",
  "description": "Talep eden: Burak Balcı\nÇevre: su9\nİşlem: Güncelleme 4.48.4 -> prod\nNotlar: ...",
  "labels": ["ng-ui", "guncelleme", "su9"],
  "customFields": {
    "cf_environment": "su9",
    "cf_version": "4.48.4"
  },
  "comment": "Teams kaydı: https://teams.microsoft.com/..."
}
```

## Component Responsibilities

| Component | Responsibility | Tech |
|-----------|----------------|------|
| `extension/` | Detect Teams events, ensure minimal footprint, send events reliably even after tab refresh. | Manifest v3, MutationObserver, fetch() |
| `mcp/teams_agent.py` | Provide deterministic Jira payload translation, maintain prompt templates, enforce schema. | Python, `mcp` SDK, Pydantic |
| `n8n` workflow | Glue automation orchestrator, error handling, rate limiting. | Webhook → HTTP Request → Function → Jira Cloud Node |

## Failure Handling
- Extension maintains an IndexedDB queue; messages retry if webhook fails.
- n8n catches Jira errors and posts notifications back to Teams via Adaptive Card.
- MCP server logs all conversions to `/logs/teams_agent.log`; irrecoverable errors bubble to n8n, which tags the run.

## Security Considerations
- Webhook secured with `X-API-Key` header. Extension stores key in `chrome.storage` and never exposes in DOM.
- MCP server binds to `localhost` behind SSH tunnel if running remotely.
- Jira credentials stored in n8n credentials vault.

## Next Steps
1. Finalize DOM selectors in the extension after inspecting the current Teams markup.
2. Import `n8n/workflows/jira-teams.json` and configure credentials.
3. Provision MCP server (Docker or uvicorn) and supply API keys.
4. Dry run in a private Teams channel, verify issue payload before rolling out to production.

