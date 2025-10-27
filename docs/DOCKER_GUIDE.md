# Docker Deployment Guide

## Quick Start

The fastest way to get started:

```bash
# 1. Install
make install

# 2. Edit .env with your API keys
nano .env

# 3. Start
make start

# 4. Access
open http://localhost:3000
```

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Environment Configurations](#environment-configurations)
4. [Docker Commands](#docker-commands)
5. [Makefile Reference](#makefile-reference)
6. [Health Checks](#health-checks)
7. [Backup & Restore](#backup--restore)
8. [Troubleshooting](#troubleshooting)
9. [Production Deployment](#production-deployment)

## Prerequisites

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ ([Install Compose](https://docs.docker.com/compose/install/))
- **Make** (optional, for convenience commands)
- **Git** (for cloning repository)

Verify installation:
```bash
docker --version
docker-compose --version
make --version  # optional
```

## Installation Methods

### Method 1: Using Makefile (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd teams-extractor

# Install (creates .env, builds images, starts services)
make install

# Edit configuration
nano .env

# Restart with new configuration
make restart
```

### Method 2: Using Scripts

```bash
# Clone repository
git clone <repository-url>
cd teams-extractor

# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env

# Start (production)
bash scripts/start.sh prod

# Or start development
bash scripts/start.sh dev
```

### Method 3: Manual Docker Compose

```bash
# Clone repository
git clone <repository-url>
cd teams-extractor

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env

# Build images
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

## Environment Configurations

### Development Environment

Hot-reload enabled for both frontend and backend:

```bash
# Using Makefile
make start-dev

# Or using script
bash scripts/start.sh dev

# Or using Docker Compose
docker-compose -f docker-compose.dev.yml up -d
```

**Features:**
- Source code mounted as volumes
- Hot reload for frontend (Vite)
- Auto-restart for backend on code changes
- Debug-friendly logging
- No resource limits

### Production Environment

Optimized for performance and reliability:

```bash
# Using Makefile
make start-prod

# Or using script
bash scripts/start.sh prod

# Or using Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

**Features:**
- Multi-stage builds for smaller images
- Resource limits (CPU/Memory)
- Log rotation
- Health checks with dependencies
- Always restart policy
- Optimized Nginx configuration

### Default Environment

Balanced configuration for general use:

```bash
# Using Makefile
make start

# Or using script
bash scripts/start.sh

# Or using Docker Compose
docker-compose up -d
```

## Docker Commands

### Basic Operations

```bash
# Start services
make up
# or
docker-compose up -d

# Stop services
make down
# or
docker-compose down

# Restart services
make restart
# or
docker-compose restart

# View logs
make logs
# or
docker-compose logs -f

# Check status
make ps
# or
docker-compose ps
```

### Individual Service Operations

```bash
# Backend only
docker-compose up -d backend
docker-compose logs -f backend
docker-compose restart backend

# Frontend only
docker-compose up -d frontend
docker-compose logs -f frontend
docker-compose restart frontend
```

### Shell Access

```bash
# Backend shell
make shell-backend
# or
docker-compose exec backend /bin/bash

# Frontend shell
make shell-frontend
# or
docker-compose exec frontend /bin/sh

# Database shell
make db-shell
# or
sqlite3 data/teams_messages.db
```

### Building Images

```bash
# Build all images
make build

# Build with no cache
docker-compose build --no-cache

# Build specific service
docker-compose build backend
```

## Makefile Reference

Complete list of available Make targets:

```bash
# Show all commands
make help

# Installation & Setup
make install          # Initial setup
make build           # Build images
make rebuild         # Rebuild from scratch

# Starting & Stopping
make start           # Full startup with health checks
make start-dev       # Development mode
make start-prod      # Production mode
make stop            # Full shutdown
make up              # Start services
make down            # Stop services
make restart         # Restart services

# Monitoring & Logs
make logs            # All logs
make logs-backend    # Backend logs only
make logs-frontend   # Frontend logs only
make ps              # List containers
make stats           # Resource usage
make health          # Run health checks

# Database Operations
make db-shell        # Open database shell
make db-backup       # Backup database
make db-stats        # Show statistics

# Maintenance
make backup          # Full backup
make restore         # Restore from backup
make clean           # Remove containers/volumes
make clean-all       # Deep clean
make prune           # Remove unused resources
make update          # Pull and rebuild

# Development
make shell-backend   # Backend shell
make shell-frontend  # Frontend shell
make test            # Run tests
```

## Health Checks

### Automated Health Checks

Health checks run automatically for all services:

**Backend:**
- Endpoint: `http://localhost:8090/health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Start period: 40 seconds
- Retries: 3

**Frontend:**
- Endpoint: `http://localhost/`
- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 10 seconds
- Retries: 3

### Manual Health Checks

```bash
# All services
make health
# or
bash scripts/health-check-all.sh

# Backend only
bash scripts/health-check-backend.sh

# Frontend only
bash scripts/health-check-frontend.sh

# Docker native
docker-compose ps
```

### Health Check Output

```
=========================================
Teams Message Extractor - Health Check
=========================================

🐳 Checking Docker...
✅ Docker is installed: Docker version 24.0.0

🐳 Checking Docker Compose...
✅ Docker Compose is installed: Docker Compose version v2.20.0

📦 Checking containers...
✅ Backend container is running
✅ Frontend container is running

🔧 Checking backend health...
✅ Backend is healthy!
Health info: {"status":"ok","model":"gpt-4","db":"/app/data/teams_messages.db","n8n_connected":true}

🌐 Checking frontend health...
✅ Frontend is healthy!

🔐 Checking environment variables...
✅ .env file exists
✅ OPENAI_API_KEY is configured
✅ N8N_WEBHOOK_URL is configured

🗄️  Checking database...
✅ Database exists (size: 128K)
📊 Total messages: 42

📝 Checking logs...
✅ Logs directory exists
📄 Processor log size: 64K

=========================================
Health Check Complete
=========================================

🌐 Access Points:
  - Frontend: http://localhost:3000
  - Backend API: http://localhost:8090
  - API Docs: http://localhost:8090/docs
```

## Backup & Restore

### Automated Backups

```bash
# Create backup
make backup
# or
bash scripts/backup.sh

# Backup database only
make db-backup
```

**What gets backed up:**
- Database (`data/teams_messages.db`)
- Configuration (`.env`)
- Logs (`logs/`)

**Backup location:** `./backups/`

**Retention:** Last 7 backups kept automatically

### Restore from Backup

```bash
# Interactive restore
make restore
# or
bash scripts/restore.sh

# List available backups
ls -lh backups/
```

### Manual Backup/Restore

```bash
# Manual backup
tar -czf backup.tar.gz data/ logs/ .env

# Manual restore
tar -xzf backup.tar.gz
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
make logs

# Check specific service
docker-compose logs backend
docker-compose logs frontend

# Rebuild and restart
make rebuild
```

### Port Already in Use

```bash
# Find process using port 8090
lsof -i :8090

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Permission Errors

```bash
# Fix data directory permissions
sudo chown -R $(whoami):$(whoami) data/ logs/

# Fix script permissions
chmod +x scripts/*.sh
```

### Database Locked

```bash
# Stop all services
make down

# Remove lock file
rm data/teams_messages.db-journal

# Restart
make up
```

### Out of Memory

```bash
# Check container resources
make stats

# Increase Docker memory limit
# Docker Desktop: Settings → Resources → Memory

# Or adjust limits in docker-compose.prod.yml
```

### Network Issues

```bash
# Recreate network
docker-compose down
docker network prune
docker-compose up -d

# Check network
docker network ls
docker network inspect teams-extractor_teams-extractor-network
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Configure production `.env` with real API keys
- [ ] Set strong passwords/secrets
- [ ] Configure reverse proxy (Nginx/Traefik)
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Configure firewall rules
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation (ELK/Loki)
- [ ] Set up automated backups
- [ ] Test disaster recovery
- [ ] Document runbooks

### Production Configuration

**1. Environment Variables**

```bash
# Production .env
OPENAI_API_KEY=sk-prod-xxx
N8N_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/teams
N8N_API_KEY=prod-secret-key
HOST=0.0.0.0
PORT=8090
PROCESSOR_DATA_DIR=/app/data
```

**2. Reverse Proxy (Nginx)**

```nginx
# /etc/nginx/sites-available/teams-extractor
server {
    listen 80;
    server_name teams.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name teams.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/teams.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/teams.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8090/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**3. SSL Certificate**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d teams.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

**4. Systemd Service**

```ini
# /etc/systemd/system/teams-extractor.service
[Unit]
Description=Teams Message Extractor
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/teams-extractor
ExecStart=/usr/bin/make start-prod
ExecStop=/usr/bin/make stop
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable teams-extractor
sudo systemctl start teams-extractor

# Check status
sudo systemctl status teams-extractor
```

**5. Automated Backups (Cron)**

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * cd /opt/teams-extractor && make backup

# Weekly cleanup
0 3 * * 0 cd /opt/teams-extractor && make prune
```

**6. Monitoring**

```bash
# Install monitoring tools
docker run -d -p 9090:9090 prom/prometheus
docker run -d -p 3001:3000 grafana/grafana

# Or use docker-compose.monitoring.yml
```

### Performance Optimization

**1. Resource Limits**

Edit `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

**2. Database Optimization**

```bash
# Add indexes
sqlite3 data/teams_messages.db <<EOF
CREATE INDEX IF NOT EXISTS idx_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_author ON messages(author);
EOF

# Vacuum regularly
sqlite3 data/teams_messages.db "VACUUM;"
```

**3. Log Rotation**

Already configured in `docker-compose.prod.yml`:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Security Hardening

1. **Non-root containers** ✅ (Already implemented)
2. **Read-only filesystem** (Optional)
3. **Network isolation** ✅ (Already implemented)
4. **Secret management** (Use Docker secrets)
5. **Security scanning**

```bash
# Scan images for vulnerabilities
docker scan teams-extractor-backend
docker scan teams-extractor-frontend
```

### Scaling

**Horizontal Scaling (Multiple Instances):**

```yaml
# docker-compose.scale.yml
services:
  backend:
    deploy:
      replicas: 3
```

```bash
# Scale up
docker-compose -f docker-compose.scale.yml up -d --scale backend=3
```

**Load Balancer:**

```yaml
# Add HAProxy or Nginx load balancer
  load-balancer:
    image: haproxy:latest
    ports:
      - "80:80"
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [User Manual](USER_MANUAL.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

---

**Version:** 1.0.0
**Last Updated:** 2025-10-27
