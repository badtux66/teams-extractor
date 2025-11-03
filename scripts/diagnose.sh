#!/bin/bash

#############################################
# Teams Message Extractor Diagnostic Script
#
# This script performs a comprehensive health
# check of all components.
#
# Usage: ./scripts/diagnose.sh
#############################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Icons
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
WARNING="${YELLOW}⚠${NC}"
INFO="${BLUE}ℹ${NC}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}     Teams Message Extractor - System Diagnostics     ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${INFO} Running comprehensive system check..."
echo -e "${INFO} Timestamp: $(date)"
echo ""

# Track overall health
HEALTH_SCORE=0
MAX_SCORE=0

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to increment score
check_pass() {
    ((HEALTH_SCORE++))
    ((MAX_SCORE++))
}

check_fail() {
    ((MAX_SCORE++))
}

#############################################
# 1. Check Docker
#############################################
echo -e "${MAGENTA}[1/6] Docker Status${NC}"
echo -e "─────────────────────────"

if command_exists docker; then
    DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1)
    echo -e "$CHECK Docker installed (v$DOCKER_VERSION)"
    check_pass

    if docker info >/dev/null 2>&1; then
        echo -e "$CHECK Docker daemon is running"
        check_pass
    else
        echo -e "$CROSS Docker daemon is not running"
        echo -e "  ${INFO} Start Docker Desktop or run: sudo systemctl start docker"
        check_fail
    fi
else
    echo -e "$CROSS Docker not installed"
    echo -e "  ${INFO} Install from: https://www.docker.com/products/docker-desktop"
    check_fail
    check_fail
fi

echo ""

#############################################
# 2. Check Docker Containers
#############################################
echo -e "${MAGENTA}[2/6] Container Status${NC}"
echo -e "─────────────────────────"

if command_exists docker; then
    # Check each required container
    CONTAINERS=("teams-extractor-db" "teams-extractor-redis" "teams-extractor-backend" "teams-extractor-frontend")
    RUNNING_COUNT=0

    for CONTAINER in "${CONTAINERS[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
            STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null)
            UPTIME=$(docker ps --filter "name=$CONTAINER" --format "{{.Status}}" 2>/dev/null)
            echo -e "$CHECK $CONTAINER: ${GREEN}running${NC} ($UPTIME)"
            ((RUNNING_COUNT++))
            check_pass
        else
            if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
                echo -e "$WARNING $CONTAINER: ${YELLOW}stopped${NC}"
            else
                echo -e "$CROSS $CONTAINER: ${RED}not found${NC}"
            fi
            check_fail
        fi
    done

    if [ $RUNNING_COUNT -eq 0 ]; then
        echo -e "  ${INFO} Start containers with: ${CYAN}docker-compose up -d${NC}"
    elif [ $RUNNING_COUNT -lt 4 ]; then
        echo -e "  ${INFO} Some containers are down. Restart with: ${CYAN}docker-compose restart${NC}"
    fi
else
    echo -e "$CROSS Cannot check containers (Docker not available)"
    check_fail
fi

echo ""

#############################################
# 3. Check Network Connectivity
#############################################
echo -e "${MAGENTA}[3/6] Network Services${NC}"
echo -e "─────────────────────────"

# Check backend API
if curl -s -f -X GET http://localhost:5000/api/health >/dev/null 2>&1; then
    echo -e "$CHECK Backend API: ${GREEN}responding${NC} (http://localhost:5000)"
    check_pass

    # Get detailed health
    HEALTH=$(curl -s http://localhost:5000/api/health 2>/dev/null)
    if [ ! -z "$HEALTH" ]; then
        DB_STATUS=$(echo "$HEALTH" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
        REDIS_STATUS=$(echo "$HEALTH" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4)

        if [ "$DB_STATUS" = "connected" ]; then
            echo -e "  $CHECK Database: connected"
        else
            echo -e "  $CROSS Database: disconnected"
        fi

        if [ "$REDIS_STATUS" = "connected" ]; then
            echo -e "  $CHECK Redis: connected"
        else
            echo -e "  $CROSS Redis: disconnected"
        fi
    fi
else
    echo -e "$CROSS Backend API: ${RED}not responding${NC}"
    echo -e "  ${INFO} Check logs: ${CYAN}docker-compose logs backend${NC}"
    check_fail
fi

# Check frontend
if curl -s -f http://localhost:3000 >/dev/null 2>&1; then
    echo -e "$CHECK Frontend: ${GREEN}accessible${NC} (http://localhost:3000)"
    check_pass
else
    echo -e "$CROSS Frontend: ${RED}not accessible${NC}"
    check_fail
fi

echo ""

#############################################
# 4. Check Database
#############################################
echo -e "${MAGENTA}[4/6] Database Status${NC}"
echo -e "─────────────────────────"

if docker ps --format '{{.Names}}' | grep -q "^teams-extractor-db$"; then
    # Check if we can connect to database
    if docker exec teams-extractor-db psql -U teams_admin -d teams_extractor -c "SELECT 1" >/dev/null 2>&1; then
        echo -e "$CHECK PostgreSQL: ${GREEN}accessible${NC}"
        check_pass

        # Get message count
        MSG_COUNT=$(docker exec teams-extractor-db psql -U teams_admin -d teams_extractor -t -c "SELECT COUNT(*) FROM teams.messages" 2>/dev/null | xargs)
        if [ ! -z "$MSG_COUNT" ]; then
            echo -e "  ${INFO} Messages in database: ${CYAN}${MSG_COUNT}${NC}"

            if [ "$MSG_COUNT" -eq "0" ]; then
                echo -e "  ${WARNING} Database is empty. Extract messages using Chrome extension"
            fi
        fi

        # Check recent activity
        RECENT=$(docker exec teams-extractor-db psql -U teams_admin -d teams_extractor -t -c "SELECT COUNT(*) FROM teams.messages WHERE created_at > NOW() - INTERVAL '1 hour'" 2>/dev/null | xargs)
        if [ ! -z "$RECENT" ] && [ "$RECENT" -gt "0" ]; then
            echo -e "  ${INFO} Messages in last hour: ${CYAN}${RECENT}${NC}"
        fi
    else
        echo -e "$CROSS PostgreSQL: ${RED}connection failed${NC}"
        echo -e "  ${INFO} Check credentials in docker-compose.yml"
        check_fail
    fi
else
    echo -e "$CROSS PostgreSQL container not running"
    check_fail
fi

echo ""

#############################################
# 5. Check Chrome Extension
#############################################
echo -e "${MAGENTA}[5/6] Chrome Extension${NC}"
echo -e "─────────────────────────"

# Check if manifest exists
if [ -f "chrome-extension/manifest.json" ]; then
    VERSION=$(grep '"version"' chrome-extension/manifest.json | cut -d'"' -f4)
    echo -e "$CHECK Extension files found (v$VERSION)"
    check_pass

    # Check for recent changes
    LAST_MODIFIED=$(find chrome-extension -type f -name "*.js" -exec stat -f "%m" {} \; | sort -n | tail -1)
    CURRENT_TIME=$(date +%s)
    DAYS_OLD=$(( ($CURRENT_TIME - $LAST_MODIFIED) / 86400 ))

    if [ $DAYS_OLD -gt 30 ]; then
        echo -e "  ${WARNING} Extension code is $DAYS_OLD days old"
        echo -e "  ${INFO} Consider updating if Teams UI has changed"
    else
        echo -e "  ${INFO} Last updated: $DAYS_OLD days ago"
    fi
else
    echo -e "$CROSS Extension files not found"
    check_fail
fi

echo -e "${INFO} Chrome extension status can only be fully checked from the browser"
echo -e "  1. Open Chrome and navigate to Teams"
echo -e "  2. Click extension icon to check status"
echo -e "  3. Open DevTools Console for detailed logs"

echo ""

#############################################
# 6. Check MCP Server
#############################################
echo -e "${MAGENTA}[6/6] MCP Server (Claude Desktop)${NC}"
echo -e "─────────────────────────"

if [ -f "mcp-server/package.json" ]; then
    echo -e "$CHECK MCP server files found"
    check_pass

    # Check if Node.js is installed
    if command_exists node; then
        NODE_VERSION=$(node -v)
        echo -e "$CHECK Node.js installed ($NODE_VERSION)"
        check_pass

        # Check if dependencies are installed
        if [ -d "mcp-server/node_modules" ]; then
            echo -e "$CHECK MCP dependencies installed"
            check_pass
        else
            echo -e "$WARNING MCP dependencies not installed"
            echo -e "  ${INFO} Run: ${CYAN}cd mcp-server && npm install${NC}"
            check_fail
        fi

        # Test database connection if .env exists
        if [ -f "mcp-server/.env" ]; then
            echo -e "  ${INFO} Testing MCP database connection..."
            cd mcp-server
            if node test-connection.js >/dev/null 2>&1; then
                echo -e "  $CHECK MCP can connect to database"
                check_pass
            else
                echo -e "  $CROSS MCP cannot connect to database"
                echo -e "  ${INFO} Check MCP_DATABASE_URL in mcp-server/.env"
                check_fail
            fi
            cd ..
        else
            echo -e "$WARNING MCP not configured"
            echo -e "  ${INFO} Run: ${CYAN}cd mcp-server && ./setup-claude.sh${NC}"
            check_fail
        fi
    else
        echo -e "$CROSS Node.js not installed (required for MCP)"
        check_fail
        check_fail
    fi
else
    echo -e "$CROSS MCP server files not found"
    check_fail
fi

echo ""

#############################################
# Summary
#############################################
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}                    Diagnostic Summary                 ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Calculate health percentage
if [ $MAX_SCORE -gt 0 ]; then
    HEALTH_PERCENT=$(( (HEALTH_SCORE * 100) / MAX_SCORE ))
else
    HEALTH_PERCENT=0
fi

# Display health bar
echo -n "System Health: ["
for i in {1..20}; do
    if [ $(( i * 5 )) -le $HEALTH_PERCENT ]; then
        echo -n "█"
    else
        echo -n "░"
    fi
done
echo "] ${HEALTH_PERCENT}% (${HEALTH_SCORE}/${MAX_SCORE} checks passed)"

echo ""

# Provide status summary
if [ $HEALTH_PERCENT -eq 100 ]; then
    echo -e "${GREEN}✨ All systems operational!${NC}"
elif [ $HEALTH_PERCENT -ge 75 ]; then
    echo -e "${GREEN}✓ System is mostly healthy${NC}"
    echo -e "${INFO} Review warnings above for optimal performance"
elif [ $HEALTH_PERCENT -ge 50 ]; then
    echo -e "${YELLOW}⚠ System has some issues${NC}"
    echo -e "${INFO} Follow the suggestions above to fix problems"
else
    echo -e "${RED}✗ System needs attention${NC}"
    echo -e "${INFO} Multiple components need to be fixed"
fi

echo ""
echo -e "${BLUE}Quick Actions:${NC}"

if [ $HEALTH_PERCENT -lt 100 ]; then
    echo -e "  • Start all services: ${CYAN}docker-compose up -d${NC}"
    echo -e "  • View logs: ${CYAN}docker-compose logs -f${NC}"
    echo -e "  • Restart everything: ${CYAN}docker-compose restart${NC}"
    echo -e "  • Full reset: ${CYAN}docker-compose down && docker-compose up -d${NC}"
else
    echo -e "  • View logs: ${CYAN}docker-compose logs -f${NC}"
    echo -e "  • Open dashboard: ${CYAN}http://localhost:3000${NC}"
fi

echo ""
echo -e "${INFO} For detailed troubleshooting, see: ${CYAN}TROUBLESHOOTING.md${NC}"
echo ""