# Teams Message Extractor - Architecture Overview

## System Overview

The Teams Message Extractor is a modern, scalable system for extracting and analyzing Microsoft Teams messages using Chrome extension technology, with optional Claude Desktop MCP integration for intelligent querying and analysis.

## Architecture Goals

- Extract Teams messages without requiring Microsoft Graph API permissions
- Store and index messages for full-text search and analytics
- Provide real-time web dashboard for monitoring
- Enable AI-powered queries via Claude Desktop integration
- Maintain high performance with caching and deduplication
- Support Docker-based deployment for easy setup

## Architecture Diagram

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

## Component Architecture

### 1. Chrome Extension (Manifest V3)

**Location:** `chrome-extension/`

**Purpose:** Scrapes Teams messages from the browser DOM without requiring API access.

**Key Features:**
- Runs as content script on `https://teams.microsoft.com/*`
- Uses MutationObserver to detect new messages in real-time
- Extracts message content, sender, timestamp, channel, and metadata
- Batches messages for efficient API calls
- Implements retry logic for failed uploads
- Stores state in Chrome Storage API

**Files:**
- `manifest.json` - Extension configuration
- `content.js` - DOM scraping logic (600+ lines)
- `background.js` - Service worker for background tasks
- `popup.html/js` - Extension popup UI
- `options.html/js` - Settings page

**Extraction Logic:**
1. Wait for Teams page to fully load
2. Find message elements using DOM selectors
3. Extract text, author, timestamp, and metadata
4. Deduplicate using message IDs
5. Batch into groups (default: 50 messages)
6. POST to backend `/api/messages/batch` endpoint

### 2. Backend API (Node.js/Express)

**Location:** `backend/`

**Purpose:** Central API server for message ingestion, storage, and retrieval.

**Key Features:**
- RESTful API with comprehensive endpoints
- WebSocket support for real-time updates
- Input validation with Joi schemas
- Structured logging with Winston
- Health checks for orchestration
- Prometheus metrics endpoint

**Tech Stack:**
- Node.js 20 with Express
- Socket.io for WebSocket
- PostgreSQL client (pg)
- Redis client (ioredis)
- Helmet for security headers
- CORS middleware

**Core Endpoints:**
- `POST /api/messages/batch` - Bulk message ingestion
- `GET /api/messages` - List/search messages
- `GET /api/messages/:id` - Get single message
- `GET /api/stats` - Dashboard statistics
- `GET /api/health` - Health check
- `DELETE /api/messages/:id` - Delete message

### 3. PostgreSQL Database

**Location:** Docker container `postgres`

**Purpose:** Primary data store for all Teams messages.

**Schema:**
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  text TEXT NOT NULL,
  author VARCHAR(255),
  author_email VARCHAR(255),
  timestamp TIMESTAMPTZ,
  channel VARCHAR(255),
  url TEXT,
  type VARCHAR(50),
  thread_id VARCHAR(255),
  reactions JSONB,
  mentions JSONB,
  attachments JSONB,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_author ON messages(author);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_extracted_at ON messages(extracted_at);
CREATE INDEX idx_messages_text ON messages USING GIN(to_tsvector('english', text));
```

**Features:**
- Full-text search using PostgreSQL's native capabilities
- JSONB for flexible metadata storage
- Indexes for fast querying
- Timestamp with timezone support

### 4. Redis Cache

**Location:** Docker container `redis`

**Purpose:** High-performance caching and deduplication.

**Use Cases:**
- Message ID deduplication using SET data structure
- Caching frequently accessed data
- Session storage for WebSocket connections
- Rate limiting counters

**Key Operations:**
```redis
# Check if message exists
SISMEMBER messages:seen {messageId}

# Mark message as processed
SADD messages:seen {messageId}

# Cache message data (TTL: 1 hour)
SETEX message:{id} 3600 {jsonData}
```

### 5. Web Dashboard (React)

**Location:** `web-gui/frontend/`

**Purpose:** User interface for monitoring and managing message extraction.

**Tech Stack:**
- React 18 with TypeScript
- Material-UI components
- Recharts for data visualization
- Zustand for state management
- Vite for fast development
- Axios for API calls

**Features:**
- Real-time dashboard with WebSocket updates
- Message browser with search and filters
- Analytics charts (timeline, channels, senders)
- System health monitoring
- Configuration management
- Responsive design

**Pages:**
- Dashboard - Overview with statistics
- Messages - Browse and search messages
- Analytics - Visual charts and trends
- Settings - System configuration

### 6. MCP Server (Optional)

**Location:** `mcp-server/`

**Purpose:** Exposes Teams data to Claude Desktop for AI-powered queries.

**Features:**
- Implements Model Context Protocol (MCP)
- Provides read-only database access
- Natural language query interface
- Connects via stdio to Claude Desktop
- Runs locally on user's machine (not in Docker)

**Available Tools:**
- `list_messages` - Query messages with filters
- `search_messages` - Full-text search
- `get_message` - Get single message details
- `get_stats` - Database statistics

## Data Flow

### Message Extraction Flow

1. **User opens Teams channel** in Chrome browser
2. **Extension detects page load** and starts monitoring
3. **MutationObserver detects new messages** in DOM
4. **Extension extracts message data** from HTML elements
5. **Messages batched** (default: every 5 seconds or 50 messages)
6. **Extension POSTs batch** to `/api/messages/batch`
7. **Backend validates** incoming data
8. **Redis checks** for duplicate message IDs
9. **New messages stored** in PostgreSQL
10. **WebSocket broadcasts** update to connected dashboards
11. **Frontend updates** in real-time

### Query Flow (via MCP)

1. **User asks Claude** a question about Teams messages
2. **Claude invokes MCP tool** (e.g., `search_messages`)
3. **MCP server queries** PostgreSQL database
4. **Results returned** to Claude via stdio
5. **Claude analyzes and responds** to user

## Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Chrome Extension** | DOM scraping, message extraction, batching | Manifest V3, JavaScript, MutationObserver |
| **Backend API** | Message ingestion, validation, storage, API serving | Node.js, Express, Socket.io |
| **PostgreSQL** | Primary data storage, full-text search | PostgreSQL 15 |
| **Redis** | Deduplication, caching, session storage | Redis 7 |
| **Frontend** | User interface, visualization, monitoring | React 18, TypeScript, Material-UI |
| **MCP Server** | Claude Desktop integration, AI queries | Node.js, MCP protocol |

## Failure Handling

### Chrome Extension Resilience
- Retry failed API calls with exponential backoff
- Queue messages locally if backend unavailable
- Sync queued messages when backend recovers
- Handle Teams DOM changes gracefully

### Backend Resilience
- Health checks for PostgreSQL and Redis
- Graceful degradation if Redis unavailable
- Transaction support for data consistency
- Comprehensive error logging

### Database Resilience
- Connection pooling (max 20 connections)
- Automatic reconnection on connection loss
- Query timeout protection (30 seconds)
- Index maintenance for performance

## Security Considerations

### Extension Security
- Content Security Policy (CSP) enforcement
- No inline script execution
- Permissions limited to teams.microsoft.com
- No persistent background page

### Backend Security
- Helmet middleware for HTTP headers
- CORS configuration
- Input validation on all endpoints
- SQL injection protection via parameterized queries
- Rate limiting (future enhancement)

### Database Security
- Non-root PostgreSQL user
- Password-based authentication
- Network isolation in Docker
- Read-only user for MCP server

### Container Security
- All containers run as non-root users
- Minimal base images
- No secrets in Docker images
- Environment variable-based configuration

## Performance Characteristics

### Throughput
- **Extension:** 50-100 messages per batch
- **Backend:** 500+ messages/second ingestion
- **Database:** 1000+ queries/second
- **Redis:** 10000+ operations/second

### Latency
- **Message extraction:** < 100ms per message
- **API response time:** < 50ms average
- **Database query:** < 10ms for indexed lookups
- **WebSocket update:** < 20ms

### Scalability
- **Current:** Single-node deployment
- **Future:** Horizontal scaling with load balancer
- **Database:** Can handle millions of messages
- **Redis:** In-memory, scales to available RAM

## Deployment Architecture

### Development
```yaml
services:
  - postgres (local)
  - redis (local)
  - backend (local dev server, hot reload)
  - frontend (Vite dev server, hot reload)
```

### Production (Docker Compose)
```yaml
services:
  - postgres (Docker container, volume-backed)
  - redis (Docker container, volume-backed)
  - backend (Docker container, health checks)
  - frontend (Nginx-served React build)
  - nginx (optional reverse proxy)
  - prometheus (optional monitoring)
  - grafana (optional visualization)
```

## Technology Decisions

### Why Chrome Extension over API?
- ✅ No Microsoft Graph API permissions required
- ✅ Works with any Teams account
- ✅ No rate limiting issues
- ✅ Captures real-time messages as they appear
- ✅ Simpler setup (no OAuth flow)
- ❌ Requires browser to be open
- ❌ Limited to visible messages in viewport

### Why PostgreSQL over MongoDB?
- ✅ ACID transactions
- ✅ Native full-text search
- ✅ Mature and stable
- ✅ Better for structured data
- ✅ Strong query optimizer

### Why Redis over Memcached?
- ✅ Richer data structures (SET for dedup)
- ✅ Persistence options
- ✅ Pub/Sub for WebSocket
- ✅ Better documentation

### Why Node.js over Python?
- ✅ Better async I/O for real-time updates
- ✅ Unified JavaScript across frontend/backend
- ✅ Excellent WebSocket support
- ✅ Fast startup time

## Future Enhancements

### Planned Features
- [ ] Authentication and user management
- [ ] Advanced analytics and custom reports
- [ ] Export to CSV/Excel/JSON
- [ ] Email notifications
- [ ] Mobile PWA support
- [ ] Teams bot for bidirectional communication
- [ ] Enterprise SSO integration
- [ ] Multi-tenancy support

### Scalability Improvements
- [ ] Read replicas for PostgreSQL
- [ ] Redis Cluster for distributed caching
- [ ] Horizontal backend scaling with load balancer
- [ ] CDN for frontend assets
- [ ] Message archiving to S3/object storage

## Monitoring and Observability

### Logs
- **Backend:** Winston structured logging to files and console
- **Extension:** Console logging with debug levels
- **Database:** PostgreSQL query logs
- **Redis:** Redis slow log

### Metrics (with Prometheus)
- HTTP request rates and latencies
- Database connection pool status
- Message ingestion rate
- WebSocket connection count
- Cache hit/miss ratios
- Error rates by endpoint

### Health Checks
- `/api/health` - Overall system health
- `/api/health/ready` - Readiness probe
- `/api/health/live` - Liveness probe
- Individual service health checks

## Troubleshooting Guide

### Common Issues

**Messages not appearing in dashboard:**
1. Check extension is enabled in Chrome
2. Verify backend is running: `curl http://localhost:5000/api/health`
3. Check backend logs: `docker-compose logs backend`
4. Verify PostgreSQL is accepting connections

**Extension not extracting:**
1. Check you're on teams.microsoft.com
2. Open browser console (F12) for errors
3. Verify selectors haven't changed (Teams UI updates)
4. Reload extension from chrome://extensions

**High memory usage:**
1. Check number of messages in database
2. Review Redis memory usage: `docker exec redis redis-cli info memory`
3. Clear Redis cache if needed
4. Archive old messages

## References

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)

---

**Document Version:** 2.0
**Last Updated:** November 2024
**Architecture Version:** Chrome Extension-based (v2.0)
