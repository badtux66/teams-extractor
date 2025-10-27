#!/bin/bash

#############################################
# Claude Desktop MCP Server Setup Script
#
# This script configures Claude Desktop to use
# the Teams Extractor MCP server.
#
# Usage: ./setup-claude.sh
#############################################

set -e

echo "=========================================="
echo "Claude Desktop MCP Server Setup"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    MINGW*|MSYS*|CYGWIN*)    MACHINE=Windows;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo -e "${BLUE}Detected OS: ${MACHINE}${NC}"
echo ""

# Determine Claude Desktop config path
if [ "$MACHINE" = "Mac" ]; then
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [ "$MACHINE" = "Linux" ]; then
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
elif [ "$MACHINE" = "Windows" ]; then
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
else
    echo -e "${RED}Error: Unsupported operating system${NC}"
    exit 1
fi

CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

echo -e "${BLUE}Claude Desktop config location:${NC}"
echo "  $CONFIG_FILE"
echo ""

# Check if Claude Desktop is installed
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo -e "${YELLOW}Warning: Claude Desktop config directory not found${NC}"
    echo "Creating directory: $CLAUDE_CONFIG_DIR"
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Get current directory (where the MCP server is)
MCP_SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "${BLUE}MCP Server location:${NC}"
echo "  $MCP_SERVER_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"

# Check if npm dependencies are installed
if [ ! -d "$MCP_SERVER_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing MCP server dependencies...${NC}"
    cd "$MCP_SERVER_DIR"
    npm install
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

echo ""

# Prompt for database URL
echo -e "${YELLOW}Database Configuration${NC}"
echo "Enter your PostgreSQL connection URL:"
echo "Example: postgresql://teams_admin:password@localhost:5432/teams_extractor"
read -p "Database URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: Database URL is required${NC}"
    exit 1
fi

echo ""

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
export MCP_DATABASE_URL="$DATABASE_URL"
if node -e "
import pg from 'pg';
const pool = new pg.Pool({ connectionString: '$DATABASE_URL' });
pool.query('SELECT 1')
  .then(() => { console.log('✓ Connection successful'); process.exit(0); })
  .catch((err) => { console.error('✗ Connection failed:', err.message); process.exit(1); });
" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Database connection successful"
else
    echo -e "${RED}✗${NC} Database connection failed"
    echo "Please check your database URL and ensure PostgreSQL is running"
    exit 1
fi

echo ""

# Create or update Claude Desktop config
echo -e "${BLUE}Configuring Claude Desktop...${NC}"

# Backup existing config if it exists
if [ -f "$CONFIG_FILE" ]; then
    BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Backing up existing config to: $BACKUP_FILE"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
fi

# Create MCP server configuration
MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "teams-extractor": {
      "command": "node",
      "args": [
        "$MCP_SERVER_DIR/index.js"
      ],
      "env": {
        "MCP_DATABASE_URL": "$DATABASE_URL"
      }
    }
  }
}
EOF
)

# Write configuration
echo "$MCP_CONFIG" > "$CONFIG_FILE"
echo -e "${GREEN}✓${NC} Configuration written to: $CONFIG_FILE"

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Restart Claude Desktop"
echo "  2. Look for the hammer icon (🔨) in Claude Desktop"
echo "  3. You should see 'teams-extractor' with 6 available tools"
echo ""
echo "Available MCP Tools:"
echo "  • list_messages - List Teams messages with filtering"
echo "  • search_messages - Full-text search in messages"
echo "  • get_statistics - Get message statistics"
echo "  • get_message - Get specific message details"
echo "  • get_channel_summary - Summarize channel activity"
echo "  • get_sender_activity - Analyze sender activity"
echo ""
echo "Example prompts to try in Claude:"
echo "  - 'Show me the latest 10 Teams messages'"
echo "  - 'Search for messages about project deadline'"
echo "  - 'What are the statistics for the last 7 days?'"
echo "  - 'Summarize activity in the Engineering channel'"
echo ""
echo -e "${BLUE}Configuration file:${NC} $CONFIG_FILE"
echo -e "${BLUE}MCP Server:${NC} $MCP_SERVER_DIR/index.js"
echo ""
