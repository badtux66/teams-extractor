# Teams Message Extractor with Web GUI

A comprehensive automation system that captures Microsoft Teams messages, processes them with AI, and creates Jira issues automatically. Includes a modern web-based GUI for monitoring, management, and analytics.

## 🚀 Features

- **Web-Based Dashboard** - Modern React UI for monitoring and managing your automation
- **Real-Time Processing** - Automatic message extraction and Jira issue creation
- **AI-Powered Analysis** - Uses OpenAI to enrich and classify messages
- **Analytics & Reporting** - Visualize trends and track performance
- **Easy Deployment** - Docker Compose for one-command setup
- **Flexible Integration** - Works with n8n, Jira, and Teams

## 📦 Components

- `web-gui/` – Modern React frontend with Material-UI and real-time dashboard
- `extension/` – Manifest v3 extension that watches the Teams web client
- `processor/server.py` – FastAPI service with REST API for GUI integration
- `mcp/agent.py` & `mcp/teams_agent.py` – AI-powered message processing
- `n8n/workflows/` – n8n workflow templates for Jira integration
- `docs/` – Comprehensive documentation

## 🔧 Prerequisites

- **Docker & Docker Compose** (recommended) OR:
  - Python 3.10+ for backend
  - Node.js 18+ for frontend
- Chrome/Edge browser (Manifest v3 compatible)
- Access to Microsoft Teams web client (https://teams.microsoft.com)
- OpenAI API key
- n8n Cloud workspace (or self-hosted) with Jira credentials configured

## 🚀 Quick Start with Docker

The easiest way to run the entire system:

```bash
# 1. Clone the repository
git clone <repository-url>
cd teams-extractor

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add your API keys

# 3. Start everything with Docker Compose
docker-compose up -d

# 4. Access the web interface
open http://localhost:3000
```

The Web GUI will be available at `http://localhost:3000` and the API at `http://localhost:8090`.

## 🖥️ Web GUI Features

### Dashboard
- Real-time system health monitoring
- Message processing statistics
- Today's and weekly activity metrics
- n8n connection status

### Message Viewer
- Browse all processed messages
- Filter by status, author, channel, or date
- Search messages with full-text search
- View detailed message information
- Retry failed messages
- Export data

### Analytics
- Visual charts and graphs
- Status distribution (pie charts)
- Timeline trends (line charts)
- Classification type breakdown

### Settings
- Configure OpenAI API key
- Set n8n webhook URL
- Manage processing options
- Auto-retry configuration

## 📖 Manual Setup (Without Docker)

### 1. Install Backend Dependencies
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r mcp/requirements.txt
```

### 2. Install Frontend Dependencies
```bash
cd web-gui/frontend
npm install
cd ../..
```

### 3. Run the Backend
```bash
export OPENAI_API_KEY=sk-...
export N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/teams-guncelleme
export N8N_API_KEY=my-shared-secret  # optional
python -m processor.server
```

The backend API listens on `http://localhost:8090` by default.

### 4. Run the Frontend
```bash
cd web-gui/frontend
npm run dev
```

The web GUI will be available at `http://localhost:3000`.

### 5. Import the n8n Workflow
1. In n8n, go to **Workflows → Import from File** and select `n8n/workflows/jira-teams.json`.
2. Set the webhook path if you want a custom slug (defaults to `/webhook/teams-guncelleme`).
3. Bind Jira credentials on the **Create Jira Issue** node.
4. Update the Function node with your Jira custom field IDs or default project key.
5. Activate the workflow and copy the live webhook URL (use it in `N8N_WEBHOOK_URL`).

### 6. Load the Browser Extension
1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select the `extension/` folder.
3. Open the extension options page:
   - Paste the Processor URL, e.g., `http://localhost:8090/ingest`.
   - Set the optional API key if you protected the processor with `X-API-Key`.
   - Enter your Teams display name (only your messages are processed).
   - Leave `Channel Name` as `Güncelleme Planlama` or adjust if you use multiple rooms.
   - Adjust keywords if you have additional confirmation phrases.
4. Save the settings.

### 7. Test the System
1. Post a test request and reply with `Güncellendi` in the `Güncelleme Planlama` channel.
2. Watch the extension logs (`chrome://extensions → Inspect views`) to confirm the message is captured and sent to the processor.
3. Check the **Web GUI Dashboard** at `http://localhost:3000` to see the message being processed.
4. In the **Messages** page, view the stored record and Jira payload.
5. In n8n, inspect the execution to ensure the issue was created with the supplied payload.
6. Verify the Jira issue summary/description look correct.

## 📚 Documentation

- [User Manual](docs/USER_MANUAL.md) - Complete guide for end users
- [Administrator Guide](docs/ADMIN_GUIDE.md) - Deployment and configuration
- [API Documentation](docs/API_REFERENCE.md) - REST API endpoints
- [Architecture Overview](docs/architecture.md) - System design and data flow
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions

## 🔌 API Endpoints

The backend exposes a RESTful API:

- `GET /health` - System health check
- `GET /stats` - Get statistics
- `GET /messages` - List all messages (with filters)
- `GET /messages/{id}` - Get message details
- `POST /messages/{id}/retry` - Retry failed message
- `DELETE /messages/{id}` - Delete message
- `GET /config` - Get configuration
- `PUT /config` - Update configuration
- `POST /ingest` - Ingest new message (used by extension)

Full API documentation available at `http://localhost:8090/docs` (OpenAPI/Swagger).

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

## Customisation Tips
- Update DOM selectors inside `extension/contentScript.js` if Microsoft changes the Teams markup. The selectors are grouped at the top of the file.
- Extend the MCP prompt or default field mapping in `mcp/agent.py` / `processor/server.py` to match your Jira taxonomy.
- Add extra validation in n8n (for example, prevent duplicate creation by checking Jira for an existing summary before creating a new issue).
- Use the SQLite database for analytics or to replay messages into Jira.

## Logging & Monitoring
- Extension retries failed processor calls every minute and logs to the service worker console.
- The processor exposes `/health` (model + n8n connectivity) and stores every message with status transitions.
- The Web GUI provides real-time dashboard monitoring with visual analytics.
- n8n provides execution history – enable Slack or email alerts on failure runs.

## 🎨 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Material-UI for components
- Recharts for data visualization
- Zustand for state management
- Vite for fast development

**Backend:**
- FastAPI (Python)
- SQLite for message storage
- OpenAI for AI processing
- httpx for async HTTP

**DevOps:**
- Docker & Docker Compose
- Nginx for frontend serving
- Multi-stage builds for optimization

## 🔒 Security Considerations

- All API keys stored in environment variables or config files (not in code)
- CORS configured for frontend-backend communication
- Optional API key authentication for processor endpoints
- Nginx reverse proxy for production deployment
- No sensitive data exposed in logs

## 🆘 Support

For issues and questions:
- Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Open an issue on GitHub
- Contact the development team

## 🎯 Next Steps

- Add authentication and user management to the web GUI
- Implement WebSocket for real-time updates
- Add Teams bot integration for bidirectional communication
- Export data to multiple formats (CSV, Excel, JSON)
- Implement advanced analytics and custom reports
- Add email notifications for failed messages
- Create mobile-responsive progressive web app (PWA)
- Package the extension (crx) and distribute internally via Group Policy or the Chrome Web Store private listing
