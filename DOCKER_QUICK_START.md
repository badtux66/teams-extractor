# Teams Message Extractor - Docker Quick Start

## 🚀 One-Command Installation

```bash
make install
```

That's it! This single command will:
1. Create `.env` from template
2. Build all Docker images
3. Start all services
4. Run health checks
5. Display access URLs

## 📋 Prerequisites

```bash
# Check you have these installed:
docker --version        # Need 20.10+
docker-compose --version # Need 2.0+
make --version          # Optional but recommended
```

## ⚡ Quick Commands

```bash
# Start everything
make start              # Production mode
make start-dev          # Development mode with hot reload
make start-prod         # Production with resource limits

# Stop everything
make stop               # Graceful shutdown

# View what's running
make ps                 # Container status
make logs               # All logs
make health             # Run health checks

# Database operations
make db-stats           # Show statistics
make db-backup          # Backup database

# Maintenance
make backup             # Full backup
make clean              # Clean up
```

## 🔧 Configuration

Edit `.env` file with your API keys:

```bash
# Required
OPENAI_API_KEY=sk-your-openai-key-here
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/teams

# Optional
N8N_API_KEY=your-n8n-api-key
```

## 🌐 Access Points

After starting:

- **Web GUI**: http://localhost:3000
- **Backend API**: http://localhost:8090
- **API Docs**: http://localhost:8090/docs

## 📊 Environment Modes

### Development (Hot Reload)
```bash
make start-dev
```
- Source code auto-reload
- Debug logging
- No resource limits
- Perfect for coding

### Production (Optimized)
```bash
make start-prod
```
- Optimized builds
- Resource limits
- Log rotation
- Health monitoring
- Production-grade

### Default (Balanced)
```bash
make start
```
- Good for testing
- Reasonable defaults
- Easy debugging

## 🔍 Monitoring

```bash
# View all logs
make logs

# View specific service
make logs-backend
make logs-frontend

# Check health
make health

# Resource usage
make stats
```

## 💾 Backup & Restore

```bash
# Create backup
make backup

# Restore from backup
make restore

# Database only
make db-backup
```

## 🛠️ Troubleshooting

### Services won't start?
```bash
make logs              # Check error messages
make rebuild           # Rebuild from scratch
```

### Port already in use?
```bash
lsof -i :8090          # Find what's using port
# Change port in docker-compose.yml if needed
```

### Need to reset everything?
```bash
make clean             # Remove containers/volumes
make clean-all         # Deep clean (removes images too)
```

## 📚 Full Documentation

- [Docker Guide](docs/DOCKER_GUIDE.md) - Complete Docker documentation
- [User Manual](docs/USER_MANUAL.md) - How to use the GUI
- [Admin Guide](docs/ADMIN_GUIDE.md) - System administration
- [API Reference](docs/API_REFERENCE.md) - API documentation
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues

## 🎯 Common Workflows

### First Time Setup
```bash
git clone <repo-url>
cd teams-extractor
make install
nano .env              # Add your API keys
make restart
open http://localhost:3000
```

### Daily Development
```bash
make start-dev         # Start with hot reload
# Edit code, changes auto-reload
make logs-backend      # View backend logs
make stop              # When done
```

### Production Deployment
```bash
make start-prod        # Start production mode
make health            # Verify health
make backup            # Daily backup
```

### Database Maintenance
```bash
make db-stats          # View statistics
make db-backup         # Backup database
sqlite3 data/teams_messages.db  # Direct access
```

## 🔑 Pro Tips

1. **Use Makefile**: All commands available via `make <target>`
2. **Check Health**: Run `make health` to verify everything works
3. **Backup Regularly**: `make backup` before major changes
4. **View Logs**: `make logs` when something's wrong
5. **Dev Mode**: Use `make start-dev` when coding

## 🆘 Need Help?

```bash
make help              # Show all available commands
```

Or check the full documentation:
- [docs/DOCKER_GUIDE.md](docs/DOCKER_GUIDE.md)
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## 📦 What's Running?

```
┌─────────────────────────────────┐
│  Docker Host (localhost)        │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Backend Container       │  │
│  │  - Python/FastAPI        │  │
│  │  - Port: 8090            │  │
│  │  - SQLite Database       │  │
│  │  - OpenAI Integration    │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Frontend Container      │  │
│  │  - React/TypeScript      │  │
│  │  - Nginx                 │  │
│  │  - Port: 3000 (80)       │  │
│  └──────────────────────────┘  │
│                                 │
│  Volumes:                       │
│  - data/  (persistent)          │
│  - logs/  (persistent)          │
└─────────────────────────────────┘
```

## ✅ Verification Checklist

After `make install`:

- [ ] Both containers running: `make ps`
- [ ] Health checks pass: `make health`
- [ ] Can access GUI: http://localhost:3000
- [ ] Can access API: http://localhost:8090/docs
- [ ] Database created: `ls data/`
- [ ] Logs directory exists: `ls logs/`

---

**Ready to go!** Start with `make start` and access http://localhost:3000
