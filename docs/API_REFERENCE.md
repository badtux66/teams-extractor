# Teams Message Extractor - API Reference

## Overview

The Teams Message Extractor provides a RESTful API built with FastAPI. The API is automatically documented with OpenAPI (Swagger) and available at `http://localhost:8090/docs`.

**Base URL**: `http://localhost:8090`

**Authentication**: Currently optional (can be configured with `X-API-Key` header)

## Endpoints

### Health Check

Check system health and connectivity.

```http
GET /health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "model": "gpt-4",
  "db": "/app/data/teams_messages.db",
  "n8n_connected": true
}
```

**Response Fields**:
- `status` (string): System status ("ok" or "error")
- `model` (string): OpenAI model being used
- `db` (string): Path to SQLite database
- `n8n_connected` (boolean): Whether n8n webhook is configured

**Example**:
```bash
curl http://localhost:8090/health
```

---

### Get Statistics

Retrieve message processing statistics.

```http
GET /stats
```

**Response** (200 OK):
```json
{
  "total_messages": 150,
  "processed": 140,
  "pending": 5,
  "failed": 5,
  "today": 12,
  "this_week": 68
}
```

**Response Fields**:
- `total_messages` (int): Total messages ever processed
- `processed` (int): Successfully forwarded messages
- `pending` (int): Messages awaiting processing
- `failed` (int): Messages that encountered errors
- `today` (int): Messages processed in last 24 hours
- `this_week` (int): Messages processed in last 7 days

**Example**:
```bash
curl http://localhost:8090/stats
```

---

### List Messages

Retrieve a list of messages with optional filtering.

```http
GET /messages
```

**Query Parameters**:
- `status` (string, optional): Filter by status
  - Values: `received`, `processed`, `forwarded`, `failed`, `agent_error`, `n8n_error`
- `author` (string, optional): Filter by author name (partial match)
- `channel` (string, optional): Filter by channel name (partial match)
- `limit` (int, optional): Maximum number of results (default: 100, max: 1000)

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "message_id": "19:abc123",
    "channel": "Güncelleme Planlama",
    "author": "John Doe",
    "timestamp": "2025-10-27T10:30:00Z",
    "classification": {
      "type": "localized",
      "keyword": "Güncellendi"
    },
    "resolution_text": "Güncellendi: Version 4.48.4 deployed to production",
    "quoted_request": {
      "author": "Jane Smith",
      "text": "Can we deploy ng-ui 4.48.4 to production?"
    },
    "permalink": "https://teams.microsoft.com/l/message/...",
    "status": "forwarded",
    "jira_payload": {
      "issue_type": "Güncelleştirme",
      "summary": "[ng-ui] 4.48.4 deploy completed",
      "description": "...",
      "labels": ["ng-ui", "guncelleme", "prod"],
      "custom_fields": {}
    },
    "n8n_response_code": 200,
    "n8n_response_body": "{\"success\":true}",
    "error": null,
    "created_at": "2025-10-27T10:30:05Z",
    "updated_at": "2025-10-27T10:30:12Z"
  }
]
```

**Examples**:
```bash
# Get all messages
curl http://localhost:8090/messages

# Get only failed messages
curl http://localhost:8090/messages?status=failed

# Get messages by specific author
curl "http://localhost:8090/messages?author=John+Doe"

# Get messages with limit
curl http://localhost:8090/messages?limit=50

# Combine filters
curl "http://localhost:8090/messages?status=forwarded&author=John&limit=20"
```

---

### Get Message Details

Retrieve full details of a specific message.

```http
GET /messages/{record_id}
```

**Path Parameters**:
- `record_id` (int, required): Message ID

**Response** (200 OK):
```json
{
  "id": 1,
  "message_id": "19:abc123",
  "channel": "Güncelleme Planlama",
  "author": "John Doe",
  "timestamp": "2025-10-27T10:30:00Z",
  "classification": {
    "type": "localized",
    "keyword": "Güncellendi"
  },
  "resolution_text": "Güncellendi: Version 4.48.4 deployed",
  "quoted_request": {
    "author": "Jane Smith",
    "text": "Can we deploy ng-ui 4.48.4?"
  },
  "permalink": "https://teams.microsoft.com/l/message/...",
  "status": "forwarded",
  "jira_payload": {...},
  "n8n_response_code": 200,
  "n8n_response_body": "{\"success\":true}",
  "error": null,
  "created_at": "2025-10-27T10:30:05Z",
  "updated_at": "2025-10-27T10:30:12Z"
}
```

**Error Responses**:
- `404 Not Found`: Message with given ID doesn't exist
```json
{
  "detail": "Record not found"
}
```

**Example**:
```bash
curl http://localhost:8090/messages/123
```

---

### Delete Message

Delete a message from the database.

```http
DELETE /messages/{record_id}
```

**Path Parameters**:
- `record_id` (int, required): Message ID

**Response** (200 OK):
```json
{
  "status": "deleted"
}
```

**Error Responses**:
- `404 Not Found`: Message doesn't exist

**Example**:
```bash
curl -X DELETE http://localhost:8090/messages/123
```

⚠️ **Warning**: Deletion is permanent and cannot be undone.

---

### Retry Message Processing

Retry processing a failed message.

```http
POST /messages/{record_id}/retry
```

**Path Parameters**:
- `record_id` (int, required): Message ID

**Response** (200 OK):
```json
{
  "status": "retrying"
}
```

**Error Responses**:
- `404 Not Found`: Message doesn't exist

**Example**:
```bash
curl -X POST http://localhost:8090/messages/123/retry
```

**Behavior**:
1. Resets message status to "queued"
2. Clears previous error
3. Re-runs AI processing
4. Attempts to forward to n8n

---

### Ingest Message

Ingest a new message from the browser extension.

```http
POST /ingest
```

**Headers**:
- `Content-Type: application/json`
- `X-API-Key: <key>` (optional, if configured)

**Request Body**:
```json
{
  "channel": "Güncelleme Planlama",
  "messageId": "19:abc123",
  "timestamp": "2025-10-27T10:30:00Z",
  "author": "John Doe",
  "resolutionText": "Güncellendi: Version 4.48.4 deployed",
  "classification": {
    "type": "localized",
    "keyword": "Güncellendi"
  },
  "quotedRequest": {
    "author": "Jane Smith",
    "text": "Can we deploy ng-ui 4.48.4?"
  },
  "permalink": "https://teams.microsoft.com/l/message/..."
}
```

**Response** (202 Accepted):
```json
{
  "id": 124,
  "status": "queued"
}
```

**Example**:
```bash
curl -X POST http://localhost:8090/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "Güncelleme Planlama",
    "author": "John Doe",
    "resolutionText": "Güncellendi",
    "classification": {"type": "localized", "keyword": "Güncellendi"}
  }'
```

**Note**: Processing happens asynchronously. Use the returned `id` to check status.

---

### Get Configuration

Retrieve current system configuration.

```http
GET /config
```

**Response** (200 OK):
```json
{
  "openai_api_key": "sk-***",
  "n8n_webhook_url": "https://n8n.example.com/webhook/...",
  "n8n_api_key": "***",
  "processor_host": "0.0.0.0",
  "processor_port": 8090,
  "auto_retry": true,
  "max_retries": 3
}
```

**Note**: Sensitive fields are masked for security.

**Example**:
```bash
curl http://localhost:8090/config
```

---

### Update Configuration

Update system configuration.

```http
PUT /config
```

**Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "openai_api_key": "sk-new-key",
  "n8n_webhook_url": "https://n8n.example.com/webhook/teams",
  "n8n_api_key": "new-api-key",
  "processor_host": "0.0.0.0",
  "processor_port": 8090,
  "auto_retry": true,
  "max_retries": 3
}
```

**Response** (200 OK):
```json
{
  "status": "updated"
}
```

**Example**:
```bash
curl -X PUT http://localhost:8090/config \
  -H "Content-Type: application/json" \
  -d '{
    "openai_api_key": "sk-new-key",
    "n8n_webhook_url": "https://n8n.example.com/webhook/teams",
    "auto_retry": true,
    "max_retries": 5
  }'
```

⚠️ **Note**: Configuration is saved to disk and persists across restarts.

---

## Data Models

### Message

```typescript
interface Message {
  id: number                        // Unique identifier
  message_id: string | null        // Teams message ID
  channel: string                  // Teams channel name
  author: string                   // Message author
  timestamp: string | null         // Message timestamp (ISO 8601)
  classification: {                // Message classification
    type: string                   // "localized" or "global"
    keyword: string                // Trigger keyword used
  }
  resolution_text: string          // Full resolution message
  quoted_request: {                // Original request (if any)
    author: string
    text: string
  } | null
  permalink: string | null         // Teams message link
  status: string                   // Processing status
  jira_payload: object | null     // Generated Jira data
  n8n_response_code: number | null // HTTP status from n8n
  n8n_response_body: string | null // Response from n8n
  error: string | null            // Error message (if failed)
  created_at: string              // Creation timestamp
  updated_at: string              // Last update timestamp
}
```

### Message Status Values

- `received`: Message received, not yet processed
- `queued`: Queued for processing
- `processed`: AI processing completed
- `forwarded`: Successfully sent to n8n and Jira
- `failed`: Generic failure
- `agent_error`: AI processing failed
- `n8n_error`: n8n forwarding failed

### Classification Types

- `localized`: Güncelleştirme (localized update)
- `global`: Yaygınlaştırma (global rollout)

---

## Error Handling

### Standard Error Response

```json
{
  "detail": "Error message here"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `202 Accepted`: Request accepted for async processing
- `404 Not Found`: Resource doesn't exist
- `422 Unprocessable Entity`: Invalid request data
- `500 Internal Server Error`: Server error

### Error Examples

**Invalid message ID**:
```json
{
  "detail": "Record not found"
}
```

**Invalid request body**:
```json
{
  "detail": [
    {
      "loc": ["body", "channel"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Rate Limiting

Currently, no rate limiting is enforced. For production:

- Implement rate limiting per IP
- Suggested: 100 requests/minute for listing
- Suggested: 10 requests/minute for write operations

---

## Interactive Documentation

FastAPI provides automatic interactive documentation:

**Swagger UI**:
```
http://localhost:8090/docs
```

**ReDoc**:
```
http://localhost:8090/redoc
```

**OpenAPI Schema**:
```
http://localhost:8090/openapi.json
```

---

## Client Libraries

### Python

```python
import requests

# Base URL
BASE_URL = "http://localhost:8090"

# Get health status
response = requests.get(f"{BASE_URL}/health")
print(response.json())

# List messages
response = requests.get(f"{BASE_URL}/messages", params={"status": "failed"})
messages = response.json()

# Get specific message
message_id = 123
response = requests.get(f"{BASE_URL}/messages/{message_id}")
message = response.json()

# Retry failed message
response = requests.post(f"{BASE_URL}/messages/{message_id}/retry")
print(response.json())
```

### JavaScript/TypeScript

```typescript
const BASE_URL = 'http://localhost:8090';

// Get health status
const health = await fetch(`${BASE_URL}/health`).then(r => r.json());

// List messages with filters
const messages = await fetch(
  `${BASE_URL}/messages?status=failed&limit=50`
).then(r => r.json());

// Get specific message
const message = await fetch(
  `${BASE_URL}/messages/123`
).then(r => r.json());

// Retry failed message
const result = await fetch(`${BASE_URL}/messages/123/retry`, {
  method: 'POST'
}).then(r => r.json());
```

### cURL

See examples in each endpoint section above.

---

## Versioning

Current API version: **v1**

The API is currently unversioned. Future versions will include version prefix:
- v2: `http://localhost:8090/v2/...`

---

## Support

For API support:
- Review this documentation
- Check interactive docs at `/docs`
- Open GitHub issue
- Contact development team

---

**Version**: 1.0.0
**Last Updated**: 2025-10-27
