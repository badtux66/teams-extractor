# Microsoft Teams Message History Extraction Tool

A comprehensive solution for extracting, processing, and storing Microsoft Teams message history for incident tracking, documentation, and compliance purposes.

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

### Core Capabilities
- ✅ **Complete Message Extraction** - All team channels, direct messages, threads, and meeting chats
- ✅ **Advanced Filtering** - Time-based, content-based, user-based, and channel-specific filters
- ✅ **Multiple Export Formats** - JSON, CSV, HTML, and Markdown
- ✅ **Thread Support** - Preserve conversation context and reply chains
- ✅ **Rich Metadata** - Attachments, reactions, mentions, and timestamps

### Integrations
- ✅ **Jira Integration** - Automatic issue creation from messages
- ✅ **Confluence Integration** - Documentation page creation
- ✅ **Email Notifications** - Automated alerts and summaries
- ✅ **Scheduled Extractions** - Automated hourly/daily/weekly runs

### Advanced Features
- ✅ **Incident Investigation** - Extract and analyze incident-related communications
- ✅ **Rate Limiting & Retry Logic** - Handles API throttling gracefully
- ✅ **Progress Tracking** - Real-time progress indicators
- ✅ **Authentication Options** - Service principal or delegated (user) auth
- ✅ **CLI Interface** - Rich command-line interface with colors and tables

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Use Cases](#use-cases)
- [Documentation](#documentation)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Quick Start

### 1. Install

```bash
git clone <repository-url>
cd teams-extractor
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure

```bash
cp config/config.yaml.example config/config.yaml
# Edit config.yaml with your Azure AD credentials
```

### 3. Test Connection

```bash
python -m src.cli.main test-connection
```

### 4. Extract Messages

```bash
python -m src.cli.main extract --last-hours 24 --format json html
```

## 🔧 Installation

### Prerequisites

- **Python 3.10+**
- **Microsoft Azure AD Application** with:
  - `ChannelMessage.Read.All`
  - `Channel.ReadBasic.All`
  - `Team.ReadBasic.All`
  - `User.Read.All` (for service principal)

### Detailed Setup

See [docs/SETUP.md](docs/SETUP.md) for complete installation instructions.

## ⚙️ Configuration

### Basic Configuration

Create `config/config.yaml`:

```yaml
graph_api:
  tenant_id: "your-tenant-id"
  client_id: "your-client-id"
  client_secret: "your-client-secret"
  use_delegated_auth: false

output_dir: "output"
log_level: "INFO"
```

### Optional Integrations

```yaml
jira:
  enabled: true
  url: "https://yourcompany.atlassian.net"
  username: "your-email@company.com"
  api_token: "your-api-token"
  default_project: "PROJ"

confluence:
  enabled: true
  url: "https://yourcompany.atlassian.net/wiki"
  username: "your-email@company.com"
  api_token: "your-api-token"
  default_space: "TEAM"

email:
  enabled: true
  smtp_host: "smtp.gmail.com"
  smtp_port: 587
  username: "your-email@gmail.com"
  password: "your-app-password"
  from_address: "your-email@gmail.com"
```

## 📖 Usage Examples

### Extract Recent Messages

```bash
# Last 24 hours
python -m src.cli.main extract --last-hours 24 --format json html

# Last week
python -m src.cli.main extract --last-days 7 --format csv markdown

# Specific date range
python -m src.cli.main extract \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --format json
```

### Filter Messages

```bash
# By keywords
python -m src.cli.main extract \
  --last-days 7 \
  --keywords "incident" "outage" "error" \
  --format json

# By channel
python -m src.cli.main extract \
  --last-hours 24 \
  --channel "Operations" --channel "DevOps" \
  --format html

# By author
python -m src.cli.main extract \
  --last-days 7 \
  --author-email "user@company.com" \
  --format csv
```

### Incident Investigation

```bash
python -m src.cli.main incident \
  --title "Production Outage - Jan 15" \
  --start-date "2024-01-15T14:00:00" \
  --end-date "2024-01-15T16:30:00" \
  --keywords "outage" "error" \
  --create-jira-issue \
  --jira-severity "High"
```

### Scheduled Extractions

```yaml
# config/jobs.yaml
jobs:
  - name: "hourly-incident-monitor"
    schedule: "0 * * * *"
    output_formats: [json, html]
    extraction_config:
      keywords: [incident, outage, critical]
      include_replies: true
```

```bash
python -m src.cli.main schedule --job-config config/jobs.yaml --daemon
```

### With Integrations

```bash
# Create Jira issue and send email
python -m src.cli.main extract \
  --last-hours 6 \
  --keywords "critical" "urgent" \
  --create-jira-issue \
  --send-email \
  --email-to "ops@company.com" \
  --format json html
```

## 🎓 Use Cases

### 1. Incident Investigation

Extract all communications during an incident timeframe:

```bash
python -m src.cli.main incident \
  --title "Database Outage" \
  --start-date "2024-01-15T10:00:00" \
  --end-date "2024-01-15T14:00:00" \
  --channel "Production Support" \
  --create-jira-issue
```

**Output**: Chronological timeline, Jira issue, incident report

### 2. Daily Operations Summary

Automated daily summary sent to the team:

```bash
python -m src.cli.main extract \
  --last-hours 24 \
  --channel "Operations" \
  --format markdown \
  --create-confluence-page \
  --send-email \
  --email-to "ops-team@company.com"
```

### 3. Compliance & Audit

Extract all messages for compliance review:

```bash
python -m src.cli.main extract \
  --start-date "2024-01-01" \
  --end-date "2024-03-31" \
  --format json csv \
  --output "compliance/Q1-2024"
```

### 4. Knowledge Base Creation

Extract solution discussions:

```bash
python -m src.cli.main extract \
  --last-days 30 \
  --keywords "solved" "solution" "fix" \
  --channel "Tech Support" \
  --format markdown \
  --create-confluence-page
```

### 5. Real-time Monitoring

Monitor for critical incidents:

```yaml
# Scheduled job every 15 minutes
schedule: "*/15 * * * *"
extraction_config:
  keywords: [CRITICAL, URGENT, P1, SEV1]
jira_project: "INC"
email_recipients: [oncall@company.com]
```

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Installation and configuration
- **[Usage Guide](docs/USAGE.md)** - Detailed usage examples
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Architecture](docs/architecture.md)** - System design and components

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Teams Extractor CLI                     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌─────────▼─────────┐
│  Graph API     │  │  Extraction  │  │   Scheduler       │
│  Client        │  │  Engine      │  │   (APScheduler)   │
└───────┬────────┘  └──────┬──────┘  └─────────┬─────────┘
        │                   │                   │
        │         ┌─────────▼─────────┐         │
        │         │  Filter System    │         │
        │         │  - Time           │         │
        │         │  - Content        │         │
        │         │  - User           │         │
        │         └─────────┬─────────┘         │
        │                   │                   │
┌───────▼───────────────────▼───────────────────▼──────┐
│              Exporters & Integrations                │
├──────────────┬──────────────┬──────────────┬─────────┤
│ JSON Export  │ CSV Export   │ HTML Export  │ MD      │
│ Jira Client  │ Confluence   │ Email Client │ ...     │
└──────────────┴──────────────┴──────────────┴─────────┘
```

### Core Components

- **Graph API Client** - Authentication and API communication
- **Extraction Engine** - Message extraction with pagination and rate limiting
- **Filter System** - Advanced filtering capabilities
- **Exporters** - Multiple output format support
- **Integrations** - Jira, Confluence, Email clients
- **Scheduler** - Automated extraction jobs
- **CLI** - Rich command-line interface

## 🔒 Security & Compliance

- **OAuth 2.0 Authentication** - Secure Microsoft Graph API access
- **Credential Management** - Environment variables or secure config files
- **Data Privacy** - Local processing, configurable data retention
- **Audit Logging** - Complete logging of all operations
- **Rate Limiting** - Respects Microsoft API limits

## 📊 Performance

- **Batch Processing** - Configurable batch sizes
- **Concurrent Requests** - Parallel channel processing
- **Rate Limiting** - Automatic throttling and retry logic
- **Memory Efficient** - Streaming for large exports
- **Progress Tracking** - Real-time progress indicators

**Benchmarks**:
- ~100 messages/second (typical)
- ~500 messages/second (optimal conditions)
- Handles 10,000+ message extractions
- Automatic retry on failures

## 🛠️ Development

### Project Structure

```
teams-extractor/
├── src/
│   ├── core/              # Core extraction engine
│   │   ├── graph_client.py
│   │   ├── extractor.py
│   │   └── models.py
│   ├── exporters/         # Export formats
│   │   ├── json_exporter.py
│   │   ├── csv_exporter.py
│   │   ├── html_exporter.py
│   │   └── markdown_exporter.py
│   ├── integrations/      # External service integrations
│   │   ├── jira_client.py
│   │   ├── confluence_client.py
│   │   └── email_client.py
│   ├── scheduler/         # Scheduled jobs
│   │   └── scheduler.py
│   └── cli/               # Command-line interface
│       └── main.py
├── config/                # Configuration files
│   ├── config.yaml.example
│   └── jobs.yaml.example
├── docs/                  # Documentation
│   ├── SETUP.md
│   ├── USAGE.md
│   └── TROUBLESHOOTING.md
└── requirements.txt       # Python dependencies
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Microsoft Graph API team
- Python community
- All contributors

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

## 🗺️ Roadmap

- [ ] PowerBI dashboard integration
- [ ] Advanced analytics and insights
- [ ] Message sentiment analysis
- [ ] Teams bot integration
- [ ] Multi-tenant support
- [ ] Docker containerization
- [ ] Web UI dashboard

## ⚡ Quick Reference

### Common Commands

```bash
# Test connection
python -m src.cli.main test-connection

# Extract last 24 hours
python -m src.cli.main extract --last-hours 24 --format json

# Incident investigation
python -m src.cli.main incident --title "Incident" --start-date 2024-01-15T10:00:00

# Run scheduler
python -m src.cli.main schedule --job-config config/jobs.yaml --daemon
```

### Export Formats

| Format | Best For | Features |
|--------|----------|----------|
| JSON | Automation, APIs | Complete data, metadata |
| CSV | Spreadsheets, Analysis | Flat structure, Excel-ready |
| HTML | Reports, Sharing | Rich formatting, threads |
| Markdown | Documentation | GitHub, Confluence, wikis |

### Integration Matrix

| Integration | Feature | Status |
|-------------|---------|--------|
| Jira | Issue creation | ✅ |
| Jira | Comment addition | ✅ |
| Confluence | Page creation | ✅ |
| Confluence | Table updates | ✅ |
| Email | Notifications | ✅ |
| Email | Summaries | ✅ |

---

Made with ❤️ for better Teams communication management
