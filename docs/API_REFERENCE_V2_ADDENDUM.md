# API Reference v2.0 - Addendum

## New Conversation Endpoints

This addendum documents the new conversation-related API endpoints added in v2.0.

### Table of Contents (New Sections)

3. **[Conversation Endpoints](#conversation-endpoints)** ← NEW
   - List Conversations
   - Get Conversation
   - Get Conversation Messages
   - Get Conversation Checkpoint
   - Get All Checkpoints
   - Get Conversation Statistics

### Updated Message Endpoint

The **POST /api/messages/batch** endpoint now accepts additional conversation fields.

---

## Updated: Bulk Message Ingestion

```http
POST /api/messages/batch
```

**New Request Fields (v2.0):**
```json
{
  "messages": [/* ... same as before ... */],
  "extractionId": "ext_1699091234567",
  "metadata": { /* ... */ },

  // NEW v2.0 fields:
  "conversationId": "19:abc123@thread.tacv2",
  "conversationName": "General",
  "conversationType": "channel",  // channel | chat | meeting | direct
  "teamId": "team_abc123",
  "teamName": "Engineering Team",
  "threadStructure": []
}
```

**Updated Response (v2.0):**
```json
{
  "success": true,
  "processed": 100,
  "new": 85,              // NEW: Count of new messages
  "inserted": 85,
  "duplicates": 15,       // NEW: Count of duplicate messages
  "errors": 0,
  "processingTime": 156,
  "extractionId": "ext_1699091234567",
  "conversationId": "19:abc123@thread.tacv2"  // NEW
}
```

**Key Changes:**
- `new`: Number of messages not previously seen (based on hash)
- `duplicates`: Number of messages already in database
- `conversationId`: Returns the conversation this batch was associated with

---

## Conversation Endpoints

### List All Conversations

Get a list of all conversations (channels, chats, meetings) with message counts.

```http
GET /api/conversations
```

**Query Parameters:**
- `type` (string, optional) - Filter by conversation type:
  - `channel` - Team channels
  - `chat` - Group chats
  - `meeting` - Meeting chats
  - `direct` - Direct messages
- `limit` (integer, optional) - Results per page (default: 100)
- `offset` (integer, optional) - Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "19:abc123@thread.tacv2",
      "name": "General",
      "type": "channel",
      "team_id": "team_abc123",
      "team_name": "Engineering Team",
      "description": null,
      "participants": [],
      "last_activity": "2025-01-15T14:30:00.000Z",
      "message_count": 543,
      "unread_count": 0,
      "metadata": {},
      "created_at": "2025-01-10T08:00:00.000Z",
      "updated_at": "2025-01-15T14:30:00.000Z",
      "actual_message_count": 543,
      "latest_message_time": "2025-01-15T14:30:00.000Z",
      "earliest_message_time": "2025-01-10T08:15:00.000Z"
    },
    {
      "id": "19:xyz789@thread.tacv2",
      "name": "DevOps",
      "type": "channel",
      "team_id": "team_abc123",
      "team_name": "Engineering Team",
      "last_activity": "2025-01-15T13:45:00.000Z",
      "message_count": 421,
      "actual_message_count": 421,
      "latest_message_time": "2025-01-15T13:45:00.000Z"
    }
  ],
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

**Examples:**
```bash
# Get all conversations
curl http://localhost:5000/api/conversations

# Get only channels
curl "http://localhost:5000/api/conversations?type=channel"

# Pagination
curl "http://localhost:5000/api/conversations?limit=10&offset=10"
```

---

### Get Single Conversation

Get detailed information about a specific conversation.

```http
GET /api/conversations/:id
```

**Path Parameters:**
- `id` (string, required) - Conversation ID

**Response (200 OK):**
```json
{
  "success": true,
  "conversation": {
    "id": "19:abc123@thread.tacv2",
    "name": "General",
    "type": "channel",
    "team_id": "team_abc123",
    "team_name": "Engineering Team",
    "description": "Main team communication channel",
    "participants": ["user1@company.com", "user2@company.com"],
    "last_activity": "2025-01-15T14:30:00.000Z",
    "message_count": 543,
    "unread_count": 0,
    "metadata": {
      "archived": false,
      "favorite": true
    },
    "created_at": "2025-01-10T08:00:00.000Z",
    "updated_at": "2025-01-15T14:30:00.000Z",
    "actual_message_count": 543,
    "latest_message_time": "2025-01-15T14:30:00.000Z"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Conversation not found"
}
```

**Examples:**
```bash
curl http://localhost:5000/api/conversations/19:abc123@thread.tacv2
```

---

### Get Conversation Messages

Get messages for a specific conversation, with optional threading.

```http
GET /api/conversations/:id/messages
```

**Path Parameters:**
- `id` (string, required) - Conversation ID

**Query Parameters:**
- `limit` (integer, optional) - Results per page (default: 100)
- `offset` (integer, optional) - Pagination offset (default: 0)
- `orderBy` (string, optional) - Sort field: `timestamp`, `created_at`, `sender_name` (default: `timestamp`)
- `orderDir` (string, optional) - Sort direction: `ASC` or `DESC` (default: `ASC`)
- `threaded` (boolean, optional) - Return threaded structure (default: `false`)

**Response (200 OK) - Flat View:**
```json
{
  "success": true,
  "conversationId": "19:abc123@thread.tacv2",
  "messages": [
    {
      "id": 123,
      "message_id": "msg_abc123",
      "conversation_id": "19:abc123@thread.tacv2",
      "content": "Hello team!",
      "sender_id": "user_123",
      "sender_name": "John Doe",
      "sender_email": "john@company.com",
      "timestamp": "2025-01-15T10:00:00.000Z",
      "url": "https://teams.microsoft.com/l/message/...",
      "type": "message",
      "thread_id": null,
      "parent_message_id": null,
      "reply_count": 2,
      "attachments": [],
      "reactions": [],
      "metadata": {},
      "message_hash": "abc123def456...",
      "first_extracted_at": "2025-01-15T10:01:00.000Z",
      "extraction_count": 1,
      "created_at": "2025-01-15T10:01:00.000Z",
      "updated_at": "2025-01-15T10:01:00.000Z"
    }
  ],
  "total": 543,
  "limit": 100,
  "offset": 0,
  "conversation": {
    "id": "19:abc123@thread.tacv2",
    "name": "General",
    "type": "channel"
  }
}
```

**Response (200 OK) - Threaded View (`?threaded=true`):**
```json
{
  "success": true,
  "conversationId": "19:abc123@thread.tacv2",
  "threads": [
    {
      "id": 123,
      "message_id": "msg_abc123",
      "content": "Hello team!",
      "sender_name": "John Doe",
      "timestamp": "2025-01-15T10:00:00.000Z",
      "reply_count": 2,
      "replies": [
        {
          "id": 124,
          "message_id": "msg_abc124",
          "content": "Hi John!",
          "sender_name": "Jane Smith",
          "timestamp": "2025-01-15T10:05:00.000Z",
          "parent_message_id": "msg_abc123",
          "replies": []
        },
        {
          "id": 125,
          "message_id": "msg_abc125",
          "content": "Welcome back!",
          "sender_name": "Bob Wilson",
          "timestamp": "2025-01-15T10:10:00.000Z",
          "parent_message_id": "msg_abc123",
          "replies": []
        }
      ]
    }
  ],
  "threadCount": 1,
  "total": 543,
  "limit": 100,
  "offset": 0,
  "conversation": {
    "id": "19:abc123@thread.tacv2",
    "name": "General"
  }
}
```

**Examples:**
```bash
# Get messages (flat)
curl http://localhost:5000/api/conversations/19:abc123@thread.tacv2/messages

# Get messages (threaded)
curl "http://localhost:5000/api/conversations/19:abc123@thread.tacv2/messages?threaded=true"

# Pagination and sorting
curl "http://localhost:5000/api/conversations/19:abc123@thread.tacv2/messages?limit=50&offset=0&orderBy=timestamp&orderDir=DESC"
```

---

### Get Conversation Checkpoint

Get the extraction checkpoint for a conversation (last extraction progress).

```http
GET /api/conversations/:id/checkpoint
```

**Path Parameters:**
- `id` (string, required) - Conversation ID

**Response (200 OK):**
```json
{
  "success": true,
  "checkpoint": {
    "conversation_id": "19:abc123@thread.tacv2",
    "last_message_id": "msg_xyz789",
    "last_message_timestamp": "2025-01-15T14:30:00.000Z",
    "last_extraction_timestamp": "2025-01-15T14:35:00.000Z",
    "total_extracted": 543,
    "messages_since_last": 5,
    "status": "active",
    "metadata": {}
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Checkpoint not found"
}
```

**Examples:**
```bash
curl http://localhost:5000/api/conversations/19:abc123@thread.tacv2/checkpoint
```

---

### Get All Checkpoints

Get extraction checkpoints for all conversations.

```http
GET /api/conversations/checkpoints/all
```

**Response (200 OK):**
```json
{
  "success": true,
  "checkpoints": [
    {
      "conversation_id": "19:abc123@thread.tacv2",
      "last_message_id": "msg_xyz789",
      "last_message_timestamp": "2025-01-15T14:30:00.000Z",
      "last_extraction_timestamp": "2025-01-15T14:35:00.000Z",
      "total_extracted": 543,
      "messages_since_last": 5,
      "status": "active",
      "metadata": {},
      "conversation_name": "General",
      "conversation_type": "channel",
      "team_name": "Engineering Team"
    },
    {
      "conversation_id": "19:xyz789@thread.tacv2",
      "last_message_id": "msg_abc456",
      "last_message_timestamp": "2025-01-15T13:45:00.000Z",
      "last_extraction_timestamp": "2025-01-15T13:50:00.000Z",
      "total_extracted": 421,
      "messages_since_last": 3,
      "status": "active",
      "conversation_name": "DevOps",
      "conversation_type": "channel"
    }
  ],
  "total": 2
}
```

**Examples:**
```bash
curl http://localhost:5000/api/conversations/checkpoints/all
```

---

### Get Conversation Statistics

Get analytics and statistics about conversations.

```http
GET /api/conversations/stats/summary
```

**Response (200 OK):**
```json
{
  "success": true,
  "byType": [
    {
      "type": "channel",
      "count": 8,
      "total_messages": 3542,
      "most_recent_activity": "2025-01-15T14:30:00.000Z"
    },
    {
      "type": "chat",
      "count": 5,
      "total_messages": 1243,
      "most_recent_activity": "2025-01-15T12:15:00.000Z"
    },
    {
      "type": "meeting",
      "count": 3,
      "total_messages": 156,
      "most_recent_activity": "2025-01-14T16:00:00.000Z"
    }
  ],
  "overall": {
    "total_conversations": 16,
    "total_messages": 4941,
    "avg_messages_per_conversation": "308.8125",
    "active_last_week": 12,
    "active_last_month": 16
  },
  "mostActive": [
    {
      "id": "19:abc123@thread.tacv2",
      "name": "General",
      "type": "channel",
      "message_count": 543,
      "last_activity": "2025-01-15T14:30:00.000Z",
      "team_name": "Engineering Team"
    },
    {
      "id": "19:xyz789@thread.tacv2",
      "name": "DevOps",
      "type": "channel",
      "message_count": 421,
      "last_activity": "2025-01-15T13:45:00.000Z",
      "team_name": "Engineering Team"
    }
  ]
}
```

**Examples:**
```bash
curl http://localhost:5000/api/conversations/stats/summary
```

---

## Updated Data Models

### Conversation

```typescript
interface Conversation {
  id: string;                          // Conversation ID (from Teams)
  name: string;                        // Display name
  type: 'channel' | 'chat' | 'meeting' | 'direct';
  team_id: string | null;              // Parent team ID
  team_name: string | null;            // Parent team name
  description: string | null;          // Conversation description
  participants: string[];              // Participant emails (for chats)
  last_activity: string;               // Last message timestamp
  message_count: number;               // Count of messages
  unread_count: number;                // Unread message count
  metadata: Record<string, any>;       // Additional metadata
  created_at: string;                  // Created timestamp
  updated_at: string;                  // Updated timestamp
}
```

### Message (Updated)

```typescript
interface Message {
  // ... existing fields ...

  // NEW v2.0 fields:
  conversation_id: string | null;      // Reference to conversation
  message_hash: string;                // SHA-256 hash for deduplication
  first_extracted_at: string;          // When first extracted
  extraction_count: number;            // How many times extracted
  parent_message_id: string | null;    // Parent message for replies
  reply_count: number;                 // Number of replies
}
```

### ExtractionCheckpoint

```typescript
interface ExtractionCheckpoint {
  conversation_id: string;             // FK to conversation
  last_message_id: string;             // Last message extracted
  last_message_timestamp: string;      // Timestamp of last message
  last_extraction_timestamp: string;   // When extraction happened
  total_extracted: number;             // Total messages extracted
  messages_since_last: number;         // Messages in last extraction
  status: string;                      // active | paused | completed
  metadata: Record<string, any>;       // Additional data
}
```

---

## Migration from v1 to v2

### Breaking Changes

None! All existing v1 endpoints continue to work unchanged.

### New Behavior

**POST /api/messages/batch**:
- Now accepts conversation fields (optional)
- Returns `new` and `duplicates` counts
- Automatic deduplication via hash

### Recommendations

1. **Update Chrome Extension** to send conversation data:
   ```javascript
   {
     messages: [...],
     conversationId: "19:abc...",
     conversationName: "General",
     conversationType: "channel"
   }
   ```

2. **Use New Endpoints** for conversation-based views:
   - Replace message lists with conversation lists
   - Use threaded views for better UX

3. **Monitor Checkpoints** to track extraction progress

4. **Leverage Deduplication** - response now shows:
   - `new`: Messages added to database
   - `duplicates`: Messages skipped (already existed)

---

## Examples

### Complete Workflow

```bash
# 1. List all conversations
curl http://localhost:5000/api/conversations

# 2. Get messages for a conversation (threaded)
curl "http://localhost:5000/api/conversations/19:abc123@thread.tacv2/messages?threaded=true&limit=50"

# 3. Check extraction progress
curl http://localhost:5000/api/conversations/19:abc123@thread.tacv2/checkpoint

# 4. Get conversation statistics
curl http://localhost:5000/api/conversations/stats/summary

# 5. Extract new messages (from Chrome extension)
curl -X POST http://localhost:5000/api/messages/batch \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [...],
    "conversationId": "19:abc123@thread.tacv2",
    "conversationName": "General",
    "conversationType": "channel",
    "extractionId": "ext_123"
  }'

# Response will show:
# {
#   "new": 10,         // 10 messages added
#   "duplicates": 5    // 5 messages skipped (already in DB)
# }
```

---

## Performance Notes

- Conversation lists are cached for 60 seconds (Redis)
- Message queries support pagination (use `limit` and `offset`)
- Threaded views build hierarchy in-memory (may be slower for large conversations)
- Checkpoints are lightweight and fast to query

---

**Addendum Version:** 2.0
**Last Updated:** January 2025
**Relates to API Version:** 2.0

