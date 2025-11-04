# Teams Message Extractor - Troubleshooting Guide

## Table of Contents
1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Backend Issues](#backend-issues)
4. [Frontend Issues](#frontend-issues)
5. [Browser Extension Issues](#browser-extension-issues)
6. [Database Issues](#database-issues)
7. [Integration Issues](#integration-issues)
8. [Performance Issues](#performance-issues)
9. [Getting Help](#getting-help)

## Quick Diagnostics

Run these commands to quickly diagnose issues:

```bash
# Check all services are running
docker-compose ps

# Check system health
curl http://localhost:8090/health

# Check frontend is accessible
curl http://localhost:3000

# View recent logs
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend

# Check database
ls -lh data/teams_messages.db
sqlite3 data/teams_messages.db "SELECT COUNT(*) FROM messages;"
```

## Common Issues

### Issue: Cannot access web GUI at http://localhost:3000

**Symptoms**:
- Browser shows "Connection refused" or "Unable to connect"
- Page doesn't load

**Diagnosis**:
```bash
# Check if frontend container is running
docker-compose ps frontend

# Check frontend logs
docker-compose logs frontend
```

**Solutions**:

1. **Frontend not started**:
```bash
docker-compose up -d frontend
```

2. **Port already in use**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process or change port in docker-compose.yml
```

3. **Build failed**:
```bash
# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

---

### Issue: Backend API returns 500 errors

**Symptoms**:
- GUI shows "Failed to load data"
- API endpoints return 500 Internal Server Error

**Diagnosis**:
```bash
# Check backend logs
docker-compose logs backend | tail -100

# Test health endpoint
curl http://localhost:5000/api/health
```

**Solutions**:

1. **Missing environment variables**:
```bash
# Check .env file exists
cat .env

# Ensure required variables are set
grep OPENAI_API_KEY .env
grep N8N_WEBHOOK_URL .env
```

2. **Invalid OpenAI API key**:
```bash
# Test key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

3. **Database corrupted**:
```bash
# Check database integrity
sqlite3 data/teams_messages.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
cp /backups/messages_latest.db data/teams_messages.db
```

---

### Issue: Messages stuck in "received" status

**Symptoms**:
- Messages appear in database but never get processed
- Status stays at "received"

**Diagnosis**:
```bash
# Check for processing errors
sqlite3 data/teams_messages.db \
  "SELECT id, author, status, error FROM messages WHERE status='received';"

# Check backend logs
docker-compose logs backend | grep -i error
```

**Solutions**:

1. **OpenAI API issues**:
```bash
# Verify API key
echo $OPENAI_API_KEY

# Check OpenAI status: https://status.openai.com
```

2. **Agent processing error**:
```bash
# Check for detailed errors
docker-compose logs backend | grep "AgentError"
```

3. **Retry processing**:
```bash
# Use GUI to retry or via API
curl -X POST http://localhost:8090/messages/{id}/retry
```

---

### Issue: n8n not receiving webhooks

**Symptoms**:
- Messages reach "processed" status but not "forwarded"
- n8n workflow not triggered

**Diagnosis**:
```bash
# Check n8n connection
curl http://localhost:8090/health | jq '.n8n_connected'

# Check message status
sqlite3 data/teams_messages.db \
  "SELECT status, n8n_response_code, error FROM messages ORDER BY id DESC LIMIT 10;"
```

**Solutions**:

1. **Wrong webhook URL**:
```bash
# Verify URL in .env
grep N8N_WEBHOOK_URL .env

# Test webhook manually
curl -X POST $N8N_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

2. **n8n workflow not active**:
- Open n8n
- Check workflow is activated (toggle should be ON)
- Verify webhook node is configured

3. **Network connectivity**:
```bash
# Test connectivity
ping your-n8n-instance.com

# Try direct webhook call
curl -v $N8N_WEBHOOK_URL
```

---

### Issue: Extension not capturing messages

**Symptoms**:
- Teams messages not appearing in system
- Extension logs show no activity

**Diagnosis**:
```bash
# Check extension is loaded
# Open chrome://extensions and verify it's enabled

# Check extension console for errors
# Right-click extension icon → Inspect views: service worker
```

**Solutions**:

1. **Wrong channel configured**:
- Open extension options
- Verify channel name matches exactly
- Case-sensitive: "Güncelleme Planlama"

2. **Trigger keywords not matching**:
- Check message contains exact keyword
- Default: "Güncellendi", "Yaygınlaştırıldı"
- Add custom keywords in extension options

3. **Processor URL incorrect**:
- Extension options → Processor URL
- Should be: `http://localhost:8090/ingest`
- Test URL in browser (should show "Not Found" - that's OK)

4. **Teams DOM changed**:
- Microsoft may have updated Teams markup
- Check extension logs for selector errors
- May need to update extension code

---

## Backend Issues

### Backend won't start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**:
```bash
# Reinstall dependencies
pip install -r mcp/requirements.txt

# Or rebuild Docker container
docker-compose build backend
```

---

### Backend crashes with "Database is locked"

**Solution**:
```bash
# Stop all services
docker-compose down

# Remove lock file
rm data/teams_messages.db-journal

# Restart
docker-compose up -d
```

---

### Backend uses wrong Python version

**Error**: `SyntaxError: invalid syntax` (type hints)

**Solution**:
```bash
# Check Python version (need 3.10+)
python3 --version

# Use correct version
python3.11 -m processor.server
```

---

## Frontend Issues

### Frontend shows blank page

**Diagnosis**:
```bash
# Check browser console (F12)
# Look for JavaScript errors

# Check if API is accessible
curl http://localhost:8090/health
```

**Solutions**:

1. **API not accessible**:
```bash
# Update Vite proxy in vite.config.ts
# Or set correct API URL
```

2. **Build error**:
```bash
cd web-gui/frontend
npm install
npm run build
```

---

### Frontend build fails

**Error**: `ENOENT: no such file or directory`

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error**: `Module not found: Error: Can't resolve`

**Solution**:
```bash
# Install missing dependency
npm install <missing-module>
```

---

### Charts not displaying

**Diagnosis**:
- Check browser console for errors
- Verify data is being fetched

**Solution**:
```bash
# Test stats endpoint
curl http://localhost:8090/stats

# Check if messages exist
curl http://localhost:8090/messages
```

---

## Browser Extension Issues

### Extension doesn't load

**Solution**:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Remove" on old extension
4. Click "Load unpacked"
5. Select `extension/` folder

---

### Extension logs show CORS error

**Error**: `Access-Control-Allow-Origin`

**Solution**:
Backend already has CORS enabled. If still seeing errors:

```bash
# Check backend CORS config in processor/server.py
# Should have:
# allow_origins=["*"]
```

---

### Extension can't reach processor

**Error**: `Failed to fetch`, `net::ERR_CONNECTION_REFUSED`

**Solutions**:

1. **Backend not running**:
```bash
docker-compose up -d backend
```

2. **Wrong URL in extension**:
- Extension options → Processor URL
- Must include `/ingest` path
- Example: `http://localhost:8090/ingest`

3. **Firewall blocking**:
```bash
# Allow port 8090
sudo ufw allow 8090
```

---

## Database Issues

### Cannot open database file

**Error**: `unable to open database file`

**Solution**:
```bash
# Create data directory
mkdir -p data

# Check permissions
chmod 755 data

# Reinitialize database
python -m processor.server
```

---

### Database growing too large

**Diagnosis**:
```bash
# Check database size
du -h data/teams_messages.db
```

**Solution**:
```bash
# Vacuum database
sqlite3 data/teams_messages.db "VACUUM;"

# Delete old messages (>90 days)
sqlite3 data/teams_messages.db \
  "DELETE FROM messages WHERE created_at < date('now', '-90 days');"

# Vacuum again
sqlite3 data/teams_messages.db "VACUUM;"
```

---

### Corrupted database

**Symptoms**:
- "database disk image is malformed"
- Random crashes

**Solution**:
```bash
# Attempt recovery
sqlite3 data/teams_messages.db ".recover" | sqlite3 recovered.db

# If successful, replace
mv data/teams_messages.db data/messages_corrupted.db
mv recovered.db data/teams_messages.db

# Restart services
docker-compose restart backend
```

---

## Integration Issues

### OpenAI API errors

**Error**: `RateLimitError`

**Solution**:
- Check your OpenAI usage limits
- Upgrade OpenAI plan if needed
- Implement request queuing

**Error**: `AuthenticationError`

**Solution**:
```bash
# Verify API key
echo $OPENAI_API_KEY

# Test key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Update key in .env
```

---

### Jira issues not created

**Diagnosis**:
1. Check n8n execution history
2. Verify Jira credentials in n8n
3. Check message reached n8n

**Solutions**:

1. **n8n workflow error**:
- Open n8n workflow
- Check execution logs
- Verify Jira node configuration

2. **Jira credentials expired**:
- Update Jira credentials in n8n
- Test connection

3. **Invalid Jira payload**:
- Check message details in GUI
- Verify Jira payload structure
- Update MCP agent prompt if needed

---

## Performance Issues

### Slow dashboard loading

**Diagnosis**:
```bash
# Check message count
sqlite3 data/teams_messages.db "SELECT COUNT(*) FROM messages;"

# Check backend response time
time curl http://localhost:8090/stats
```

**Solutions**:

1. **Too many messages**:
```bash
# Add indexes
sqlite3 data/teams_messages.db "CREATE INDEX idx_created_at ON messages(created_at);"

# Reduce limit in frontend API calls
```

2. **Slow OpenAI responses**:
- Check OpenAI service status
- Consider caching results
- Use faster model

---

### High memory usage

**Diagnosis**:
```bash
# Check Docker stats
docker stats

# Check process memory
ps aux | grep python
```

**Solutions**:

1. **Memory leak**:
```bash
# Restart services
docker-compose restart

# Monitor for recurring issues
```

2. **Too many workers**:
```bash
# Reduce workers in uvicorn command
uvicorn processor.server:app --workers 2
```

---

## Docker Issues

### Port already in use

**Error**: `Bind for 0.0.0.0:8090 failed: port is already allocated`

**Solution**:
```bash
# Find process using port
lsof -i :8090

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

---

### Container keeps restarting

**Diagnosis**:
```bash
# Check container logs
docker-compose logs backend

# Check exit code
docker ps -a | grep backend
```

**Solutions**:

1. **Missing environment variables**:
```bash
# Check .env file
cat .env

# Add missing variables
```

2. **Application crash**:
```bash
# Check logs for error details
docker-compose logs backend | tail -50
```

---

## Getting Help

If you've tried the solutions above and still have issues:

### 1. Gather Information

```bash
# System info
docker-compose version
python3 --version
node --version

# Service status
docker-compose ps

# Recent logs
docker-compose logs --tail=100 > logs.txt

# Database info
sqlite3 data/teams_messages.db \
  "SELECT status, COUNT(*) FROM messages GROUP BY status;" \
  > db_status.txt
```

### 2. Check Documentation

- [User Manual](USER_MANUAL.md)
- [Administrator Guide](ADMIN_GUIDE.md)
- [API Reference](API_REFERENCE.md)
- [Architecture Documentation](architecture.md)

### 3. Search Existing Issues

- Check GitHub issues
- Search for error messages
- Review closed issues

### 4. Create New Issue

Include:
- System information
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs
- Screenshots if applicable

### 5. Contact Support

- GitHub: Open an issue
- Email: [your-support-email]
- Slack: [your-slack-channel]

---

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [n8n Documentation](https://docs.n8n.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

**Document Version:** 2.0
**Last Updated:** November 2024
**Architecture:** Chrome Extension-based (v2.0)
