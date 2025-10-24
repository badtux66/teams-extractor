#!/bin/bash

# Teams Message Extractor - Setup Script
# This script helps set up the Teams Message Extractor tool

set -e

echo "=================================="
echo "Teams Message Extractor - Setup"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo "Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
REQUIRED_VERSION="3.10"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Error: Python 3.10 or higher is required. Found: $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python version OK: $PYTHON_VERSION${NC}"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
if [ -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment already exists. Skipping creation.${NC}"
else
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo -e "${GREEN}✓ pip upgraded${NC}"
echo ""

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Create necessary directories
echo "Creating directories..."
mkdir -p output logs data config
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Copy config example if config doesn't exist
if [ ! -f "config/config.yaml" ]; then
    echo "Creating configuration file..."
    cp config/config.yaml.example config/config.yaml
    echo -e "${YELLOW}⚠ Please edit config/config.yaml with your credentials${NC}"
else
    echo -e "${YELLOW}Configuration file already exists. Skipping.${NC}"
fi
echo ""

# Copy jobs example if doesn't exist
if [ ! -f "config/jobs.yaml" ]; then
    echo "Creating jobs configuration..."
    cp config/jobs.yaml.example config/jobs.yaml
    echo -e "${GREEN}✓ Jobs configuration created${NC}"
fi
echo ""

# Create .env.example
cat > .env.example << 'EOF'
# Microsoft Teams Configuration
TEAMS_TENANT_ID=your-tenant-id
TEAMS_CLIENT_ID=your-client-id
TEAMS_CLIENT_SECRET=your-client-secret
TEAMS_USE_DELEGATED_AUTH=false

# Jira Configuration (optional)
JIRA_ENABLED=false
JIRA_URL=https://yourcompany.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_DEFAULT_PROJECT=PROJ

# Confluence Configuration (optional)
CONFLUENCE_ENABLED=false
CONFLUENCE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_DEFAULT_SPACE=TEAM

# Email Configuration (optional)
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_ADDRESS=your-email@gmail.com

# Output Settings
OUTPUT_DIR=output
LOG_LEVEL=INFO
LOG_FILE=logs/teams-extractor.log
EOF

echo -e "${GREEN}✓ Created .env.example${NC}"
echo ""

# Setup complete
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your credentials:"
echo -e "   ${YELLOW}edit config/config.yaml${NC}"
echo ""
echo "2. Test your connection:"
echo -e "   ${GREEN}python -m src.cli.main test-connection${NC}"
echo ""
echo "3. Extract some messages:"
echo -e "   ${GREEN}python -m src.cli.main extract --last-hours 24 --format json${NC}"
echo ""
echo "Documentation:"
echo "  - Setup: docs/SETUP.md"
echo "  - Usage: docs/USAGE.md"
echo "  - Troubleshooting: docs/TROUBLESHOOTING.md"
echo ""
echo "For detailed setup instructions, see:"
echo -e "  ${GREEN}docs/SETUP.md${NC}"
echo ""
