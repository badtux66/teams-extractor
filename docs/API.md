# API Documentation

## Processor API

The processor service exposes a REST API for ingesting Teams messages and retrieving their processing status.

### Base URL

```
http://localhost:8090
```

### Authentication

If `PROCESSOR_API_KEY` environment variable is set, all requests must include the API key:

```http
X-API-Key: your-secret-key
```

### Correlation IDs

All requests receive a correlation ID for tracking. You can provide your own:

```http
X-Correlation-ID: your-unique-id
```

Or the server will generate one automatically. The correlation ID is returned in response headers.

---

## Endpoints

### 1. Health Check

Check processor status and configuration.

**Endpoint:** `GET /health`

**Authentication:** Not required

**Request:**
```bash
curl http://localhost:8090/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "model": "gpt-4.1-mini",
  "db": "/home/user/teams-extractor/data/teams_messages.db",
  "n8n_connected": true
}
```

**Fields:**
- `status` (string): Always "ok" if service is running
- `model` (string): OpenAI model being used
- `db` (string): Absolute path to SQLite database
- `n8n_connected` (boolean): Whether n8n webhook URL is configured

---

### 2. Ingest Message

Submit a Teams resolution message for processing.

**Endpoint:** `POST /ingest`

**Authentication:** Required if `PROCESSOR_API_KEY` is set

**Request:**
```bash
curl -X POST http://localhost:8090/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d @payload.json
```

**Request Body:**
```json
{
  "messageId": "1234567890123",
  "channel": "Güncelleme Planlama",
  "author": "John Doe",
  "timestamp": "2025-10-21T14:30:00Z",
  "classification": {
    "type": "localized"
  },
  "resolutionText": "Güncellendi",
  "quotedRequest": {
    "text": "Please update the authentication service to v2.5.1",
    "author": "Jane Smith",
    "timestamp": "2025-10-21T14:25:00Z"
  },
  "permalink": "https://teams.microsoft.com/l/message/..."
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messageId` | string | No | Unique Teams message ID (for deduplication) |
| `channel` | string | Yes | Teams channel name |
| `author` | string | Yes | Display name of message author |
| `timestamp` | string | No | ISO 8601 timestamp of message |
| `classification` | object | Yes | Message classification |
| `classification.type` | string | Yes | Either "localized" or "global" |
| `resolutionText` | string | Yes | The confirmation message text |
| `quotedRequest` | object | No | Original request being confirmed |
| `quotedRequest.text` | string | No | Request text |
| `quotedRequest.author` | string | No | Request author |
| `quotedRequest.timestamp` | string | No | Request timestamp |
| `permalink` | string | No | Deep link to Teams message |

**Response:** `202 Accepted`
```json
{
  "id": 42,
  "status": "queued"
}
```

**Fields:**
- `id` (integer): Database record ID for tracking
- `status` (string): Always "queued" initially

**Error Responses:**

`401 Unauthorized` - Missing or invalid API key
```json
{
  "detail": "Invalid or missing API key"
}
```

`422 Unprocessable Entity` - Invalid request body
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

`500 Internal Server Error` - Server error
```json
{
  "detail": "Failed to ingest message: database locked"
}
```

---

### 3. Get Message Status

Retrieve the processing status and results for a message.

**Endpoint:** `GET /messages/{record_id}`

**Authentication:** Not required

**Request:**
```bash
curl http://localhost:8090/messages/42
```

**Response:** `200 OK`
```json
{
  "id": 42,
  "message_id": "1234567890123",
  "channel": "Güncelleme Planlama",
  "author": "John Doe",
  "timestamp": "2025-10-21T14:30:00Z",
  "classification": {
    "type": "localized"
  },
  "resolution_text": "Güncellendi",
  "quoted_request": {
    "text": "Please update the authentication service to v2.5.1",
    "author": "Jane Smith",
    "timestamp": "2025-10-21T14:25:00Z"
  },
  "permalink": "https://teams.microsoft.com/l/message/...",
  "status": "forwarded",
  "jira_payload": {
    "summary": "Update authentication service to v2.5.1",
    "description": "Deployment confirmed by John Doe on 2025-10-21...",
    "issueType": "Task",
    "components": ["Authentication Service"],
    "labels": ["deployment", "localized"],
    "customFields": {
      "version": "v2.5.1"
    }
  },
  "n8n_response_code": 200,
  "n8n_response_body": "{\"success\":true,\"issueKey\":\"PROJ-123\"}",
  "error": null,
  "created_at": "2025-10-21T14:30:05Z",
  "updated_at": "2025-10-21T14:30:12Z"
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `received` | Message stored, not yet processed |
| `processed` | LLM transformation completed |
| `forwarded` | Successfully sent to n8n |
| `agent_error` | LLM processing failed (check `error` field) |
| `n8n_error` | n8n webhook rejected payload (check `n8n_response_code`) |
| `failed` | Other processing error (check `error` field) |

**Error Response:**

`404 Not Found` - Record doesn't exist
```json
{
  "detail": "Record not found"
}
```

---

## Data Models

### TeamsResolution

The input schema for the `/ingest` endpoint.

```typescript
interface TeamsResolution {
  messageId?: string;
  channel: string;
  author: string;
  timestamp?: string;
  classification: {
    type: "localized" | "global";
  };
  resolutionText: string;
  quotedRequest?: {
    text?: string;
    author?: string;
    timestamp?: string;
  };
  permalink?: string;
}
```

### JiraPayload

The output schema generated by the LLM agent.

```typescript
interface JiraPayload {
  summary: string;
  description: string;
  issueType: "Task" | "Story" | "Bug" | "Deployment";
  components?: string[];
  labels?: string[];
  priority?: "Lowest" | "Low" | "Medium" | "High" | "Highest";
  customFields?: {
    [key: string]: string | number | string[];
  };
}
```

---

## MCP Server API

The optional MCP server exposes the same transformation logic via Model Context Protocol.

### Base URL

```
http://localhost:8080
```

### Endpoints

#### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "model": "gpt-4.1-mini"
}
```

#### Transform Message

**Endpoint:** `POST /transform`

**Request:** Same as processor `/ingest` endpoint

**Response:** `200 OK`
```json
{
  "summary": "Update authentication service to v2.5.1",
  "description": "...",
  "issueType": "Task",
  "components": ["Authentication Service"],
  "labels": ["deployment", "localized"],
  "customFields": {}
}
```

---

## Example Workflows

### 1. Submit and Track Message

```bash
# Submit message
RESPONSE=$(curl -s -X POST http://localhost:8090/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "channel": "Test Channel",
    "author": "Test User",
    "classification": {"type": "localized"},
    "resolutionText": "Test update completed"
  }')

# Extract record ID
ID=$(echo $RESPONSE | jq -r '.id')
echo "Message ID: $ID"

# Wait for processing
sleep 5

# Check status
curl http://localhost:8090/messages/$ID | jq
```

### 2. Monitor Processing Status

```bash
# Poll until status changes from "received"
ID=42
while true; do
  STATUS=$(curl -s http://localhost:8090/messages/$ID | jq -r '.status')
  echo "Status: $STATUS"

  if [ "$STATUS" != "received" ]; then
    break
  fi

  sleep 2
done

# Show final result
curl -s http://localhost:8090/messages/$ID | jq '.jira_payload'
```

### 3. Batch Processing

```bash
# Submit multiple messages
for msg in message1.json message2.json message3.json; do
  curl -X POST http://localhost:8090/ingest \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d @$msg
  sleep 1
done
```

### 4. Error Handling

```bash
# Submit message and capture correlation ID
RESPONSE=$(curl -v -X POST http://localhost:8090/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d @payload.json 2>&1)

# Extract correlation ID from response headers
CORRELATION_ID=$(echo "$RESPONSE" | grep -i "x-correlation-id" | awk '{print $3}')

# Use correlation ID to search logs
grep "$CORRELATION_ID" logs/processor.log
```

---

## Rate Limits

No explicit rate limits are enforced, but consider:

- **OpenAI API**: Subject to your OpenAI account rate limits
- **Database**: SQLite can handle ~50-100 writes/second
- **n8n**: Check your n8n plan's execution limits

For high-volume scenarios, consider:
- Batch processing during off-peak hours
- Multiple processor instances with load balancer
- Queue-based architecture with worker processes

---

## Security Considerations

### API Key Management

```bash
# Generate secure API key
PROCESSOR_API_KEY=$(openssl rand -hex 32)
echo "export PROCESSOR_API_KEY=$PROCESSOR_API_KEY" >> .env

# Test with API key
curl -H "X-API-Key: $PROCESSOR_API_KEY" http://localhost:8090/ingest
```

### CORS Configuration

```bash
# Development (allow localhost)
export ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Production (specific domain only)
export ALLOWED_ORIGINS=https://teams.microsoft.com

# Multiple environments
export ALLOWED_ORIGINS=https://teams.microsoft.com,https://app.example.com
```

### HTTPS in Production

```nginx
# nginx reverse proxy configuration
server {
  listen 443 ssl;
  server_name processor.example.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

---

## Testing

### Unit Testing API

```python
import pytest
from fastapi.testclient import TestClient
from processor.server import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_ingest():
    payload = {
        "channel": "Test",
        "author": "Test User",
        "classification": {"type": "localized"},
        "resolutionText": "Test"
    }
    response = client.post("/ingest", json=payload)
    assert response.status_code == 202
    assert "id" in response.json()
```

### Integration Testing

```bash
# Start processor in test mode
export OPENAI_API_KEY=test-key
export N8N_WEBHOOK_URL=http://localhost:5678/webhook/test
python -m processor.server &

# Run tests
pytest tests/integration/

# Cleanup
pkill -f processor.server
```

---

## Debugging

### Enable Debug Logging

```python
# Add to processor/server.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Trace Request Flow

```bash
# Generate correlation ID
CORRELATION_ID=$(uuidgen)

# Make request with correlation ID
curl -H "X-Correlation-ID: $CORRELATION_ID" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:8090/ingest \
     -d @payload.json

# Search logs
grep "$CORRELATION_ID" logs/*.log
```

### Database Inspection

```bash
# Connect to database
sqlite3 data/teams_messages.db

# View recent messages
SELECT id, author, status, created_at
FROM messages
ORDER BY id DESC
LIMIT 10;

# Count by status
SELECT status, COUNT(*)
FROM messages
GROUP BY status;

# Find errors
SELECT id, author, error, created_at
FROM messages
WHERE error IS NOT NULL
ORDER BY created_at DESC;
```
