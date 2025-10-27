#!/bin/bash

#############################################
# Teams Extractor - n8n Cleanup Script
#
# This script removes all n8n-related components
# from the project after migration to Chrome
# extension + Node.js backend architecture.
#
# Usage: ./scripts/cleanup-n8n.sh
#############################################

set -e

echo "========================================"
echo "Teams Extractor - n8n Cleanup Script"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Confirmation
echo -e "${YELLOW}WARNING: This will permanently remove all n8n components!${NC}"
echo "The following will be removed:"
echo "  - n8n workflow files"
echo "  - Python processor (replaced by Node.js backend)"
echo "  - SQLite database (replaced by PostgreSQL)"
echo "  - Old Docker configurations"
echo "  - Legacy documentation"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup..."
echo ""

# Track what was removed
REMOVED_COUNT=0

# Function to remove file or directory
remove_item() {
    local item=$1
    local description=$2

    if [ -e "$item" ]; then
        echo -e "${GREEN}✓${NC} Removing: $description"
        rm -rf "$item"
        ((REMOVED_COUNT++))
    else
        echo -e "${YELLOW}→${NC} Not found (already removed): $description"
    fi
}

# Remove n8n workflow files
echo "--- Removing n8n Workflows ---"
remove_item "n8n-workflows" "n8n workflow directory"
remove_item "workflows" "Alternative workflows directory"
remove_item "n8n" "n8n configuration directory"
echo ""

# Remove Python processor
echo "--- Removing Python Processor ---"
remove_item "processor/server.py" "Python FastAPI server"
remove_item "processor/config.py" "Python configuration"
remove_item "processor/requirements.txt" "Python requirements (old)"
remove_item "processor/__pycache__" "Python cache files"
echo ""

# Remove SQLite database
echo "--- Removing SQLite Database ---"
remove_item "processor/teams.db" "SQLite database file"
remove_item "teams.db" "SQLite database file (alternative location)"
remove_item "*.db" "Any other .db files"
echo ""

# Remove old Docker configurations
echo "--- Removing Old Docker Configurations ---"
remove_item "Dockerfile.n8n" "n8n Dockerfile"
remove_item "docker-compose.n8n.yml" "n8n Docker Compose"

# Check if old Dockerfile.backend exists (Python version)
if [ -f "Dockerfile.backend" ]; then
    # Check if it's the Python version
    if grep -q "python" "Dockerfile.backend"; then
        remove_item "Dockerfile.backend" "Old Python backend Dockerfile"
    fi
fi

# Check if old Dockerfile.processor exists
if [ -f "Dockerfile.processor" ]; then
    if grep -q "python" "Dockerfile.processor"; then
        remove_item "Dockerfile.processor" "Old Python processor Dockerfile"
    fi
fi

echo ""

# Remove old documentation
echo "--- Removing Legacy Documentation ---"
remove_item "docs/N8N_SETUP.md" "n8n setup documentation"
remove_item "docs/PYTHON_API.md" "Python API documentation"
remove_item "MIGRATION_FROM_N8N.md" "n8n migration guide (no longer needed)"
echo ""

# Remove old environment variables
echo "--- Cleaning Environment Configuration ---"
if [ -f ".env" ]; then
    # Backup current .env
    cp .env .env.backup
    echo -e "${GREEN}✓${NC} Backed up .env to .env.backup"

    # Remove n8n-specific variables
    if grep -q "N8N_" .env; then
        sed -i '/N8N_/d' .env
        echo -e "${GREEN}✓${NC} Removed N8N_ variables from .env"
        ((REMOVED_COUNT++))
    fi

    if grep -q "SQLITE" .env; then
        sed -i '/SQLITE/d' .env
        echo -e "${GREEN}✓${NC} Removed SQLITE variables from .env"
        ((REMOVED_COUNT++))
    fi
fi
echo ""

# Remove Python virtual environment if it exists
echo "--- Removing Python Virtual Environment ---"
remove_item "venv" "Python virtual environment"
remove_item ".venv" "Python virtual environment (alternative)"
remove_item "env" "Python virtual environment (alternative)"
echo ""

# Remove old scripts
echo "--- Removing Old Scripts ---"
remove_item "scripts/setup-n8n.sh" "n8n setup script"
remove_item "scripts/import-n8n-workflows.sh" "n8n workflow import script"
remove_item "scripts/python-setup.sh" "Python setup script"
echo ""

# Remove old logs
echo "--- Cleaning Old Logs ---"
remove_item "processor/logs" "Python processor logs"
remove_item "n8n-logs" "n8n logs directory"
echo ""

# Clean up package-lock if old dependencies exist
if [ -f "processor/package-lock.json" ]; then
    remove_item "processor/package-lock.json" "Old processor package-lock"
fi

# Remove old node_modules from processor if it exists
if [ -d "processor/node_modules" ]; then
    remove_item "processor/node_modules" "Old processor node_modules"
fi

echo ""
echo "========================================"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo "========================================"
echo ""
echo "Summary:"
echo "  - Removed/cleaned: $REMOVED_COUNT items"
echo ""
echo "The following components remain:"
echo "  ✓ backend/ - New Node.js/Express backend"
echo "  ✓ chrome-extension/ - Chrome extension for extraction"
echo "  ✓ web-gui/ - React frontend"
echo "  ✓ init-scripts/ - PostgreSQL initialization"
echo "  ✓ docker-compose.yml - Unified Docker configuration"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Build new stack: docker-compose build"
echo "  3. Start services: docker-compose up -d"
echo "  4. Check health: curl http://localhost:5000/api/health"
echo ""
echo -e "${YELLOW}Note: A backup of your .env file was created at .env.backup${NC}"
echo ""
