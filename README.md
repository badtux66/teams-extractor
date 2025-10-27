# Teams Message Extractor

A modern, scalable system for extracting and analyzing Microsoft Teams messages using Chrome extension technology, with Claude Desktop MCP integration for intelligent querying and analysis.

## 🚀 Features

- **Chrome Extension** - Seamless Teams message extraction via DOM scraping (no API permissions required)
- **Web-Based Dashboard** - Modern React UI for monitoring and analytics
- **Real-Time Updates** - WebSocket-powered live message feed
- **PostgreSQL Storage** - Scalable database with full-text search
- **Redis Caching** - High-performance deduplication and caching
- **Claude MCP Integration** - Query and analyze messages directly from Claude Desktop
- **Docker Deployment** - One-command setup with Docker Compose
- **RESTful API** - Comprehensive API for programmatic access

## 📦 Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Teams Website  │────▶│   Chrome     │────▶│   Backend   │
│ (teams.ms.com)  │     │  Extension   │     │  (Node.js)  │
└─────────────────┘     └──────────────┘     └──────┬──────┘
                                                     │
                                           ┌─────────┼──────────┐
                                           ▼         ▼          ▼
                                    ┌──────────┐ ┌──────┐ ┌─────────┐
                                    │PostgreSQL│ │Redis │ │Frontend │
                                    └──────────┘ └──────┘ └─────────┘
                                           ▲
                                           │
                                    ┌──────┴──────┐
                                    │ MCP Server  │
                                    │  (Claude)   │
                                    └─────────────┘
```

## 📂 Components

- **`chrome-extension/`** – Manifest V3 Chrome extension for message extraction
- **`backend/`** – Node.js/Express API server with PostgreSQL and Redis
- **`web-gui/`** – React frontend with Material-UI dashboard
- **`mcp-server/`** – Claude Desktop MCP server for AI-powered queries
- **`init-scripts/`** – PostgreSQL initialization and schema
- **`docs/`** – Comprehensive documentation

## 🔧 Prerequisites

- **Docker & Docker Compose** (recommended for full stack deployment)
- Chrome/Edge browser (Manifest V3 compatible)
- Access to Microsoft Teams web client (https://teams.microsoft.com)
- Claude Desktop (optional, for MCP integration)

## 🚀 Quick Start with Docker

The easiest way to run the entire system:

```bash
# 1. Clone the repository
git clone <repository-url>
cd teams-extractor

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your configuration (PostgreSQL credentials, ports, etc.)

# 3. Start all services with Docker Compose
docker-compose up -d

# 4. Access the web interface
open http://localhost:3000
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🖥️ Web GUI Features

### Dashboard
- Real-time system health monitoring
- Message extraction statistics
- Today's and weekly activity metrics
- Live WebSocket updates
- Database and Redis connection status

### Message Viewer
- Browse all extracted messages
- Filter by channel, sender, or date range
- Full-text search with PostgreSQL
- View detailed message information
- Pagination and sorting
- Export data

### Analytics
- Visual charts and graphs
- Channel activity breakdown
- Sender statistics
- Timeline trends (daily/weekly/monthly)
- Message type distribution

### Settings
- Configure extraction intervals
- Manage Chrome extension settings
- System configuration
- API endpoint management

## 📖 Manual Setup (Without Docker)

### 1. Setup PostgreSQL and Redis
```bash
# Install PostgreSQL and Redis on your system
# For Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib redis-server

# Create database and user
sudo -u postgres psql
CREATE DATABASE teams_extractor;
CREATE USER teams_admin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE teams_extractor TO teams_admin;
\q

# Run initialization script
psql -U teams_admin -d teams_extractor -f init-scripts/01-init.sql
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

### 3. Install Frontend Dependencies
```bash
cd web-gui/frontend
npm install
cd ../..
```

### 4. Configure Environment
```bash
cp .env.example .env
# Edit .env with your PostgreSQL and Redis credentials
```

### 5. Run the Backend
```bash
cd backend
DATABASE_URL=postgresql://teams_admin:your_password@localhost:5432/teams_extractor \
REDIS_HOST=localhost \
PORT=5000 \
node server.js
```

The backend API listens on `http://localhost:5000`.

### 6. Run the Frontend
```bash
cd web-gui/frontend
REACT_APP_API_URL=http://localhost:5000/api npm run dev
```

The web GUI will be available at `http://localhost:3000`.

### 7. Load the Chrome Extension
1. Open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**
2. Select the `chrome-extension/` folder
3. Click the extension icon and configure:
   - API URL: `http://localhost:5000/api`
   - Batch Size: `50` (default)
   - Extraction Interval: `5000ms` (5 seconds)
4. Save the settings

### 8. Test the System
1. Open Microsoft Teams in your browser (https://teams.microsoft.com)
2. Navigate to any channel or chat
3. The extension will automatically start extracting visible messages
4. Check the extension popup to see extraction status
5. View extracted messages in the Web GUI at `http://localhost:3000`
6. Use the dashboard to monitor real-time statistics

## 📚 Documentation

- [User Manual](docs/USER_MANUAL.md) - Complete guide for end users
- [Administrator Guide](docs/ADMIN_GUIDE.md) - Deployment and configuration
- [API Documentation](docs/API_REFERENCE.md) - REST API endpoints
- [Architecture Overview](docs/architecture.md) - System design and data flow
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions

## 🔌 API Endpoints

The backend exposes a comprehensive RESTful API:

**Message Management:**
- `POST /api/messages/batch` - Bulk message ingestion (used by Chrome extension)
- `GET /api/messages` - List messages with filtering and pagination
- `GET /api/messages/:id` - Get single message details
- `GET /api/messages/search` - Full-text search messages
- `DELETE /api/messages/:id` - Delete message

**Statistics & Analytics:**
- `GET /api/stats` - Comprehensive dashboard statistics
- `GET /api/stats/channels` - Channel-level analytics
- `GET /api/stats/senders` - Sender-level analytics
- `GET /api/stats/timeline` - Time-series message data

**Health & Monitoring:**
- `GET /api/health` - Comprehensive health check
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe
- `GET /api/health/metrics` - Prometheus metrics

**Extraction Management:**
- `POST /api/extraction/trigger` - Manually trigger extraction
- `GET /api/extraction/sessions` - List extraction sessions
- `GET /api/extraction/active` - Get active session
- `PATCH /api/extraction/sessions/:id` - Update session status

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# View backend logs only
docker-compose logs -f backend

# View frontend logs only
docker-compose logs -f frontend
```

## ⚙️ Customization Tips

- **DOM Selectors**: Update selectors in `chrome-extension/content.js` if Microsoft changes Teams markup
- **Extraction Interval**: Adjust `EXTENSION_INTERVAL` in .env for more/less frequent extraction
- **Batch Size**: Modify `EXTENSION_BATCH_SIZE` to change how many messages are sent per request
- **Database Schema**: Extend PostgreSQL schema in `init-scripts/01-init.sql` for custom fields
- **MCP Queries**: Customize MCP server handlers in `mcp-server/` for specific use cases

## 📊 Logging & Monitoring

- **Chrome Extension**: Logs to browser console (chrome://extensions → Inspect views)
- **Backend**: Structured logging with Winston (logs/ directory)
- **Health Checks**: Multiple endpoints for Kubernetes/Docker orchestration
- **Prometheus**: Metrics endpoint at `/api/health/metrics`
- **WebSocket**: Real-time status updates to frontend dashboard
- **Database Metrics**: Connection pool and query performance tracking

## 🎨 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Material-UI for components
- Recharts for data visualization
- Zustand for state management
- Vite for fast development
- Axios for API communication

**Backend:**
- Node.js 20 with Express
- PostgreSQL 15 for storage
- Redis for caching and deduplication
- Socket.io for WebSocket support
- Joi for validation
- Winston for structured logging

**Chrome Extension:**
- Manifest V3
- Content scripts for DOM scraping
- Background service worker
- Chrome Storage API

**DevOps:**
- Docker & Docker Compose
- Multi-stage Dockerfile builds
- Health check scripts
- Nginx reverse proxy (optional)
- PostgreSQL and Redis containers

## 🔒 Security Considerations

- **Non-root Containers**: All Docker containers run as non-root users
- **Environment Variables**: Sensitive data stored in .env files (never committed)
- **CORS**: Properly configured for frontend-backend communication
- **Helmet**: HTTP security headers middleware
- **SQL Injection Protection**: Parameterized queries throughout
- **Input Validation**: Comprehensive Joi schemas for all API endpoints
- **Health Checks**: Separate readiness and liveness probes
- **Redis Password**: Optional password protection for Redis

## 🆘 Support

For issues and questions:
- Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Open an issue on GitHub
- Contact the development team

## 🎯 Roadmap

- [x] Chrome extension for seamless Teams message extraction
- [x] PostgreSQL with full-text search
- [x] Redis caching and deduplication
- [x] WebSocket for real-time updates
- [x] Comprehensive REST API
- [ ] Claude Desktop MCP server integration
- [ ] Authentication and user management
- [ ] Advanced analytics and custom reports
- [ ] Export data to multiple formats (CSV, Excel, JSON)
- [ ] Email notifications for important events
- [ ] Mobile-responsive PWA
- [ ] Teams bot integration for bidirectional communication
- [ ] Enterprise deployment with SSO
