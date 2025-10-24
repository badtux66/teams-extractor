# Teams Message Extractor - Usage Guide

Comprehensive guide on using the Teams Message Extractor CLI.

## CLI Commands Overview

```bash
# Test connection
python -m src.cli.main test-connection

# Extract messages
python -m src.cli.main extract [OPTIONS]

# Incident investigation
python -m src.cli.main incident [OPTIONS]

# Run scheduled jobs
python -m src.cli.main schedule [OPTIONS]
```

## Basic Extraction

### Extract Messages from Last 24 Hours

```bash
python -m src.cli.main extract --last-hours 24 --format json
```

### Extract Messages from Date Range

```bash
python -m src.cli.main extract \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --format json html markdown
```

### Extract from Last Week

```bash
python -m src.cli.main extract --last-days 7 --format csv
```

## Filtering Options

### Filter by Keywords

```bash
python -m src.cli.main extract \
  --last-days 1 \
  --keywords "incident" \
  --keywords "outage" \
  --keywords "error" \
  --format json
```

### Filter by Channel

```bash
python -m src.cli.main extract \
  --last-hours 24 \
  --channel "Operations" \
  --channel "Incidents" \
  --format html
```

### Filter by Author

```bash
python -m src.cli.main extract \
  --last-days 7 \
  --author-email "user@company.com" \
  --format csv
```

### Limit Number of Messages

```bash
python -m src.cli.main extract \
  --last-days 30 \
  --max-messages 1000 \
  --format json
```

### Combined Filters

```bash
python -m src.cli.main extract \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --keywords "deployment" \
  --channel "DevOps" \
  --max-messages 500 \
  --format json html markdown csv
```

## Export Formats

### JSON Export

```bash
python -m src.cli.main extract --last-hours 24 --format json
```

Output includes:
- Full message metadata
- Attachments
- Reactions
- Mentions
- Extraction statistics

### CSV Export

```bash
python -m src.cli.main extract --last-hours 24 --format csv
```

Great for:
- Spreadsheet analysis
- Data imports
- Quick review

### HTML Export

```bash
python -m src.cli.main extract --last-hours 24 --format html
```

Features:
- Rich formatting
- Threaded conversations
- Statistics dashboard
- Reactions and attachments display

### Markdown Export

```bash
python -m src.cli.main extract --last-hours 24 --format markdown
```

Perfect for:
- Documentation
- GitHub/GitLab
- Confluence
- Wiki pages

## Incident Investigation

### Basic Incident Extraction

```bash
python -m src.cli.main incident \
  --title "Production Outage - Jan 15" \
  --start-date "2024-01-15T14:00:00" \
  --end-date "2024-01-15T16:30:00" \
  --create-jira-issue
```

### Incident with Custom Keywords

```bash
python -m src.cli.main incident \
  --title "Database Performance Issue" \
  --start-date "2024-01-20T09:00:00" \
  --keywords "database" \
  --keywords "slow" \
  --keywords "timeout" \
  --channel "Production Support" \
  --create-jira-issue \
  --jira-severity "High"
```

### Incident Report Only (No Jira)

```bash
python -m src.cli.main incident \
  --title "Network Connectivity Issues" \
  --start-date "2024-01-18T10:00:00" \
  --end-date "2024-01-18T12:00:00" \
  --keywords "network" \
  --keywords "connectivity"
```

## Integration Features

### Create Jira Issue

```bash
python -m src.cli.main extract \
  --last-hours 24 \
  --keywords "incident" \
  --create-jira-issue \
  --format json
```

### Create Confluence Page

```bash
python -m src.cli.main extract \
  --last-days 7 \
  --channel "Operations" \
  --create-confluence-page \
  --format html
```

### Send Email Notification

```bash
python -m src.cli.main extract \
  --last-hours 24 \
  --keywords "critical" \
  --send-email \
  --email-to "ops@company.com" \
  --email-to "manager@company.com" \
  --format json html
```

### All Integrations

```bash
python -m src.cli.main extract \
  --last-hours 6 \
  --keywords "incident" "outage" \
  --create-jira-issue \
  --create-confluence-page \
  --send-email \
  --email-to "ops@company.com" \
  --format json html markdown
```

## Scheduled Extractions

### Create Jobs Configuration

Create `config/jobs.yaml`:

```yaml
jobs:
  - name: "hourly-incident-monitor"
    enabled: true
    schedule: "0 * * * *"  # Every hour
    output_formats:
      - json
      - html
    extraction_config:
      keywords:
        - incident
        - outage
        - critical
      include_replies: true
```

### Run Scheduler

```bash
python -m src.cli.main schedule --job-config config/jobs.yaml --daemon
```

### Run as Background Service

```bash
# Using nohup
nohup python -m src.cli.main schedule --job-config config/jobs.yaml --daemon > scheduler.log 2>&1 &

# Using systemd (create service file)
sudo systemctl start teams-extractor
```

## Advanced Use Cases

### Daily Ops Summary

```bash
#!/bin/bash
# daily-ops-summary.sh

python -m src.cli.main extract \
  --last-hours 24 \
  --channel "Operations" \
  --channel "DevOps" \
  --format markdown html \
  --create-confluence-page \
  --send-email \
  --email-to "ops-team@company.com" \
  --output "output/daily-$(date +%Y%m%d)"
```

### Incident Timeline

```bash
# Extract all messages during incident window
python -m src.cli.main extract \
  --start-date "2024-01-15T14:00:00" \
  --end-date "2024-01-15T16:30:00" \
  --channel "Incidents" \
  --format markdown \
  --output "incident-timeline"
```

### User Activity Report

```bash
# Extract all messages from specific user
python -m src.cli.main extract \
  --last-days 30 \
  --author-email "user@company.com" \
  --format csv \
  --output "user-activity-reports"
```

### Compliance Export

```bash
# Export all messages for compliance
python -m src.cli.main extract \
  --start-date "2024-01-01" \
  --end-date "2024-03-31" \
  --format json \
  --output "compliance-q1-2024"
```

## Output Structure

### Default Output Directory

```
output/
├── teams_export_20240115_143022.json
├── teams_export_20240115_143022.csv
├── teams_export_20240115_143022.html
└── teams_export_20240115_143022.md
```

### Custom Output Directory

```bash
python -m src.cli.main extract \
  --last-hours 24 \
  --output "exports/$(date +%Y-%m-%d)" \
  --format json
```

## Configuration Options

### Using Custom Config File

```bash
python -m src.cli.main --config my-config.yaml extract --last-hours 24
```

### Setting Log Level

```bash
python -m src.cli.main --log-level DEBUG extract --last-hours 24
```

### Logging to File

```bash
python -m src.cli.main --log-file extraction.log extract --last-hours 24
```

## Tips and Best Practices

### 1. Start Small

Test with a small time range first:
```bash
python -m src.cli.main extract --last-hours 1 --format json
```

### 2. Use Specific Channels

Filter by channel to reduce noise:
```bash
python -m src.cli.main extract \
  --last-days 7 \
  --channel "Your-Important-Channel" \
  --format html
```

### 3. Keyword Filtering

Use specific keywords to find relevant messages:
```bash
python -m src.cli.main extract \
  --last-days 7 \
  --keywords "error" "exception" "failed" \
  --format json
```

### 4. Rate Limiting

If you hit rate limits:
- Reduce batch size
- Increase time between requests
- Extract from fewer channels at once

### 5. Large Extractions

For large extractions:
```bash
python -m src.cli.main extract \
  --last-days 30 \
  --max-messages 10000 \
  --format json
```

### 6. Automated Daily Backups

Create a cron job:
```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/teams-extractor && python -m src.cli.main extract --last-hours 24 --format json --output "backups/$(date +\%Y-\%m-\%d)"
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.
