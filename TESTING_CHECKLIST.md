# Teams Message Extractor - Testing Checklist

## Pre-Test Setup
- [ ] Docker Desktop is running
- [ ] All containers are up: `docker-compose up -d`
- [ ] Chrome browser is open
- [ ] Terminal is ready for commands

---

## 1. Chrome Extension Queue Fix Testing

### Test A: Basic Message Extraction
1. [ ] Install/reload Chrome extension
2. [ ] Navigate to Teams web (teams.microsoft.com)
3. [ ] Open extension popup
4. [ ] Verify "Status: Active" (green indicator)
5. [ ] Open a Teams channel with messages
6. [ ] Wait 5 seconds for extraction
7. [ ] **Check popup shows:**
   - [ ] Queue Size increases
   - [ ] Messages Extracted counter increases (not stuck at 0)
   - [ ] Last Sync updates

### Test B: Queue Processing with Backend Down
1. [ ] Stop backend: `docker-compose stop backend`
2. [ ] Navigate to new Teams channel
3. [ ] Wait for message extraction
4. [ ] **Verify in popup:**
   - [ ] Queue Size increases
   - [ ] Status shows "Retrying..." (orange indicator)
   - [ ] Error message appears with retry count
5. [ ] **Check DevTools Console for:**
   ```
   🔧 BACKEND CONNECTION ISSUE DETECTED!
   ⏰ Will retry in X seconds (attempt Y/5)
   ```
6. [ ] Start backend: `docker-compose start backend`
7. [ ] **Within 30 seconds, verify:**
   - [ ] Messages are sent automatically
   - [ ] Extracted count increases
   - [ ] Queue size decreases to 0
   - [ ] Status returns to "Active" (green)

### Test C: Force Flush Function
1. [ ] Let queue build up (navigate to multiple channels)
2. [ ] Click "Force Flush Queue" button in popup
3. [ ] **Verify:**
   - [ ] Queue processes immediately
   - [ ] Success notification appears
   - [ ] Counter updates

### Test D: Retry Logic with Exponential Backoff
1. [ ] Stop backend: `docker-compose stop backend`
2. [ ] Extract messages to build queue
3. [ ] **Monitor retry delays in console:**
   - [ ] 1st retry: 1 second
   - [ ] 2nd retry: 2 seconds
   - [ ] 3rd retry: 4 seconds
   - [ ] 4th retry: 8 seconds
   - [ ] 5th retry: 16 seconds
   - [ ] After 5 retries: gives up and shows permanent error
4. [ ] Start backend and verify recovery

### Test E: Visual Status Indicators
1. [ ] **Badge colors display correctly:**
   - [ ] Green ✓ - Extension ready
   - [ ] Blue (number) - Messages extracted successfully
   - [ ] Orange ⏰ - Retrying
   - [ ] Red ! - Permanent error
2. [ ] **Popup status indicators:**
   - [ ] Green dot - Active
   - [ ] Orange dot - Retrying
   - [ ] Red dot - Error
   - [ ] Queue status text: "(sending...)", "(retry 2)", "(waiting)"

---

## 2. MCP Extension Installation Testing

### Test A: Clean Installation
1. [ ] Remove existing config:
   ```bash
   rm ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```
2. [ ] Run installation:
   ```bash
   cd mcp-server
   npm install
   npm run install-extension
   ```
3. [ ] **Verify prompts:**
   - [ ] Database URL prompt appears
   - [ ] Connection test passes
   - [ ] Config file created successfully
4. [ ] Restart Claude Desktop
5. [ ] **Check in Claude:**
   - [ ] 🔨 icon appears
   - [ ] "teams-extractor" listed in MCP tools
   - [ ] 6 tools available

### Test B: MCP Tools Functionality
1. [ ] In Claude Desktop, test each tool:

   **list_messages:**
   ```
   Use the list_messages tool to show me the latest 10 Teams messages
   ```
   - [ ] Returns message list
   - [ ] Includes sender, channel, timestamp

   **search_messages:**
   ```
   Search for messages containing the word "meeting"
   ```
   - [ ] Returns relevant results
   - [ ] Search is case-insensitive

   **get_statistics:**
   ```
   Show me Teams message statistics for the last 7 days
   ```
   - [ ] Returns message counts
   - [ ] Groups by channel/sender

   **get_message:**
   ```
   Get details for message ID [use an ID from list_messages]
   ```
   - [ ] Returns full message details
   - [ ] Includes all metadata

   **get_channel_summary:**
   ```
   Summarize activity in the "General" channel
   ```
   - [ ] Returns channel statistics
   - [ ] Shows active senders

   **get_sender_activity:**
   ```
   Analyze activity for sender "John Doe"
   ```
   - [ ] Returns sender patterns
   - [ ] Shows message distribution

### Test C: MCP Error Handling
1. [ ] Stop database: `docker-compose stop db`
2. [ ] Try using MCP tools in Claude
3. [ ] **Verify:**
   - [ ] Error message is user-friendly
   - [ ] Suggests checking database connection
4. [ ] Start database: `docker-compose start db`
5. [ ] Retry tool - should work

---

## 3. System Integration Testing

### Test A: End-to-End Message Flow
1. [ ] Open Teams web
2. [ ] Send a test message: "TEST_MESSAGE_[timestamp]"
3. [ ] Wait 10 seconds
4. [ ] **Verify message appears in:**
   - [ ] Extension popup (extracted count increases)
   - [ ] Dashboard at http://localhost:3000
   - [ ] Database: `docker exec -it teams-extractor-db psql -U teams_admin -d teams_extractor -c "SELECT * FROM teams.messages WHERE content LIKE '%TEST_MESSAGE%'"`
   - [ ] Claude Desktop (use list_messages tool)

### Test B: Performance Under Load
1. [ ] Navigate to busy Teams channel (100+ messages)
2. [ ] **Monitor:**
   - [ ] Extension extracts without freezing
   - [ ] Batch processing works (50 messages at a time)
   - [ ] No browser performance issues
3. [ ] Check dashboard shows all messages

### Test C: Recovery Testing
1. [ ] Simulate failures and verify recovery:
   - [ ] Kill backend during extraction → auto-retry works
   - [ ] Kill database → error displayed, recovers when restarted
   - [ ] Kill Redis → messages still save (deduplication disabled)
   - [ ] Browser crash → queue preserved on restart

---

## 4. Diagnostic Tools Testing

### Test A: Diagnostic Script
1. [ ] Run diagnostic script:
   ```bash
   ./scripts/diagnose.sh
   ```
2. [ ] **Verify output shows:**
   - [ ] Docker status ✓
   - [ ] All containers running ✓
   - [ ] Network services accessible ✓
   - [ ] Database connected with message count ✓
   - [ ] Extension files found ✓
   - [ ] MCP server configured ✓
   - [ ] Health score percentage

### Test B: Troubleshooting Scenarios
1. [ ] **Test each scenario in TROUBLESHOOTING.md:**
   - [ ] Queue stuck at 0 - Force flush resolves it
   - [ ] Backend unreachable - Clear error message
   - [ ] Database full - Appropriate error
   - [ ] MCP not appearing - Installation script fixes it

---

## 5. Edge Cases & Error Conditions

### Test A: Network Interruptions
1. [ ] Disconnect network briefly
2. [ ] Verify extension queues messages locally
3. [ ] Reconnect network
4. [ ] Verify automatic recovery and sending

### Test B: Large Message Handling
1. [ ] Find Teams message with:
   - [ ] Long text (1000+ characters)
   - [ ] Multiple attachments
   - [ ] Many reactions
   - [ ] Code blocks
2. [ ] Verify extraction handles correctly

### Test C: Concurrent Usage
1. [ ] Open Teams in multiple tabs
2. [ ] Verify no duplicate extractions
3. [ ] Check deduplication working

### Test D: Configuration Changes
1. [ ] Change API URL in extension settings
2. [ ] Verify error when wrong URL
3. [ ] Restore correct URL
4. [ ] Verify recovery

---

## Performance Metrics

Record these metrics after testing:

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| Time to extract 100 messages | < 10s | ___ | [ ] |
| Queue processing delay | < 2s | ___ | [ ] |
| Retry recovery time | < 30s | ___ | [ ] |
| MCP query response time | < 1s | ___ | [ ] |
| Dashboard load time | < 2s | ___ | [ ] |
| Memory usage (extension) | < 50MB | ___ | [ ] |
| Database query time | < 100ms | ___ | [ ] |

---

## Sign-off

- [ ] All tests passed
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] Documentation accurate
- [ ] Ready for production

**Tested by:** _________________
**Date:** _________________
**Version:** 1.0.1
**Environment:** _________________

---

## Notes & Issues Found

```
[Record any issues, observations, or improvements needed]




```

---

*Use this checklist for each major release or after significant changes*