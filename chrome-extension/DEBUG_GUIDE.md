# Chrome Extension Debugging Guide

## Step 1: Reload the Extension

After updating the code, you **MUST** reload the extension:

1. Open Chrome and go to `chrome://extensions/`
2. Find "Teams Message Extractor"
3. Click the **Reload** button (circular arrow icon)

## Step 2: Open Developer Console

To see what the extension is doing:

1. Navigate to [https://teams.microsoft.com](https://teams.microsoft.com)
2. Open a channel or chat with messages
3. Press **F12** (or Cmd+Option+I on Mac) to open DevTools
4. Go to the **Console** tab
5. Look for messages starting with `[Teams Extractor]`

## Step 3: Check Extension Console Logs

You should see logs like:
```
[Teams Extractor] Initializing Teams Message Extractor v1.0.1
[Teams Extractor] URL: https://teams.microsoft.com/...
[Teams Extractor] Waiting for Teams to load... (attempt 1/30)
[Teams Extractor] ✓ Teams loaded, starting extraction
[Teams Extractor] Found 15 message elements
[Teams Extractor] ✓ Extracted 15 new messages
```

## Step 4: If No Messages Are Found

If you see:
```
[Teams Extractor] Found 0 message elements
[Teams Extractor] No messages found! Debugging info:
```

This means the DOM selectors don't match the current Teams UI. The debug output will show:
- Document body classes
- How many `[role="listitem"]` elements exist
- Potential message containers

**Send me this debug output** and I can update the selectors.

## Step 5: Test Extraction Manually

1. Click the extension icon (puzzle piece) in Chrome toolbar
2. Click on "Teams Message Extractor"
3. Click the **"Extract Now"** button
4. Watch the console for activity

## Step 6: Check Backend Connection

In the console, type:
```javascript
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(console.log)
```

You should see the health status. If you get a CORS error, the backend is not allowing the extension.

## Step 7: Test Manual Extraction

Try sending a test message directly:
```javascript
fetch('http://localhost:5000/api/messages/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{
      messageId: 'test_manual_' + Date.now(),
      channelName: 'Test Channel',
      content: 'Manual test from console',
      sender: { name: 'Test User', email: 'test@example.com' },
      timestamp: new Date().toISOString(),
      url: window.location.href,
      type: 'message'
    }],
    extractionId: 'manual_test'
  })
})
.then(r => r.json())
.then(console.log)
```

If this works, the backend is fine and the issue is with message extraction.

## Step 8: Inspect Teams DOM

To find the correct selectors:

1. Right-click on a message in Teams
2. Select "Inspect" (or "Inspect Element")
3. Look at the HTML structure
4. Find attributes like:
   - `role="listitem"`
   - `data-tid="..."`
   - Classes containing "message"

## Common Issues

### Extension Shows "0" Messages
- Extension not loaded on Teams page
- DOM selectors outdated
- Messages haven't loaded yet

### "Extract Now" Button Does Nothing
- Not on teams.microsoft.com page
- Content script not injected
- JavaScript errors in console

### Messages Not Saving
- Backend not running (`docker compose ps`)
- CORS blocking requests
- Redis marking all as duplicates

### Extension Icon Shows "!"
- Backend health check failed
- Check backend is running: `curl http://localhost:5000/api/health`

## Getting Help

If stuck, provide:
1. Screenshot of Chrome console logs
2. Output of debug info (Step 4)
3. Screenshot of Teams page structure (Step 8)
4. Extension popup showing message count
