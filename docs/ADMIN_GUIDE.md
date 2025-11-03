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
curl http://localhost:8090/health
```

### Manual Installation

#### Backend Setup

1. **Create virtual environment**
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
```

2. **Install dependencies**
```bash
pip install -r mcp/requirements.txt
```

3. **Set environment variables**
```bash
export OPENAI_API_KEY=sk-...
export N8N_WEBHOOK_URL=https://...
export N8N_API_KEY=...  # optional
```

4. **Start the backend**
```bash
python -m processor.server
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

# Processor Configuration
HOST=0.0.0.0
PORT=8090
PROCESSOR_DATA_DIR=./data
```

### Database Configuration

SQLite database is created automatically at `data/teams_messages.db`.

To change location:
```bash
export PROCESSOR_DATA_DIR=/custom/path/data
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
   - Select `extension/` folder

2. **Configure extension**
   - Click extension options
   - Set processor URL: `http://localhost:8090/ingest`
   - Enter your Teams display name
   - Set target channel: `Güncelleme Planlama`
   - Add trigger keywords: `Güncellendi`, `Yaygınlaştırıldı`

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
      test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
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
        proxy_pass http://localhost:8090/;
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

1. **Use PostgreSQL** instead of SQLite
2. **Add load balancer** for multiple backend instances
3. **Implement Redis** for caching
4. **Use CDN** for frontend assets

## Monitoring

### Health Checks

**Backend health endpoint:**
```bash
curl http://localhost:8090/health
```

Response:
```json
{
  "status": "ok",
  "model": "gpt-4",
  "db": "/app/data/teams_messages.db",
  "n8n_connected": true
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
sqlite3 data/teams_messages.db "SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;"
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
   - Monitor `teams_messages.db` file size
   - Implement cleanup if growing too large

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
BACKUP_DIR="/backups/teams-extractor"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp data/teams_messages.db "$BACKUP_DIR/messages_$DATE.db"

# Backup config
cp data/config.json "$BACKUP_DIR/config_$DATE.json"

# Keep only last 30 days
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
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
cp /backups/teams-extractor/messages_YYYYMMDD.db data/teams_messages.db
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

**Database locked error:**
```bash
# Stop all processes
docker-compose down

# Remove lock file
rm data/teams_messages.db-journal

# Restart
docker-compose up -d
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

1. **Increase worker threads**
```bash
uvicorn processor.server:app --workers 4 --host 0.0.0.0 --port 8090
```

2. **Database optimization**
```sql
-- Add indexes
CREATE INDEX idx_status ON messages(status);
CREATE INDEX idx_created_at ON messages(created_at);
CREATE INDEX idx_author ON messages(author);
```

3. **Connection pooling**
   - Configure httpx client pool
   - Limit concurrent OpenAI requests

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
sqlite3 data/teams_messages.db "VACUUM;"
```

**Check integrity:**
```bash
sqlite3 data/teams_messages.db "PRAGMA integrity_check;"
```

**Cleanup old messages** (older than 90 days):
```sql
DELETE FROM messages WHERE created_at < date('now', '-90 days');
```

## Support

For additional support:
- Review [User Manual](USER_MANUAL.md)
- Check [API Documentation](API_REFERENCE.md)
- Review [Troubleshooting Guide](TROUBLESHOOTING.md)
- Open GitHub issue
- Contact development team

---

**Version**: 1.0.0
**Last Updated**: 2025-10-27
