# Teams Message Extractor - API Reference

## Overview

The Teams Message Extractor provides a comprehensive RESTful API built with Node.js and Express. The backend handles message ingestion from the Chrome extension, storage in PostgreSQL, and provides endpoints for querying and analytics.

**Base URL:** `http://localhost:5000/api`

**Default Port:** 5000 (configurable via `PORT` environment variable)

**Content Type:** `application/json`

**CORS:** Enabled for all origins (configurable in production)

## Table of Contents

1. [Authentication](#authentication)
2. [Message Endpoints](#message-endpoints)
3. [Statistics Endpoints](#statistics-endpoints)
4. [Health & Monitoring](#health--monitoring)
5. [Extraction Management](#extraction-management)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Examples](#examples)

---

## Authentication

**Current Status:** No authentication required (development mode)

**Future:** API key authentication will be added for production deployments.

```http
X-API-Key: your-api-key-here
```

---

## Message Endpoints

### Bulk Message Ingestion

Ingest multiple messages in a single request. This is the primary endpoint used by the Chrome extension.

```http
POST /api/messages/batch
```

**Request Body:**
```json
{
  "messages": [
    {
      "messageId": "19:abc123def456",
      "channelName": "General",
      "content": "Hello team, deployment is complete!",
      "sender": {
        "name": "John Doe",
        "email": "john.doe@company.com"
      },
      "timestamp": "2024-11-04T10:30:00.000Z",
      "url": "https://teams.microsoft.com/l/message/...",
      "type": "message",
      "threadId": "19:thread_abc123",
      "reactions": [
        { "type": "like", "count": 3 },
        { "type": "heart", "count": 1 }
      ],
      "mentions": [
        { "name": "Jane Smith", "email": "jane@company.com" }
      ],
      "attachments": []
    }
  ],
  "extractionId": "ext_1699091234567",
  "metadata": {
    "userAgent": "Chrome/120.0.0.0",
    "extensionVersion": "1.0.1"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "processed": 15,
  "duplicates": 2,
  "failed": 0,
  "extractionId": "ext_1699091234567",
  "messageIds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
}
```

**Error Response (422 Unprocessable Entity):**
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "messages[0].messageId",
      "message": "messageId is required"
    }
  ]
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/messages/batch \
  -H "Content-Type: application/json" \
  -d @messages.json
```

---

### List Messages

Retrieve messages with optional filtering, sorting, and pagination.

```http
GET /api/messages
```

**Query Parameters:**
- `channel` (string, optional) - Filter by channel name (partial match)
- `author` (string, optional) - Filter by author name (partial match)
- `type` (string, optional) - Filter by message type (`message`, `reply`, `system`)
- `startDate` (ISO 8601, optional) - Messages after this date
- `endDate` (ISO 8601, optional) - Messages before this date
- `limit` (integer, optional) - Number of results per page (default: 50, max: 100)
- `offset` (integer, optional) - Pagination offset (default: 0)
- `sortBy` (string, optional) - Sort field (`timestamp`, `author`, `channel`) (default: `timestamp`)
- `sortOrder` (string, optional) - Sort direction (`asc`, `desc`) (default: `desc`)

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": 123,
      "messageId": "19:abc123",
      "text": "Hello team!",
      "author": "John Doe",
      "authorEmail": "john@company.com",
      "timestamp": "2024-11-04T10:30:00.000Z",
      "channel": "General",
      "url": "https://teams.microsoft.com/l/message/...",
      "type": "message",
      "threadId": "19:thread_abc",
      "reactions": { "like": 3, "heart": 1 },
      "mentions": [{ "name": "Jane", "email": "jane@company.com" }],
      "attachments": [],
      "extractedAt": "2024-11-04T10:30:05.000Z",
      "createdAt": "2024-11-04T10:30:05.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Examples:**
```bash
# Get all messages
curl http://localhost:5000/api/messages

# Filter by channel
curl "http://localhost:5000/api/messages?channel=General"

# Filter by author and limit results
curl "http://localhost:5000/api/messages?author=John&limit=10"

# Date range query
curl "http://localhost:5000/api/messages?startDate=2024-11-01T00:00:00Z&endDate=2024-11-04T23:59:59Z"

# Pagination
curl "http://localhost:5000/api/messages?limit=50&offset=50"
```

---

### Get Single Message

Retrieve detailed information about a specific message.

```http
GET /api/messages/:id
```

**Path Parameters:**
- `id` (integer, required) - Message database ID

**Response (200 OK):**
```json
{
  "id": 123,
  "messageId": "19:abc123",
  "text": "Hello team, deployment is complete!",
  "author": "John Doe",
  "authorEmail": "john@company.com",
  "timestamp": "2024-11-04T10:30:00.000Z",
  "channel": "General",
  "url": "https://teams.microsoft.com/l/message/...",
  "type": "message",
  "threadId": "19:thread_abc",
  "reactions": [
    { "type": "like", "count": 3 }
  ],
  "mentions": [],
  "attachments": [],
  "extractedAt": "2024-11-04T10:30:05.000Z",
  "createdAt": "2024-11-04T10:30:05.000Z"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Message not found",
  "messageId": 123
}
```

**Example:**
```bash
curl http://localhost:5000/api/messages/123
```

---

### Search Messages

Full-text search across message content using PostgreSQL's search capabilities.

```http
GET /api/messages/search
```

**Query Parameters:**
- `q` (string, required) - Search query
- `channel` (string, optional) - Limit search to specific channel
- `author` (string, optional) - Limit search to specific author
- `limit` (integer, optional) - Number of results (default: 20, max: 100)

**Response (200 OK):**
```json
{
  "query": "deployment",
  "results": [
    {
      "id": 123,
      "text": "Hello team, deployment is complete!",
      "author": "John Doe",
      "channel": "General",
      "timestamp": "2024-11-04T10:30:00.000Z",
      "url": "https://teams.microsoft.com/l/message/...",
      "relevance": 0.95
    }
  ],
  "total": 15,
  "limit": 20
}
```

**Example:**
```bash
# Basic search
curl "http://localhost:5000/api/messages/search?q=deployment"

# Search in specific channel
curl "http://localhost:5000/api/messages/search?q=deployment&channel=DevOps"
```

---

### Delete Message

Delete a message from the database.

```http
DELETE /api/messages/:id
```

**Path Parameters:**
- `id` (integer, required) - Message database ID

**Response (200 OK):**
```json
{
  "success": true,
  "messageId": 123,
  "message": "Message deleted successfully"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Message not found",
  "messageId": 123
}
```

⚠️ **Warning:** Deletion is permanent and cannot be undone.

**Example:**
```bash
curl -X DELETE http://localhost:5000/api/messages/123
```

---

## Statistics Endpoints

### Dashboard Statistics

Get comprehensive statistics for the dashboard.

```http
GET /api/stats
```

**Response (200 OK):**
```json
{
  "totalMessages": 1543,
  "todayMessages": 47,
  "weekMessages": 312,
  "channels": 8,
  "uniqueSenders": 25,
  "messagesByChannel": [
    { "channel": "General", "count": 543 },
    { "channel": "DevOps", "count": 421 },
    { "channel": "Engineering", "count": 315 }
  ],
  "messagesByDay": [
    { "date": "2024-11-01", "count": 45 },
    { "date": "2024-11-02", "count": 52 },
    { "date": "2024-11-03", "count": 38 },
    { "date": "2024-11-04", "count": 47 }
  ],
  "topSenders": [
    { "author": "John Doe", "count": 125 },
    { "author": "Jane Smith", "count": 98 },
    { "author": "Bob Wilson", "count": 87 }
  ]
}
```

**Example:**
```bash
curl http://localhost:5000/api/stats
```

---

### Channel Statistics

Get detailed statistics for specific channels.

```http
GET /api/stats/channels
```

**Query Parameters:**
- `startDate` (ISO 8601, optional) - Start date for statistics
- `endDate` (ISO 8601, optional) - End date for statistics

**Response (200 OK):**
```json
{
  "channels": [
    {
      "name": "General",
      "messageCount": 543,
      "uniqueSenders": 18,
      "lastMessage": "2024-11-04T10:30:00.000Z",
      "averageMessagesPerDay": 15.2
    },
    {
      "name": "DevOps",
      "messageCount": 421,
      "uniqueSenders": 12,
      "lastMessage": "2024-11-04T09:15:00.000Z",
      "averageMessagesPerDay": 12.1
    }
  ],
  "dateRange": {
    "start": "2024-10-01T00:00:00.000Z",
    "end": "2024-11-04T23:59:59.000Z"
  }
}
```

**Example:**
```bash
curl http://localhost:5000/api/stats/channels

# With date range
curl "http://localhost:5000/api/stats/channels?startDate=2024-11-01T00:00:00Z&endDate=2024-11-04T23:59:59Z"
```

---

### Sender Statistics

Get statistics about message senders.

```http
GET /api/stats/senders
```

**Query Parameters:**
- `limit` (integer, optional) - Number of top senders to return (default: 10)
- `channel` (string, optional) - Filter by channel

**Response (200 OK):**
```json
{
  "senders": [
    {
      "author": "John Doe",
      "email": "john@company.com",
      "messageCount": 125,
      "channels": ["General", "DevOps", "Engineering"],
      "firstMessage": "2024-10-01T08:00:00.000Z",
      "lastMessage": "2024-11-04T10:30:00.000Z"
    }
  ],
  "totalSenders": 25
}
```

**Example:**
```bash
curl http://localhost:5000/api/stats/senders

# Top 5 senders in DevOps channel
curl "http://localhost:5000/api/stats/senders?limit=5&channel=DevOps"
```

---

### Timeline Statistics

Get time-series data for message volume.

```http
GET /api/stats/timeline
```

**Query Parameters:**
- `interval` (string, optional) - Time interval (`hour`, `day`, `week`, `month`) (default: `day`)
- `startDate` (ISO 8601, optional) - Start date
- `endDate` (ISO 8601, optional) - End date
- `channel` (string, optional) - Filter by channel

**Response (200 OK):**
```json
{
  "timeline": [
    {
      "period": "2024-11-01",
      "count": 45,
      "channels": {
        "General": 20,
        "DevOps": 15,
        "Engineering": 10
      }
    },
    {
      "period": "2024-11-02",
      "count": 52,
      "channels": {
        "General": 25,
        "DevOps": 17,
        "Engineering": 10
      }
    }
  ],
  "interval": "day",
  "total": 312
}
```

**Example:**
```bash
# Daily timeline for last 7 days
curl http://localhost:5000/api/stats/timeline

# Hourly timeline for today
curl "http://localhost:5000/api/stats/timeline?interval=hour&startDate=2024-11-04T00:00:00Z"
```

---

## Health & Monitoring

### Comprehensive Health Check

Get overall system health status.

```http
GET /api/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-04T10:30:00.000Z",
  "uptime": 345678,
  "version": "1.0.1",
  "services": {
    "postgresql": {
      "status": "healthy",
      "responseTime": 5,
      "connections": {
        "total": 20,
        "idle": 15,
        "active": 5
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "memory": {
        "used": "15.2 MB",
        "peak": "18.5 MB"
      }
    }
  },
  "memory": {
    "heapUsed": "125 MB",
    "heapTotal": "200 MB",
    "external": "5 MB"
  }
}
```

**Error Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-11-04T10:30:00.000Z",
  "services": {
    "postgresql": {
      "status": "unhealthy",
      "error": "Connection timeout"
    },
    "redis": {
      "status": "healthy"
    }
  }
}
```

**Example:**
```bash
curl http://localhost:5000/api/health
```

---

### Readiness Probe

Check if the service is ready to accept traffic (for Kubernetes/Docker orchestration).

```http
GET /api/health/ready
```

**Response (200 OK):**
```json
{
  "ready": true
}
```

**Response (503 Service Unavailable):**
```json
{
  "ready": false,
  "reason": "Database not connected"
}
```

**Example:**
```bash
curl http://localhost:5000/api/health/ready
```

---

### Liveness Probe

Check if the service is alive (for Kubernetes/Docker orchestration).

```http
GET /api/health/live
```

**Response (200 OK):**
```json
{
  "alive": true
}
```

**Example:**
```bash
curl http://localhost:5000/api/health/live
```

---

### Prometheus Metrics

Get metrics in Prometheus format.

```http
GET /api/health/metrics
```

**Response (200 OK):**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1543

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 1234
http_request_duration_seconds_bucket{le="0.5"} 1520
http_request_duration_seconds_bucket{le="1.0"} 1540
http_request_duration_seconds_sum 345.6
http_request_duration_seconds_count 1543

# HELP db_connections_total Database connection pool size
# TYPE db_connections_total gauge
db_connections_total{state="idle"} 15
db_connections_total{state="active"} 5
```

**Example:**
```bash
curl http://localhost:5000/api/health/metrics
```

---

## Extraction Management

### Trigger Manual Extraction

Manually trigger message extraction (for testing).

```http
POST /api/extraction/trigger
```

**Request Body:**
```json
{
  "channel": "General",
  "force": false
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "sessionId": "ext_1699091234567",
  "message": "Extraction triggered successfully"
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/extraction/trigger \
  -H "Content-Type: application/json" \
  -d '{"channel":"General"}'
```

---

### List Extraction Sessions

Get list of extraction sessions with their status.

```http
GET /api/extraction/sessions
```

**Query Parameters:**
- `limit` (integer, optional) - Number of sessions to return (default: 20)
- `status` (string, optional) - Filter by status (`active`, `completed`, `failed`)

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "sessionId": "ext_1699091234567",
      "status": "completed",
      "messagesProcessed": 47,
      "duplicates": 5,
      "failed": 0,
      "startedAt": "2024-11-04T10:25:00.000Z",
      "completedAt": "2024-11-04T10:30:00.000Z",
      "duration": 300000
    }
  ],
  "total": 156
}
```

**Example:**
```bash
curl http://localhost:5000/api/extraction/sessions

# Active sessions only
curl "http://localhost:5000/api/extraction/sessions?status=active"
```

---

### Get Active Extraction Session

Get currently active extraction session.

```http
GET /api/extraction/active
```

**Response (200 OK):**
```json
{
  "sessionId": "ext_1699091234567",
  "status": "active",
  "messagesProcessed": 23,
  "startedAt": "2024-11-04T10:28:00.000Z",
  "progress": {
    "current": 23,
    "target": 50,
    "percentage": 46
  }
}
```

**Response (404 Not Found) - No active session:**
```json
{
  "active": false,
  "message": "No active extraction session"
}
```

**Example:**
```bash
curl http://localhost:5000/api/extraction/active
```

---

### Update Extraction Session

Update the status of an extraction session.

```http
PATCH /api/extraction/sessions/:id
```

**Path Parameters:**
- `id` (string, required) - Session ID

**Request Body:**
```json
{
  "status": "completed",
  "messagesProcessed": 47
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "sessionId": "ext_1699091234567",
  "status": "completed"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:5000/api/extraction/sessions/ext_1699091234567 \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","messagesProcessed":47}'
```

---

## Data Models

### Message

```typescript
interface Message {
  id: number;                          // Database ID
  messageId: string;                   // Teams message ID (unique)
  text: string;                        // Message content
  author: string;                      // Author name
  authorEmail: string | null;          // Author email
  timestamp: string;                   // Message timestamp (ISO 8601)
  channel: string;                     // Channel name
  url: string | null;                  // Teams message URL
  type: string;                        // Message type (message, reply, system)
  threadId: string | null;             // Thread ID
  reactions: Reaction[];               // Array of reactions
  mentions: Mention[];                 // Array of mentions
  attachments: Attachment[];           // Array of attachments
  extractedAt: string;                 // Extraction timestamp
  createdAt: string;                   // Database creation timestamp
}
```

### Reaction

```typescript
interface Reaction {
  type: string;                        // Reaction type (like, heart, etc.)
  count: number;                       // Number of reactions
}
```

### Mention

```typescript
interface Mention {
  name: string;                        // Mentioned user name
  email: string;                       // Mentioned user email
}
```

### Attachment

```typescript
interface Attachment {
  type: string;                        // Attachment type (file, image, link)
  name: string;                        // Attachment name
  url: string;                         // Attachment URL
  size?: number;                       // File size in bytes
}
```

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "error": "Error description",
  "details": "Additional details (optional)",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `202 Accepted` - Request accepted for processing
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `DUPLICATE_MESSAGE` - Message already exists
- `DATABASE_ERROR` - Database operation failed
- `REDIS_ERROR` - Redis operation failed

**Example Error Responses:**

**Validation Error (422):**
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "messageId",
      "message": "messageId is required"
    }
  ],
  "code": "VALIDATION_ERROR"
}
```

**Not Found (404):**
```json
{
  "error": "Message not found",
  "messageId": 123,
  "code": "NOT_FOUND"
}
```

**Server Error (500):**
```json
{
  "error": "Internal server error",
  "message": "Database connection failed",
  "code": "DATABASE_ERROR"
}
```

---

## Rate Limiting

**Current Status:** No rate limiting implemented

**Future Implementation:**
- 100 requests/minute for read operations
- 20 requests/minute for write operations
- Rate limit headers will be included in responses

**Future Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699091300
```

---

## Examples

### Node.js/TypeScript

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Get dashboard statistics
async function getStats() {
  const response = await axios.get(`${API_BASE}/stats`);
  console.log(response.data);
}

// Search messages
async function searchMessages(query: string) {
  const response = await axios.get(`${API_BASE}/messages/search`, {
    params: { q: query }
  });
  return response.data.results;
}

// Ingest messages
async function ingestMessages(messages: any[]) {
  const response = await axios.post(`${API_BASE}/messages/batch`, {
    messages,
    extractionId: `ext_${Date.now()}`,
    metadata: {
      extensionVersion: '1.0.1'
    }
  });
  return response.data;
}

// Delete message
async function deleteMessage(id: number) {
  await axios.delete(`${API_BASE}/messages/${id}`);
}
```

### Python

```python
import requests

API_BASE = 'http://localhost:5000/api'

# Get dashboard statistics
def get_stats():
    response = requests.get(f'{API_BASE}/stats')
    return response.json()

# Search messages
def search_messages(query):
    response = requests.get(f'{API_BASE}/messages/search', params={'q': query})
    return response.json()['results']

# List messages with filters
def list_messages(channel=None, author=None, limit=50):
    params = {'limit': limit}
    if channel:
        params['channel'] = channel
    if author:
        params['author'] = author

    response = requests.get(f'{API_BASE}/messages', params=params)
    return response.json()['messages']

# Delete message
def delete_message(message_id):
    response = requests.delete(f'{API_BASE}/messages/{message_id}')
    return response.json()
```

### cURL

```bash
# Get all messages
curl http://localhost:5000/api/messages

# Search messages
curl "http://localhost:5000/api/messages/search?q=deployment"

# Get statistics
curl http://localhost:5000/api/stats

# Get message by ID
curl http://localhost:5000/api/messages/123

# Delete message
curl -X DELETE http://localhost:5000/api/messages/123

# Health check
curl http://localhost:5000/api/health

# Ingest messages
curl -X POST http://localhost:5000/api/messages/batch \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "messageId": "test_123",
      "channelName": "General",
      "content": "Test message",
      "sender": {"name": "Test User", "email": "test@example.com"},
      "timestamp": "2024-11-04T10:30:00Z",
      "type": "message"
    }],
    "extractionId": "test_extraction"
  }'
```

---

## WebSocket API

The backend also provides real-time updates via WebSocket using Socket.io.

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('newMessage', (message) => {
  console.log('New message received:', message);
});

socket.on('statsUpdate', (stats) => {
  console.log('Stats updated:', stats);
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});
```

### Events

- `newMessage` - Fired when a new message is ingested
- `statsUpdate` - Fired when statistics are updated
- `healthUpdate` - Fired when system health changes
- `extractionStart` - Fired when extraction session starts
- `extractionEnd` - Fired when extraction session ends

---

## Versioning

**Current Version:** v1 (unversioned endpoints)

**Future:** API versioning will be introduced with prefix `/api/v2/...`

---

## Support

For API support:
- Review this documentation
- Check [Troubleshooting Guide](TROUBLESHOOTING.md)
- Open GitHub issue
- Contact development team

---

**Document Version:** 2.0
**Last Updated:** November 2024
**API Version:** 1.0 (Chrome Extension Architecture)
