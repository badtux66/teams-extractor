# Teams Message Extractor - Administrator Guide

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Monitoring](#monitoring)
6. [Backup & Recovery](#backup--recovery)
7. [Troubleshooting](#troubleshooting)
8. [Security](#security)
9. [Performance Tuning](#performance-tuning)
10. [Maintenance](#maintenance)

## System Architecture

### Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────┐
│   Browser   │─────▶│   Processor  │─────▶│   n8n   │
│  Extension  │      │   (FastAPI)  │      │Workflow │
└─────────────┘      └──────────────┘      └─────────┘
                            │                     │
                            ▼                     ▼
                      ┌──────────┐          ┌────────┐
                      │ SQLite   │          │  Jira  │
                      │ Database │          └────────┘
                      └──────────┘
                            ▲
                            │
                      ┌──────────┐
                      │ Web GUI  │
                      │ (React)  │
                      └──────────┘
```

### Technology Stack

**Backend:**
- FastAPI (Python 3.10+)
- SQLite for data persistence
- OpenAI API for AI processing
- httpx for async HTTP requests

**Frontend:**
- React 18 with TypeScript
- Material-UI components
- Recharts for analytics
- Vite for development and building

**Infrastructure:**
- Docker & Docker Compose
- Nginx for reverse proxy
- Linux/macOS/Windows compatible

## Installation

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- OR: Python 3.10+, Node.js 18+
- OpenAI API account with valid API key
- n8n instance (cloud or self-hosted)
- Jira instance with API access

### Docker Installation (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd teams-extractor
```

2. **Configure environment variables**
```bash
cp .env.example .env
nano .env  # Edit with your values
```

Required variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `N8N_WEBHOOK_URL`: Your n8n webhook endpoint
- `N8N_API_KEY`: (Optional) n8n API key

3. **Build and start containers**
```bash
docker-compose up -d
```

4. **Verify installation**
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs -f

# Test health endpoint
curl http://localhost:5000/api/health
```

### Manual Installation

#### Backend Setup

1. **Install dependencies**
```bash
cd backend
npm install
```

2. **Set environment variables**
```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/teams_extractor
export REDIS_URL=redis://localhost:6379
# Optional integrations
export OPENAI_API_KEY=sk-...
export N8N_WEBHOOK_URL=https://...
export N8N_API_KEY=...
```

3. **Start the backend**
```bash
npm run dev
# or npm start for production mode
```

#### Frontend Setup

1. **Install dependencies**
```bash
cd web-gui/frontend
npm install
```

2. **Start development server**
```bash
npm run dev
```

Or build for production:
```bash
npm run build
npm run preview
```

## Configuration

### Environment Variables

Create `.env` file in the project root:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here

# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/teams-guncelleme
N8N_API_KEY=your-n8n-api-key  # Optional

# Backend Configuration
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@db:5432/teams_extractor
REDIS_URL=redis://redis:6379
NODE_ENV=development
```

### Database Configuration

The backend expects PostgreSQL. When using Docker the `db` service is provisioned automatically. For local development, point `DATABASE_URL` at your own instance, for example:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teams_extractor
```

Run the migrations/init script (Docker does this automatically):

```bash
psql "$DATABASE_URL" -f init-scripts/01-init.sql
```

### n8n Workflow Setup

1. **Import workflow**
   - Open n8n
   - Go to Workflows → Import from File
   - Select `n8n/workflows/jira-teams.json`

2. **Configure Jira node**
   - Add Jira Cloud credentials
   - Set project key
   - Map custom fields

3. **Activate webhook**
   - Copy webhook URL
   - Add to `N8N_WEBHOOK_URL` in `.env`

4. **Test workflow**
   - Use webhook test feature
   - Verify Jira issue creation

### Browser Extension Setup

1. **Load extension**
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the `chrome-extension/` folder

2. **Configure extension**
   - Click the extension options page
   - Set backend API URL: `http://localhost:5000/api`
   - (Optional) Provide an API key if required by your backend
   - Leave extraction interval at `5` (seconds) unless you need faster/slower polling
   - Adjust batch size or enable reactions/threads/attachments if needed
   - Click **Install MCP Extension** if you want the backend to register the Claude MCP package automatically

### Claude Desktop MCP Extension

1. **Build package**
   - From the repository root run `bash scripts/build_claude_extension.sh`
   - The archive is created at `dist/claude-extension/teams-extractor-mcp.zip`
2. **Install in Claude**
   - Open Claude Desktop → Developer → Extensions → Install Extension
   - Select the generated ZIP file
   - Provide the Teams Extractor PostgreSQL connection string when prompted
   - Ensure "Use Built-in Node.js for MCP" remains enabled (default on macOS)
   - Restart Claude Desktop to load the new MCP server

## Deployment

### Production Deployment with Docker

1. **Update docker-compose.yml** for production:

```yaml
services:
  backend:
    restart: always
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - N8N_API_KEY=${N8N_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    restart: always
```

2. **Use reverse proxy** (Nginx example):

```nginx
server {
    listen 80;
    server_name teams-extractor.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. **Enable HTTPS** with Let's Encrypt:

```bash
sudo certbot --nginx -d teams-extractor.yourdomain.com
```

### Scaling Considerations

For high-volume deployments:

1. **Run PostgreSQL on managed or clustered service**
2. **Add a load balancer** in front of replicated backend instances
3. **Ensure Redis persistence** for dedupe keys if you need restart tolerance
4. **Use CDN** for frontend assets

## Monitoring

### Health Checks

**Backend health endpoint:**
```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-14T12:34:56.789Z",
  "services": {
    "postgresql": { "status": "healthy", "responseTime": 12 },
    "redis": { "status": "healthy", "responseTime": 4 }
  },
  "database": {
    "totalMessages": 12345,
    "totalSessions": 42,
    "databaseSize": 314572800
  },
  "memory": { "rss": 150, "heapUsed": 68 },
  "process": { "nodeVersion": "v20.10.0" },
  "responseTime": 25,
  "n8n_connected": false
}
```

**Frontend health:**
```bash
curl http://localhost:3000
# Should return 200 OK
```

### Logging

**View backend logs:**
```bash
docker-compose logs -f backend
```

**View frontend logs:**
```bash
docker-compose logs -f frontend
```

**Database queries:**
```bash
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "SELECT channel_name, sender_name, timestamp FROM teams.messages ORDER BY timestamp DESC LIMIT 10;"
```

### Metrics to Monitor

1. **Message processing rate**
   - Check `/stats` endpoint
   - Monitor pending vs. processed ratio

2. **Error rate**
   - Count of failed/error status messages
   - Should be < 5%

3. **Response time**
   - Backend API response time
   - Should be < 500ms average

4. **Database size**
   - Monitor `pg_database_size('teams_extractor')`
   - Implement retention policies if growing too large

### Alerting

Set up alerts for:
- Backend health check failures
- High error rate (>10% failures)
- n8n connection lost
- Disk space low (< 10% free)

## Backup & Recovery

### Database Backup

**Automated backup script:**
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backups/teams-extractor"
DATE=$(date +%Y%m%d_%H%M%S)
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/teams_extractor}"

mkdir -p "$BACKUP_DIR/db"

# Dump PostgreSQL database
pg_dump "$DB_URL" > "$BACKUP_DIR/db/teams_extractor_$DATE.sql"

# Backup configuration
cp .env "$BACKUP_DIR/env_$DATE"

# Keep only last 30 days
find "$BACKUP_DIR/db" -name "*.sql" -mtime +30 -delete
find "$BACKUP_DIR" -name "env_*" -mtime +30 -delete
```

**Schedule with cron:**
```bash
0 2 * * * /path/to/backup_script.sh
```

### Restore from Backup

1. **Stop services**
```bash
docker-compose down
```

2. **Restore database**
```bash
psql "$DATABASE_URL" < /backups/teams-extractor/db/teams_extractor_YYYYMMDD.sql
```

3. **Restart services**
```bash
docker-compose up -d
```

### Disaster Recovery

1. **Document all configuration**
   - Keep copy of `.env` file (encrypted)
   - Document n8n workflow setup
   - Save Jira integration details

2. **Regular backups**
   - Daily database backups
   - Weekly full system backups
   - Test restore procedure monthly

3. **Recovery procedure**
   - Restore database from backup
   - Recreate Docker containers
   - Reconfigure n8n workflow
   - Reinstall browser extensions

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting steps.

### Common Issues

**Backend won't start:**
```bash
# Check Python dependencies
pip list | grep fastapi

# Check environment variables
env | grep OPENAI

# View detailed logs
docker-compose logs backend
```

**Frontend won't build:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Database container restarting:**
```bash
# Review database logs
docker-compose logs db | tail -50

# Ensure volume permissions are correct
sudo chown -R $(whoami):$(whoami) data/postgres

# Restart stack
docker-compose up -d db backend
```

## Security

### API Key Security

- **Never commit** `.env` file to git
- **Rotate keys** quarterly
- **Use environment variables** only
- **Restrict access** to production servers

### Network Security

- **Use HTTPS** in production
- **Implement firewall** rules
- **Restrict backend** to localhost or internal network
- **Use VPN** for remote access

### Access Control

Currently, the GUI has no authentication. For production:

1. **Add authentication layer**
   - Use OAuth2
   - Implement JWT tokens
   - Add user roles

2. **Secure API endpoints**
   - Require API key for all requests
   - Rate limiting
   - IP whitelisting

### Data Security

- **Encrypt sensitive data** at rest
- **Use HTTPS** for all external connections
- **Sanitize inputs** to prevent injection
- **Regular security audits**

## Performance Tuning

### Backend Optimization

1. **Scale Node workers**
   - Run the backend behind a process manager such as `pm2` or `systemd`
   - For multi-core hosts use the Node cluster mode (`pm2 start npm --name teams-backend -- run start --watch`)

2. **Database optimization**
```sql
-- Add indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON teams.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_name ON teams.messages(sender_name);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON teams.messages(created_at);
```

3. **Connection pooling**
   - Adjust `max` / `idleTimeoutMillis` in `backend/config/database.js`
   - Keep Redis connections reused rather than created per request

### Frontend Optimization

1. **Enable production build**
```bash
npm run build
```

2. **Use CDN** for static assets

3. **Enable caching** in Nginx:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Maintenance

### Regular Tasks

**Daily:**
- Check system health
- Review error logs
- Monitor disk space

**Weekly:**
- Review analytics trends
- Check failed messages
- Verify backups

**Monthly:**
- Update dependencies
- Review and cleanup old messages
- Performance analysis
- Security audit

### Updates

**Update backend:**
```bash
git pull
docker-compose build backend
docker-compose up -d backend
```

**Update frontend:**
```bash
git pull
cd web-gui/frontend
npm install
npm run build
docker-compose build frontend
docker-compose up -d frontend
```

### Database Maintenance

**Vacuum database:**
```bash
docker-compose exec db psql -U postgres -d teams_extractor -c "VACUUM ANALYZE;"
```

**Check integrity:**
```bash
docker-compose exec db psql -U postgres -d teams_extractor -c "SELECT pg_is_in_recovery();"
```

**Cleanup old messages** (older than 90 days):
```bash
docker-compose exec db psql -U postgres -d teams_extractor -c \
  "DELETE FROM teams.messages WHERE timestamp < NOW() - INTERVAL '90 days';"
```

## Support

For additional support:
- Review [User Manual](USER_MANUAL.md)
- Check [API Documentation](API_REFERENCE.md)
- Review [Troubleshooting Guide](TROUBLESHOOTING.md)
- Open GitHub issue
- Contact development team

---

**Document Version:** 2.0
**Last Updated:** November 2024
**Architecture:** Chrome Extension-based (v2.0)
