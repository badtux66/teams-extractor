# Deployment Guide

This guide covers deploying the Teams-to-Jira automation system in various environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Production Deployment](#production-deployment)
4. [Cloud Deployments](#cloud-deployments)
5. [Monitoring & Logging](#monitoring--logging)
6. [Backup & Recovery](#backup--recovery)

---

## Local Development

### Prerequisites

- Python 3.10+
- Virtual environment tool (venv/virtualenv)
- OpenAI API key
- n8n instance

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/teams-extractor.git
cd teams-extractor

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r mcp/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run processor
python -m processor.server
```

### Testing Locally

```bash
# Terminal 1: Run processor
python -m processor.server

# Terminal 2: Test health endpoint
curl http://localhost:8090/health

# Terminal 3: Send test message
curl -X POST http://localhost:8090/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "Test",
    "author": "Developer",
    "classification": {"type": "localized"},
    "resolutionText": "Test deployment"
  }'
```

---

## Docker Deployment

### Quick Start

```bash
# Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-key-here
N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook/teams
PROCESSOR_API_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://teams.microsoft.com
EOF

# Build and run
docker-compose up -d

# Check logs
docker-compose logs -f processor

# Check health
curl http://localhost:8090/health
```

### Build Custom Image

```bash
# Build image
docker build -t teams-processor:latest .

# Run container
docker run -d \
  --name teams-processor \
  -p 8090:8090 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e N8N_WEBHOOK_URL=$N8N_WEBHOOK_URL \
  -v $(pwd)/data:/app/data \
  teams-processor:latest

# View logs
docker logs -f teams-processor

# Stop container
docker stop teams-processor
docker rm teams-processor
```

### Docker Compose with MCP Server

```bash
# Start both processor and MCP server
docker-compose --profile mcp up -d

# Verify both services
curl http://localhost:8090/health  # Processor
curl http://localhost:8080/health  # MCP server
```

### Docker Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  processor:
    image: teams-processor:1.0.0
    restart: always
    ports:
      - "127.0.0.1:8090:8090"  # Only localhost access
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - PROCESSOR_API_KEY=${PROCESSOR_API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - /opt/teams-processor/data:/app/data
      - /var/log/teams-processor:/app/logs
    networks:
      - teams-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    networks:
      - teams-network
    depends_on:
      - processor

networks:
  teams-network:
    driver: bridge
```

```bash
# Deploy production
docker-compose -f docker-compose.prod.yml up -d
```

---

## Production Deployment

### System Requirements

**Minimum:**
- CPU: 1 core
- RAM: 512 MB
- Disk: 10 GB
- Network: Stable internet connection

**Recommended:**
- CPU: 2 cores
- RAM: 2 GB
- Disk: 50 GB SSD
- Network: Low latency to OpenAI and n8n

### Using systemd (Linux)

Create service file:

```bash
sudo nano /etc/systemd/system/teams-processor.service
```

```ini
[Unit]
Description=Teams-to-Jira Processor
After=network.target

[Service]
Type=simple
User=processor
Group=processor
WorkingDirectory=/opt/teams-processor
Environment="PATH=/opt/teams-processor/.venv/bin"
EnvironmentFile=/opt/teams-processor/.env
ExecStart=/opt/teams-processor/.venv/bin/python -m processor.server
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/teams-processor/data

# Logging
StandardOutput=append:/var/log/teams-processor/output.log
StandardError=append:/var/log/teams-processor/error.log

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
# Create user
sudo useradd -r -s /bin/false processor

# Setup directories
sudo mkdir -p /opt/teams-processor
sudo chown processor:processor /opt/teams-processor
sudo mkdir -p /var/log/teams-processor
sudo chown processor:processor /var/log/teams-processor

# Deploy code
sudo -u processor git clone https://github.com/yourusername/teams-extractor.git /opt/teams-processor
cd /opt/teams-processor
sudo -u processor python3 -m venv .venv
sudo -u processor .venv/bin/pip install -r mcp/requirements.txt

# Configure
sudo nano /opt/teams-processor/.env
# Add your environment variables

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable teams-processor
sudo systemctl start teams-processor

# Check status
sudo systemctl status teams-processor
sudo journalctl -u teams-processor -f
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/teams-processor
upstream teams-processor {
    server 127.0.0.1:8090;
}

server {
    listen 443 ssl http2;
    server_name processor.example.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/processor.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/processor.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Logging
    access_log /var/log/nginx/teams-processor-access.log;
    error_log /var/log/nginx/teams-processor-error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=processor:10m rate=10r/s;
    limit_req zone=processor burst=20 nodelay;

    location / {
        proxy_pass http://teams-processor;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    location /health {
        proxy_pass http://teams-processor;
        access_log off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name processor.example.com;
    return 301 https://$server_name$request_uri;
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/teams-processor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Certificate with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d processor.example.com

# Test renewal
sudo certbot renew --dry-run

# Auto-renewal is configured via systemd timer
sudo systemctl status certbot.timer
```

---

## Cloud Deployments

### AWS EC2

```bash
# Launch EC2 instance (Ubuntu 22.04)
# t3.small or larger recommended

# Connect via SSH
ssh -i your-key.pem ubuntu@ec2-instance-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# Deploy with Docker Compose
git clone https://github.com/yourusername/teams-extractor.git
cd teams-extractor
nano .env  # Configure
docker-compose up -d

# Configure security group
# Allow inbound: 443 (HTTPS), 22 (SSH from your IP)
# Allow outbound: All traffic
```

### AWS ECS (Fargate)

```json
{
  "family": "teams-processor",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "processor",
      "image": "your-ecr-repo/teams-processor:latest",
      "portMappings": [
        {
          "containerPort": 8090,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "ALLOWED_ORIGINS",
          "value": "https://teams.microsoft.com"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-key"
        },
        {
          "name": "PROCESSOR_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:processor-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/teams-processor",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8090/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Google Cloud Run

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/teams-processor', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/teams-processor']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'teams-processor'
      - '--image'
      - 'gcr.io/$PROJECT_ID/teams-processor'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
```

Deploy:

```bash
# Build and deploy
gcloud builds submit --config cloudbuild.yaml

# Set environment variables
gcloud run services update teams-processor \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY \
  --set-env-vars N8N_WEBHOOK_URL=$N8N_WEBHOOK_URL \
  --region us-central1
```

### Azure Container Instances

```bash
# Create resource group
az group create --name teams-processor-rg --location eastus

# Create container
az container create \
  --resource-group teams-processor-rg \
  --name teams-processor \
  --image your-acr.azurecr.io/teams-processor:latest \
  --cpu 1 \
  --memory 1 \
  --ports 8090 \
  --environment-variables \
    ALLOWED_ORIGINS=https://teams.microsoft.com \
  --secure-environment-variables \
    OPENAI_API_KEY=$OPENAI_API_KEY \
    N8N_WEBHOOK_URL=$N8N_WEBHOOK_URL \
    PROCESSOR_API_KEY=$PROCESSOR_API_KEY \
  --dns-name-label teams-processor-unique \
  --restart-policy Always
```

### Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: teams-processor
spec:
  replicas: 2
  selector:
    matchLabels:
      app: teams-processor
  template:
    metadata:
      labels:
        app: teams-processor
    spec:
      containers:
      - name: processor
        image: teams-processor:1.0.0
        ports:
        - containerPort: 8090
        env:
        - name: ALLOWED_ORIGINS
          value: "https://teams.microsoft.com"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: teams-processor-secrets
              key: openai-api-key
        - name: N8N_WEBHOOK_URL
          valueFrom:
            secretKeyRef:
              name: teams-processor-secrets
              key: n8n-webhook-url
        - name: PROCESSOR_API_KEY
          valueFrom:
            secretKeyRef:
              name: teams-processor-secrets
              key: processor-api-key
        livenessProbe:
          httpGet:
            path: /health
            port: 8090
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8090
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: teams-processor
spec:
  selector:
    app: teams-processor
  ports:
  - port: 80
    targetPort: 8090
  type: LoadBalancer
```

Deploy:

```bash
# Create secrets
kubectl create secret generic teams-processor-secrets \
  --from-literal=openai-api-key=$OPENAI_API_KEY \
  --from-literal=n8n-webhook-url=$N8N_WEBHOOK_URL \
  --from-literal=processor-api-key=$PROCESSOR_API_KEY

# Deploy
kubectl apply -f deployment.yaml

# Check status
kubectl get pods
kubectl logs -f deployment/teams-processor
```

---

## Monitoring & Logging

### Prometheus Metrics

Add metrics endpoint to processor:

```python
# Add to processor/server.py
from prometheus_client import Counter, Histogram, generate_latest

messages_total = Counter('messages_total', 'Total messages processed')
processing_duration = Histogram('processing_duration_seconds', 'Message processing duration')

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### Grafana Dashboard

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'teams-processor'
    static_configs:
      - targets: ['localhost:8090']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Centralized Logging

**Using Loki:**

```yaml
# docker-compose.monitoring.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
```

---

## Backup & Recovery

### Automated Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/teams-processor"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/opt/teams-processor/data/teams_messages.db"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/teams_messages_$DATE.db'"

# Compress
gzip $BACKUP_DIR/teams_messages_$DATE.db

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.db.gz" -mtime +30 -delete

echo "Backup completed: teams_messages_$DATE.db.gz"
```

Configure cron:

```bash
# Daily backup at 2 AM
0 2 * * * /opt/teams-processor/backup.sh >> /var/log/teams-processor/backup.log 2>&1
```

### Disaster Recovery

```bash
# Stop service
sudo systemctl stop teams-processor

# Restore database
gunzip -c /opt/backups/teams-processor/teams_messages_20251021.db.gz > /opt/teams-processor/data/teams_messages.db

# Fix permissions
sudo chown processor:processor /opt/teams-processor/data/teams_messages.db

# Start service
sudo systemctl start teams-processor
```

---

## High Availability Setup

### Load Balanced Configuration

```nginx
upstream processor_backend {
    least_conn;
    server processor1:8090 max_fails=3 fail_timeout=30s;
    server processor2:8090 max_fails=3 fail_timeout=30s;
    server processor3:8090 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl;
    server_name processor.example.com;

    location / {
        proxy_pass http://processor_backend;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
}
```

### Database Replication

For high availability, consider migrating from SQLite to PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: teams_processor
      POSTGRES_USER: processor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
```

---

## Environment-Specific Configurations

### Development

```bash
# .env.development
OPENAI_API_KEY=sk-dev-key
N8N_WEBHOOK_URL=http://localhost:5678/webhook/test
ALLOWED_ORIGINS=*
LOG_LEVEL=DEBUG
```

### Staging

```bash
# .env.staging
OPENAI_API_KEY=sk-staging-key
N8N_WEBHOOK_URL=https://staging-n8n.example.com/webhook/teams
PROCESSOR_API_KEY=staging-secret
ALLOWED_ORIGINS=https://staging.example.com
LOG_LEVEL=INFO
```

### Production

```bash
# .env.production
OPENAI_API_KEY=sk-prod-key
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/teams
PROCESSOR_API_KEY=prod-secret-very-long-key
ALLOWED_ORIGINS=https://teams.microsoft.com
LOG_LEVEL=WARNING
```

---

## Troubleshooting Deployments

See [README.md#troubleshooting](../README.md#troubleshooting) for detailed troubleshooting steps.

### Quick Checks

```bash
# Check service status
systemctl status teams-processor

# Check logs
journalctl -u teams-processor -n 100

# Test health endpoint
curl http://localhost:8090/health

# Check database
sqlite3 /opt/teams-processor/data/teams_messages.db "SELECT COUNT(*) FROM messages;"

# Check network connectivity
curl -I https://api.openai.com
curl -I $N8N_WEBHOOK_URL
```
