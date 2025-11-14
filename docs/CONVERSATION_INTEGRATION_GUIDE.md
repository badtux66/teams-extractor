# Conversation Integration Guide

This document explains how to integrate the ConversationManager into content.js for the Teams Message Extractor v2.0.

## Overview

The ConversationManager provides:
- Automatic conversation detection from URL and page content
- Message deduplication tracking (prevents re-extracting messages)
- Per-conversation checkpoint tracking (resume where you left off)
- Persistent state across browser sessions

## Integration Steps

### 1. Initialize ConversationManager

Add this after the configuration section (around line 66):

```javascript
// Initialize Conversation Manager
const conversationManager = new ConversationManager();
conversationManager.initialize().catch(err =>
  console.error('[Teams Extractor] Failed to initialize conversation manager:', err)
);

// Message queue
let messageQueue = [];
let lastExtractTime = Date.now();
let isExtracting = false;
let isSending = false;
let retryCount = 0;
let maxRetries = 5;
let retryDelay = 1000;
let extractedMessagesCount = 0;
let currentConversationId = null; // NEW: Track current conversation
```

### 2. Update extractVisibleMessages()

Modify the `extractVisibleMessages()` function (starting at line 366) to detect conversation and filter duplicates:

```javascript
function extractVisibleMessages() {
  if (!config.enabled || isExtracting) {
    console.log('Extraction skipped:', { enabled: config.enabled, isExtracting });
    return;
  }

  isExtracting = true;
  const messages = [];

  try {
    // DETECT CURRENT CONVERSATION
    const conversation = conversationManager.detectCurrentConversation();
    if (conversation) {
      console.log('[Teams Extractor] Conversation detected:', conversation.name);
      currentConversationId = conversation.id;
    }

    // Find all message elements using flexible selectors
    const messageElements = querySelectorAll(document, SELECTORS.messageItem);

    console.log(`[Teams Extractor] Found ${messageElements.length} message elements`);
    console.log(`[Teams Extractor] Current URL: ${window.location.href}`);
    console.log(`[Teams Extractor] Channel: ${extractChannelName()}`);

    messageElements.forEach(element => {
      // Skip if already processed (check data attribute)
      if (element.getAttribute('data-extracted') === 'true') {
        return;
      }

      const message = extractMessageData(element);
      if (message) {
        // CHECK IF MESSAGE IS ALREADY EXTRACTED
        if (!conversationManager.isMessageExtracted(message.id)) {
          messages.push(message);
          conversationManager.markMessageExtracted(message.id);
          element.setAttribute('data-extracted', 'true');
        } else {
          console.log(`[Teams Extractor] Skipping duplicate message: ${message.id}`);
        }
      }
    });

    if (messages.length > 0) {
      console.log(`[Teams Extractor] ✓ Extracted ${messages.length} new messages`);
      console.log('Sample message:', messages[0]);
      messageQueue.push(...messages);

      // Send batch if queue is large enough
      if (messageQueue.length >= config.batchSize) {
        sendMessages();
      }
    } else {
      console.log('[Teams Extractor] No new messages to extract');
    }
  } catch (error) {
    console.error('[Teams Extractor] Error extracting messages:', error);
  } finally {
    isExtracting = false;
  }
}
```

### 3. Update sendMessages()

Modify the `sendMessages()` function (starting at line 457) to include conversation data:

```javascript
async function sendMessages() {
  if (messageQueue.length === 0 || isSending) {
    return;
  }

  isSending = true;
  const batch = messageQueue.splice(0, config.batchSize);

  console.log(`[Teams Extractor] Attempting to send ${batch.length} messages to backend...`);

  // Transform messages to backend format
  const transformedMessages = batch.map(transformMessage);

  // Get or create extraction ID
  let extractionId = sessionStorage.getItem('extractionId');
  if (!extractionId) {
    extractionId = generateId();
    sessionStorage.setItem('extractionId', extractionId);
  }

  // GET CURRENT CONVERSATION INFO
  const conversation = conversationManager.currentConversation;

  try {
    const result = await dispatchBatchToBackground({
      messages: transformedMessages,
      extractionId,
      // ADD CONVERSATION DATA
      conversationId: conversation?.id || null,
      conversationName: conversation?.name || extractChannelName(),
      conversationType: conversation?.type || 'channel',
      teamId: conversation?.teamId || null,
      teamName: conversation?.teamName || null,
      metadata: {
        userAgent: navigator.userAgent,
        teamsUrl: window.location.href,
        timestamp: new Date().toISOString(),
        conversationDetected: !!conversation
      }
    });

    console.log(`✅ Successfully sent ${batch.length} messages:`, result);

    // UPDATE CHECKPOINT
    if (conversation) {
      conversationManager.updateCheckpoint(conversation.id, batch);
      console.log('[Teams Extractor] Checkpoint updated for:', conversation.name);
    }

    // Update local counter
    extractedMessagesCount += batch.length;
    retryCount = 0;
    retryDelay = 1000;

    // Notify background script
    safeSendMessage({
      type: 'MESSAGES_SENT',
      count: batch.length,
      inserted: result?.inserted || batch.length,
      duplicates: result?.duplicates || 0,
      totalExtracted: extractedMessagesCount,
      conversationId: conversation?.id
    });

    // Send remaining messages if any
    if (messageQueue.length > 0) {
      setTimeout(() => sendMessages(), 100);
    }
  } catch (error) {
    console.error('❌ Failed to deliver messages:', error);

    // ... rest of error handling code ...

    // Re-add to queue for retry
    messageQueue.unshift(...batch);
    const detailSnippet = error.details ? String(error.details).slice(0, 400) : null;
    const detailMessage = detailSnippet ? `${error.message}: ${detailSnippet}` : error.message;
    handleSendFailure(batch, detailMessage);
  } finally {
    isSending = false;
  }
}
```

### 4. Add Conversation Status to Message Listener

Update the `GET_STATUS` handler (around line 644) to include conversation info:

```javascript
} else if (message.type === 'GET_STATUS') {
  const conversation = conversationManager.currentConversation;
  const stats = conversationManager.getStats();

  sendResponse({
    queueSize: messageQueue.length,
    enabled: config.enabled,
    channel: extractChannelName(),
    isExtracting: isExtracting,
    isSending: isSending,
    extractedCount: extractedMessagesCount,
    retryCount: retryCount,
    apiUrl: config.apiUrl,
    // NEW: Conversation data
    conversation: conversation,
    conversationStats: stats,
    checkpoint: conversation ? conversationManager.getCheckpoint(conversation.id) : null
  });
}
```

### 5. Add Checkpoint Management Commands

Add new message handlers for managing checkpoints:

```javascript
} else if (message.type === 'GET_STATS') {
  const stats = conversationManager.getStats();
  sendResponse({
    success: true,
    stats: stats
  });
} else if (message.type === 'CLEAR_STATE') {
  conversationManager.clearState()
    .then(() => {
      extractedMessagesCount = 0;
      sendResponse({ success: true });
    })
    .catch(err => {
      sendResponse({ success: false, error: err.message });
    });
  return true; // Keep message channel open for async response
}
```

## How It Works

### 1. Conversation Detection

When a user navigates to a Teams conversation, the ConversationManager:

1. Analyzes the URL to determine conversation type (channel, chat, meeting, direct)
2. Extracts conversation ID from URL path
3. Finds conversation name from page header elements
4. Detects team information if applicable
5. Caches this information for the session

**Example:**

URL: `https://teams.microsoft.com/l/channel/19%3a...@thread.tacv2/General?groupId=...`

Detected as:
```json
{
  "id": "19:...@thread.tacv2",
  "name": "General",
  "type": "channel",
  "teamId": "abc123...",
  "teamName": "Engineering Team"
}
```

### 2. Deduplication

**In-Memory Deduplication (ConversationManager):**
- Tracks message IDs in a Set
- Persists to Chrome storage
- Survives page refreshes

**Database Deduplication (Backend):**
- Generates SHA-256 hash of: `channelId|senderId|timestamp|content`
- Checks database for existing hash
- Only inserts messages with new hashes

**Result:** Messages extracted multiple times (e.g., scrolling, refreshing) are only stored once.

### 3. Checkpoint System

After successfully sending messages, the system:

1. Finds the latest message by timestamp
2. Stores: `lastMessageId`, `lastTimestamp`, `totalExtracted`
3. Saves to Chrome storage
4. Backend also tracks checkpoints in database

**Future Enhancement:** Can be used to implement "extract only new messages since last time" by filtering based on checkpoint timestamp.

### 4. State Persistence

All state is saved to `chrome.storage.local`:

```javascript
{
  "extractionState": {
    "extractedMessageIds": ["msg_1", "msg_2", ...],
    "checkpoints": {
      "19:abc@thread.tacv2": {
        "lastMessageId": "msg_100",
        "lastTimestamp": "2025-01-15T10:30:00Z",
        "totalExtracted": 250
      }
    },
    "lastSaved": "2025-01-15T10:35:00Z",
    "version": "2.0"
  }
}
```

## Testing

### 1. Test Conversation Detection

1. Navigate to different Teams pages
2. Open browser console
3. Look for: `[ConversationManager] Detected conversation:` logs
4. Verify conversation type (channel/chat/meeting/direct)

### 2. Test Deduplication

1. Extract messages from a channel
2. Scroll to refresh messages
3. Check console for: `[Teams Extractor] Skipping duplicate message:`
4. Verify backend shows `duplicates: X` in response

### 3. Test Checkpoints

1. Extract messages
2. Check: `conversationManager.getStats()` in console
3. Verify `totalExtracted` increases
4. Refresh page
5. Verify state persists (check stats again)

### 4. Test State Persistence

```javascript
// In console:
conversationManager.getStats()
// Should show extracted count

// Refresh page, then:
conversationManager.getStats()
// Should show same count (state persisted)

// To clear:
conversationManager.clearState()
```

## Backend API Changes

The batch endpoint now accepts:

```typescript
POST /api/messages/batch
{
  "messages": Message[],
  "extractionId": string,
  "conversationId": string,          // NEW
  "conversationName": string,        // NEW
  "conversationType": string,        // NEW: channel|chat|meeting|direct
  "teamId": string,                  // NEW
  "teamName": string,                // NEW
  "metadata": object
}
```

Response includes:

```json
{
  "success": true,
  "processed": 50,
  "new": 45,              // NEW: Messages not seen before
  "inserted": 45,
  "duplicates": 5,        // NEW: Messages already in DB
  "errors": 0,
  "conversationId": "19:abc@thread.tacv2"
}
```

## Troubleshooting

### Issue: Conversation not detected

**Check:**
- Console logs for conversation detection
- URL pattern matches in `ConversationManager.typePatterns`
- Page has loaded conversation header

### Issue: All messages marked as duplicates

**Solution:**
```javascript
conversationManager.clearState()
```

### Issue: State not persisting

**Check:**
- Chrome storage permissions in manifest
- Console errors related to `chrome.storage.local`
- Storage quota not exceeded

## Performance Considerations

1. **Memory Usage:** The `extractedMessageIds` Set grows over time. Consider periodic cleanup of old IDs.

2. **Storage Usage:** Chrome local storage has limits (~10MB). Monitor state size.

3. **Checkpoint Efficiency:** Only update checkpoints after successful backend send, not on every message.

4. **Hash Generation:** SHA-256 hashing is fast but done for every message. This is acceptable for typical batch sizes (50-100 messages).

## Future Enhancements

1. **Incremental Extraction:** Use checkpoints to extract only messages newer than `lastTimestamp`

2. **Smart Scrolling:** Automatically scroll to load more messages until checkpoint is reached

3. **Multi-Conversation Tracking:** Track extraction across multiple conversations in parallel

4. **Offline Queue:** Store messages locally when backend is unavailable

5. **Compression:** Compress state before storing to save space

## Migration Notes

**From v1.x to v2.0:**

1. Old extractions will re-extract messages (one-time)
2. After first extraction, deduplication prevents duplicates
3. Existing database messages get hashes backfilled via migration
4. No data loss, just potential one-time duplication

**Recommended Migration:**
```sql
-- Run migration to add new fields
\i init-scripts/02-conversations-migration.sql

-- Backfill message hashes for existing data
SELECT teams.backfill_message_hashes();
```

