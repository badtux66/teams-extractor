#!/bin/bash
# Teams Message Extractor - Channel Name Cleanup Script Runner
# This script runs the SQL cleanup on the PostgreSQL database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/cleanup-channel-names.sql"

echo "=================================================="
echo "Teams Message Extractor - Channel Name Cleanup"
echo "=================================================="
echo ""
echo "This script will fix channel_name values that contain"
echo "message content instead of actual channel names."
echo ""
echo "Before running, make sure:"
echo "1. The backend is running (docker-compose up -d)"
echo "2. PostgreSQL is accessible"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Running cleanup SQL script..."
echo ""

# Run the SQL script using docker exec
docker exec teams-extractor-postgres psql \
  -U teams_admin \
  -d teams_extractor \
  -f /dev/stdin < "$SQL_FILE"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Reload the Chrome extension (chrome://extensions)"
echo "2. Navigate to Teams and the extension will start extracting with correct channel names"
echo ""
