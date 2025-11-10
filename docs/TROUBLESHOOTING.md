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
curl http://localhost:5000/api/health

# Check frontend is accessible
curl http://localhost:3000

# View recent logs
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend

# Check database connectivity
docker-compose exec db psql -U postgres -d teams_extractor -c "SELECT COUNT(*) FROM teams.messages;"
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

3. **Database unavailable**:
```bash
# Check PostgreSQL status
docker-compose logs db | tail -50

# Verify connections
docker-compose exec db psql -U postgres -d teams_extractor -c "SELECT 1;"

# If necessary restore from backup
psql "$DATABASE_URL" < backups/db/latest.sql
```

---

### Issue: Queue size increases but no messages appear

**Symptoms**:
- Extension popup shows queue growing
- Badge displays ⏰ or ! with retries
- Backend `/api/messages` stays empty

**Diagnosis**:
```bash
# Check Chrome extension service worker console for errors
# chrome://extensions -> Teams Message Extractor -> "service worker"

# Verify backend health
curl http://localhost:5000/api/health

# Look for failed batch uploads
docker-compose logs backend | grep "Batch processing failed"
```

**Solutions**:

1. **Wrong backend URL in extension**:
   - Open extension options and confirm Backend API URL points to `http://localhost:5000/api`
   - Click **Save Settings** and reload the Teams tab

2. **Backend rejects requests**:
```bash
# Tail backend logs while retry happens
docker-compose logs -f backend

# Manually post a sample payload
curl -X POST http://localhost:5000/api/messages/batch \
  -H "Content-Type: application/json" \
  -d '{"extractionId":"test","messages":[]}'
```

3. **Redis not available**:
```bash
docker-compose logs redis
docker-compose exec redis redis-cli ping
```

---

### Issue: n8n not receiving webhooks

**Symptoms**:
- Messages reach "processed" status but not "forwarded"
- n8n workflow not triggered

**Diagnosis**:
```bash
# Check n8n connection flag
curl http://localhost:5000/api/health | jq '.n8n_connected'

# Check message metadata for webhook responses
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "SELECT metadata->>'n8n_response_code', metadata->>'n8n_error' FROM teams.messages ORDER BY id DESC LIMIT 10;"
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

3. **Backend API URL incorrect**:
- Extension options → Backend API URL
- Should be: `http://localhost:5000/api`
- Test `/api/health` in the browser (should return JSON)

4. **Teams DOM changed**:
- Microsoft may have updated Teams markup
- Check extension logs for selector errors
- May need to update extension code

---

## Backend Issues

### Backend won't start

**Common errors**:
- `Error: Cannot find module '/usr/src/app/backend/index.js'`
- `PrismaClientInitializationError` (if database not reachable)

**Solutions**:
```bash
# Ensure dependencies are installed
cd backend
npm install

# Rebuild Docker container
docker-compose build backend

# Check environment variables
grep DATABASE_URL .env
grep REDIS_URL .env
```

---

### Backend cannot connect to PostgreSQL

**Symptoms**:
- Backend logs contain `ECONNREFUSED` or `password authentication failed`
- `/api/health` reports `postgresql: unhealthy`

**Solution**:
```bash
# Verify database credentials
psql postgresql://postgres:postgres@localhost:5432/postgres -c '\conninfo'

# Check DATABASE_URL in .env matches your database settings
grep DATABASE_URL .env

# Restart database container
docker-compose restart db
```

---

## Frontend Issues

### Frontend shows blank page

**Diagnosis**:
```bash
# Check browser console (F12)
# Look for JavaScript errors

# Check if API is accessible
curl http://localhost:5000/api/health
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
curl http://localhost:5000/api/stats

# Check if messages exist
curl http://localhost:5000/api/messages
```

---

## Browser Extension Issues

### Extension doesn't load

**Solution**:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Remove" on old extension
4. Click "Load unpacked"
5. Select `chrome-extension/` folder

---

### Extension logs show CORS error

**Error**: `Access-Control-Allow-Origin`

**Solution**:
Backend already allows `chrome-extension://` origins. If errors persist:

- Confirm `backend/server.js` is running (port `5000`)
- Verify the extension API URL is `http://localhost:5000/api`
- Restart the extension after changing settings

---

### Extension can't reach processor

**Error**: `Failed to fetch`, `net::ERR_CONNECTION_REFUSED`

**Solutions**:

1. **Backend not running**:
```bash
docker-compose up -d backend
```

2. **Wrong URL in extension**:
- Extension options → Backend API URL
- Should be `http://localhost:5000/api` (or your deployment URL)

3. **Firewall blocking**:
```bash
# Allow port 5000
sudo ufw allow 5000
```

---

## Database Issues

### PostgreSQL container keeps restarting

**Diagnosis**:
```bash
docker-compose logs db
```

Common causes:
- Invalid credentials (`FATAL: password authentication failed`)
- Database files owned by root after manual copy
- Volume not mounted correctly

**Solution**:
```bash
# Reset the database container (data is preserved in the named volume)
docker-compose stop db
docker-compose rm -f db
docker-compose up -d db

# Verify the database is reachable
psql "$DATABASE_URL" -c 'SELECT NOW();'
```

---

### Database growing too large

**Diagnosis**:
```bash
# Check database size
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

**Solution**:
```bash
# Remove messages older than 90 days (adjust as needed)
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "DELETE FROM teams.messages WHERE timestamp < NOW() - INTERVAL '90 days';"

# Reclaim space
docker-compose exec db psql -U postgres -d teams_extractor -c "VACUUM ANALYZE;"
```

---

### Restore from backup fails

**Solution**:
```bash
# Ensure no clients are connected
docker-compose stop backend

# Restore using psql
psql "$DATABASE_URL" < backups/db/latest.sql

# Restart backend
docker-compose start backend
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
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "SELECT COUNT(*) FROM teams.messages;"

# Check backend response time
time curl http://localhost:5000/api/stats
```

**Solutions**:

1. **Too many messages**:
```bash
# Add missing indexes
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON teams.messages(created_at);"

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
ps aux | grep node
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
# Reduce Node cluster workers (if using pm2)
pm2 scale teams-backend 1
```

---

## Docker Issues

### Port already in use

**Error**: `Bind for 0.0.0.0:5000 failed: port is already allocated`

**Solution**:
```bash
# Find process using port
lsof -i :5000

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
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "SELECT channel_name, COUNT(*) FROM teams.messages GROUP BY 1 ORDER BY 2 DESC LIMIT 10;" \
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
