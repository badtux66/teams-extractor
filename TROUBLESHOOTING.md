# Teams Message Extractor - Troubleshooting Guide

## Table of Contents
- [Chrome Extension Issues](#chrome-extension-issues)
- [Backend & Database Issues](#backend--database-issues)
- [MCP Server Issues](#mcp-server-issues)
- [Docker Issues](#docker-issues)
- [Common Error Messages](#common-error-messages)

---

## Chrome Extension Issues

### Issue: Queue Size Increasing, But Messages Not Being Extracted (Count = 0)

This is the most common issue where messages are detected but not sent to the backend.

#### Symptoms:
- Queue size keeps growing
- "Messages Extracted" counter stays at 0
- Badge shows number but messages aren't in database

#### Solutions:

1. **Check Backend Connection**
   ```javascript
   // Open Chrome DevTools Console on Teams page
   // You should see one of these messages:

   "🔧 BACKEND CONNECTION ISSUE DETECTED!"
   // This means the backend is unreachable

   "✅ Successfully sent X messages"
   // This means it's working
   ```

2. **Verify Backend is Running**
   ```bash
   # Check if Docker containers are running
   docker ps

   # You should see:
   # - teams-extractor-db
   # - teams-extractor-redis
   # - teams-extractor-backend
   # - teams-extractor-frontend

   # If not, start them:
   docker-compose up -d
   ```

3. **Check API URL Configuration**
   - Click extension icon → Settings
   - Verify API URL is: `http://localhost:5000/api`
   - NOT `https://` (unless you configured SSL)

4. **Force Flush Queue**
   - Click extension icon
   - Click "Force Flush Queue" (orange button)
   - Check console for errors

5. **Check for CORS Errors**
   ```javascript
   // In Chrome DevTools Console:
   // Look for errors like:
   "Access to fetch at 'http://localhost:5000/api/messages/batch' from origin 'chrome-extension://...' has been blocked by CORS policy"

   // Solution: Backend needs to allow Chrome extension origin
   ```

6. **Manual Debugging Steps**
   ```javascript
   // In Chrome DevTools Console on Teams page:

   // Check current status
   chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log)

   // Force send messages
   chrome.runtime.sendMessage({type: 'FORCE_FLUSH'}, console.log)

   // Clear stuck queue (last resort)
   chrome.runtime.sendMessage({type: 'CLEAR_QUEUE'}, console.log)
   ```

### Issue: Extension Not Detecting Messages

#### Solutions:

1. **Check Selectors Are Current**
   - Teams UI changes frequently
   - Open DevTools and inspect a message element
   - Check if it has `role="listitem"` or similar
   - Update selectors in content.js if needed

2. **Verify Extension is Loaded**
   ```javascript
   // Console should show:
   "[Teams Extractor] Initializing Teams Message Extractor v1.0.1"
   "[Teams Extractor] ✓ Teams loaded, starting extraction"
   ```

3. **Check for Extraction Logs**
   ```javascript
   // Enable verbose logging by adding to content.js:
   console.log('[Teams Extractor] Found elements:', document.querySelectorAll('[role="listitem"]').length);
   ```

### Issue: Extension Badge Shows Wrong Status

| Badge | Meaning | Action |
|-------|---------|--------|
| ✓ (green) | Extension ready | Normal state |
| Number (blue) | Messages extracted | Working correctly |
| ⏰ (orange) | Retrying send | Backend issue, will retry |
| ! (red) | Error occurred | Check popup for details |
| ⟳ (gray) | Loading | Wait for initialization |

---

## Backend & Database Issues

### Issue: Backend Won't Start

1. **Check Port Conflicts**
   ```bash
   # Check if port 5000 is in use
   lsof -i :5000

   # Kill process using port
   kill -9 <PID>
   ```

2. **Check Docker Logs**
   ```bash
   docker-compose logs backend
   ```

3. **Database Connection Issues**
   ```bash
   # Test database connection
   docker exec -it teams-extractor-db psql -U teams_admin -d teams_extractor -c "SELECT 1;"
   ```

### Issue: Messages Not Saving to Database

1. **Check Redis Connection**
   ```bash
   docker exec -it teams-extractor-redis redis-cli ping
   # Should return: PONG
   ```

2. **Check Database Permissions**
   ```sql
   -- Connect to database
   docker exec -it teams-extractor-db psql -U teams_admin -d teams_extractor

   -- Check table exists
   \dt teams.*

   -- Check permissions
   \dp teams.messages
   ```

3. **View Backend Logs for Errors**
   ```bash
   docker-compose logs -f backend | grep ERROR
   ```

---

## MCP Server Issues

### Issue: MCP Server Not Appearing in Claude Desktop

1. **Verify Installation**
   ```bash
   # Check config file exists
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Should contain:
   # "teams-extractor": { ... }
   ```

2. **Test MCP Server Directly**
   ```bash
   cd mcp-server
   npm test
   # or
   node test-connection.js
   ```

3. **Restart Claude Desktop**
   - Completely quit Claude Desktop (Cmd+Q on Mac)
   - Restart the application
   - Look for 🔨 icon

### Issue: MCP Tools Not Working

1. **Check Database Connection**
   ```bash
   # In mcp-server directory
   node test-connection.js
   ```

2. **Verify Environment Variables**
   ```bash
   cat mcp-server/.env
   # Should have: MCP_DATABASE_URL=postgresql://...
   ```

3. **Check Claude Desktop Logs**
   - Mac: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`
   - Linux: `~/.config/Claude/logs/`

---

## Docker Issues

### Issue: Containers Won't Start

1. **Check Docker Desktop is Running**
   ```bash
   docker version
   ```

2. **Clean and Rebuild**
   ```bash
   docker-compose down -v  # Warning: Deletes data
   docker-compose up -d --build
   ```

3. **Check Disk Space**
   ```bash
   docker system df
   docker system prune  # Clean unused resources
   ```

### Issue: Database Container Exits Immediately

1. **Check Logs**
   ```bash
   docker-compose logs db
   ```

2. **Common Causes:**
   - Port 5432 already in use
   - Volume permissions issue
   - Corrupted data directory

3. **Fix:**
   ```bash
   # Stop local PostgreSQL if running
   brew services stop postgresql  # Mac
   sudo systemctl stop postgresql  # Linux

   # Reset database volume
   docker-compose down
   docker volume rm teams-extractor_postgres_data
   docker-compose up -d
   ```

---

## Common Error Messages

### Chrome Extension Console

| Error | Meaning | Solution |
|-------|---------|----------|
| `Failed to fetch` | Cannot reach backend | Start backend, check URL |
| `CORS error` | CORS not configured | Backend needs to allow extension origin |
| `NetworkError` | Network issue | Check internet, firewall, proxy |
| `404 Not Found` | Wrong API endpoint | Update API URL in settings |
| `500 Internal Server Error` | Backend crashed | Check backend logs |

### Backend Logs

| Error | Meaning | Solution |
|-------|---------|----------|
| `ECONNREFUSED` | Database not reachable | Start database container |
| `password authentication failed` | Wrong DB credentials | Check .env file |
| `relation "messages" does not exist` | Tables not created | Run migrations |
| `Redis connection refused` | Redis not running | Start redis container |

### MCP Server Logs

| Error | Meaning | Solution |
|-------|---------|----------|
| `Cannot read properties of undefined` | No database URL | Set MCP_DATABASE_URL |
| `timeout expired` | Query too slow | Add indexes, optimize query |
| `permission denied` | DB user lacks privileges | Grant SELECT to mcp_reader |

---

## Quick Diagnostic Commands

```bash
# Full system check
./scripts/diagnose.sh

# Or manually:

# 1. Check all containers running
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. Test backend API
curl http://localhost:5000/api/health

# 3. Check database
docker exec -it teams-extractor-db psql -U teams_admin -d teams_extractor -c "SELECT COUNT(*) FROM teams.messages;"

# 4. Check Redis
docker exec -it teams-extractor-redis redis-cli ping

# 5. View recent logs
docker-compose logs --tail=50

# 6. Check Chrome extension (in DevTools console)
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log)
```

---

## Getting Help

If you're still experiencing issues:

1. **Collect Diagnostic Information:**
   ```bash
   # Run diagnostic script
   ./scripts/diagnose.sh > diagnostic.log 2>&1
   ```

2. **Check Existing Issues:**
   - GitHub Issues: https://github.com/yourusername/teams-extractor/issues

3. **Create New Issue with:**
   - Diagnostic log
   - Screenshots of error messages
   - Steps to reproduce
   - Browser and OS versions

4. **Join Community:**
   - Discord: [Invite Link]
   - Discussions: [GitHub Discussions]

---

## Prevention Tips

1. **Regular Maintenance:**
   - Update Chrome extension when Teams UI changes
   - Keep Docker images updated
   - Monitor disk space

2. **Monitoring:**
   - Check extension badge color regularly
   - Monitor queue size in popup
   - Review backend logs periodically

3. **Backups:**
   - Export messages regularly
   - Backup PostgreSQL database
   - Save configuration files

---

*Last updated: November 2024*