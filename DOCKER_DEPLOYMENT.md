# Docker Deployment Guide

Complete guide for deploying Teams Message Extractor using Docker Compose.

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Clone the repository
git clone <repository-url>
cd teams-extractor

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings (use secure passwords!)

# 3. Deploy everything
./deploy.sh

# 4. Access the application
open http://localhost:3000
```

That's it! All services will be running.

## 📦 What Gets Deployed

The deployment script sets up the following services:

### Core Services (Always Deployed)

| Service | Port | Description |
|---------|------|-------------|
| **PostgreSQL** | 5432 | Message database with full-text search |
| **Redis** | 6379 | Caching and deduplication |
| **Backend API** | 5000 | Node.js/Express REST API |
| **Frontend** | 3000 | React web dashboard |
| **MCP Server** | - | Claude Desktop integration (stdio) |

### Optional Services

| Service | Port | Flag | Description |
|---------|------|------|-------------|
| **Nginx** | 80, 443 | `--with-nginx` | Reverse proxy with SSL support |
| **Grafana** | 3001 | `--with-monitoring` | Metrics visualization |
| **Prometheus** | 9090 | `--with-monitoring` | Metrics collection |

## 🛠️ Deployment Options

### Basic Deployment

```bash
./deploy.sh
```

Deploys core services in production mode.

### Development Mode

```bash
./deploy.sh --dev
```

Enables development features:
- Debug logging
- Hot reload (if configured)
- Verbose error messages

### With Nginx Reverse Proxy

```bash
./deploy.sh --with-nginx
```

Adds Nginx in front of services:
- Single entry point (port 80)
- Rate limiting
- WebSocket support
- SSL/TLS ready
- Load balancing

### With Monitoring Stack

```bash
./deploy.sh --with-monitoring
```

Adds Grafana and Prometheus:
- Real-time metrics dashboards
- Historical data retention
- Performance monitoring
- Resource usage tracking

### Fresh Installation

```bash
./deploy.sh --fresh
```

⚠️ **Warning**: Removes all existing data!

- Deletes all Docker volumes
- Removes existing containers
- Clean slate installation

### Combined Options

```bash
./deploy.sh --dev --with-monitoring
./deploy.sh --with-nginx --with-monitoring
./deploy.sh --fresh --with-nginx --with-monitoring
```

## ⚙️ Configuration

### Environment Variables (.env)

Copy `.env.example` to `.env` and configure:

#### Required Settings

```bash
# PostgreSQL
POSTGRES_ADMIN_USER=teams_admin
POSTGRES_ADMIN_PASSWORD=changeme  # ⚠️ Change this!
POSTGRES_DB=teams_extractor

# Backend API
PORT=5000
NODE_ENV=production
```

#### Optional Settings

```bash
# Redis Password (recommended for production)
REDIS_PASSWORD=redis_secure_password

# CORS (if frontend is on different domain)
CORS_ORIGIN=https://teams.example.com

# Ports (if defaults conflict)
POSTGRES_PORT=5432
REDIS_PORT=6379
FRONTEND_PORT=3000

# Monitoring
GRAFANA_ADMIN_PASSWORD=admin
GRAFANA_PORT=3001
PROMETHEUS_PORT=9090
```

### Service Dependencies

The deployment script automatically handles service dependencies:

```
PostgreSQL  ────┐
                ├──→ Backend API ──→ Frontend
Redis       ────┘        ↓
                    MCP Server
```

Services wait for health checks before starting dependent services.

## 🔍 Verification

### Check Service Status

```bash
docker-compose ps
```

Expected output:
```
NAME                        STATUS              PORTS
teams-extractor-backend     Up (healthy)        5000->5000
teams-extractor-frontend    Up (healthy)        3000->80
teams-extractor-postgres    Up (healthy)        5432->5432
teams-extractor-redis       Up (healthy)        6379->6379
teams-extractor-mcp         Up                  -
```

### Test Backend API

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "services": {
    "postgresql": { "status": "healthy" },
    "redis": { "status": "healthy" }
  }
}
```

### Test Frontend

```bash
curl -I http://localhost:3000
```

Expected: `HTTP/1.1 200 OK`

### Check Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100

# Since 1 hour ago
docker-compose logs --since=1h
```

## 🐛 Troubleshooting

### Service Won't Start

1. **Check logs:**
   ```bash
   docker-compose logs <service-name>
   ```

2. **Check resource usage:**
   ```bash
   docker stats
   ```

3. **Restart service:**
   ```bash
   docker-compose restart <service-name>
   ```

### Database Connection Errors

1. **Verify PostgreSQL is healthy:**
   ```bash
   docker-compose ps postgres
   docker-compose exec postgres pg_isready
   ```

2. **Check credentials:**
   ```bash
   docker-compose exec postgres psql -U teams_admin -d teams_extractor -c "SELECT 1"
   ```

3. **Review backend logs:**
   ```bash
   docker-compose logs backend | grep -i postgres
   ```

### Port Conflicts

If ports are already in use:

1. **Edit .env:**
   ```bash
   PORT=5001
   FRONTEND_PORT=3001
   POSTGRES_PORT=5433
   ```

2. **Restart:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Out of Disk Space

1. **Check Docker disk usage:**
   ```bash
   docker system df
   ```

2. **Clean up:**
   ```bash
   docker system prune -a --volumes
   ```

3. **Remove old volumes (⚠️ deletes data):**
   ```bash
   docker volume prune
   ```

### Performance Issues

1. **Increase resources:**
   - Docker Desktop → Settings → Resources
   - Allocate more CPU/Memory

2. **Check for resource constraints:**
   ```bash
   docker stats
   ```

3. **Review logs for errors:**
   ```bash
   docker-compose logs | grep -i error
   ```

## 📊 Monitoring (with --with-monitoring)

### Access Grafana

1. Open http://localhost:3001
2. Login: admin / (from GRAFANA_ADMIN_PASSWORD in .env)
3. Add Prometheus data source:
   - URL: http://prometheus:9090
   - Click "Save & Test"

### Create Dashboard

Sample Prometheus queries:

```promql
# Request rate
rate(http_requests_total[5m])

# Database pool size
db_pool_total_count

# Memory usage
process_memory_rss_bytes

# Message processing rate
rate(teams_messages_total[1h])
```

### View Metrics Directly

Prometheus: http://localhost:9090
- Graph query results
- View targets
- Check alerts

## 🔒 Security Best Practices

### 1. Change Default Passwords

```bash
# In .env
POSTGRES_ADMIN_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)
```

### 2. Use Read-Only Database User for MCP

```sql
CREATE USER mcp_reader WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE teams_extractor TO mcp_reader;
GRANT USAGE ON SCHEMA teams TO mcp_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA teams TO mcp_reader;
```

Update .env:
```bash
MCP_READER_PASSWORD=secure_password
```

### 3. Enable SSL/TLS with Nginx

1. Generate certificates:
   ```bash
   mkdir -p nginx/ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout nginx/ssl/key.pem \
     -out nginx/ssl/cert.pem
   ```

2. Uncomment SSL server block in `nginx/nginx.conf`

3. Deploy:
   ```bash
   ./deploy.sh --with-nginx
   ```

### 4. Network Isolation

Services communicate through internal Docker network.
Only exposed ports are accessible from host.

### 5. Regular Updates

```bash
# Pull latest images
docker-compose pull

# Rebuild custom images
docker-compose build --pull

# Restart with updates
docker-compose up -d
```

## 🔄 Backup and Restore

### Backup Database

```bash
# Create backup
docker-compose exec -T postgres pg_dump \
  -U teams_admin -d teams_extractor \
  > backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Stop backend to prevent writes
docker-compose stop backend mcp-server

# Restore
gunzip < backup_20240101.sql.gz | \
docker-compose exec -T postgres psql \
  -U teams_admin -d teams_extractor

# Restart
docker-compose start backend mcp-server
```

### Backup Volumes

```bash
# Backup PostgreSQL data
docker run --rm \
  -v teams-extractor_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data

# Backup Redis data
docker run --rm \
  -v teams-extractor_redis_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/redis_backup.tar.gz /data
```

## 🚀 Scaling (Future)

### Horizontal Scaling

To run multiple backend instances:

```yaml
# In docker-compose.yml
backend:
  deploy:
    replicas: 3
```

Requires load balancer (Nginx or external).

### Vertical Scaling

Allocate more resources:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 4G
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [Nginx Docker Image](https://hub.docker.com/_/nginx)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

## 🆘 Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs`
2. Review this troubleshooting section
3. Check GitHub issues
4. Docker version: `docker --version` (requires 20.10+)
5. Docker Compose version: `docker-compose --version` (requires 1.29+)

## ⚡ Quick Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart service
docker-compose restart <service>

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Execute command in container
docker-compose exec <service> <command>

# Update and restart
docker-compose pull && docker-compose up -d

# Remove everything (⚠️ deletes data)
docker-compose down -v
```
