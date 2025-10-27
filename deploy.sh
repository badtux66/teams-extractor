#!/bin/bash

################################################
# Teams Extractor - One-Command Deployment Script
#
# This script deploys the entire Teams Extractor
# stack using Docker Compose.
#
# Usage: ./deploy.sh [options]
################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MODE="production"
WITH_NGINX=false
WITH_MONITORING=false
FRESH_INSTALL=false

# Print banner
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════╗
║   Teams Message Extractor Deployer   ║
║        Docker Compose Stack           ║
╚═══════════════════════════════════════╝
EOF
echo -e "${NC}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            MODE="development"
            shift
            ;;
        --with-nginx)
            WITH_NGINX=true
            shift
            ;;
        --with-monitoring)
            WITH_MONITORING=true
            shift
            ;;
        --fresh)
            FRESH_INSTALL=true
            shift
            ;;
        --help)
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --dev               Deploy in development mode"
            echo "  --with-nginx        Include Nginx reverse proxy"
            echo "  --with-monitoring   Include Grafana and Prometheus"
            echo "  --fresh             Fresh install (removes existing volumes)"
            echo "  --help              Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}Deployment Configuration:${NC}"
echo "  Mode: $MODE"
echo "  Nginx: $WITH_NGINX"
echo "  Monitoring: $WITH_MONITORING"
echo "  Fresh Install: $FRESH_INSTALL"
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker from https://docker.com"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker installed"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker Compose installed"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker daemon running"

echo ""

# Check/create .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from template...${NC}"

    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env from .env.example"
        echo -e "${YELLOW}⚠ Please edit .env with your configuration before continuing${NC}"
        echo "Press Enter when ready..."
        read
    else
        echo -e "${RED}✗ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi

echo ""

# Fresh install warning
if [ "$FRESH_INSTALL" = true ]; then
    echo -e "${YELLOW}⚠ WARNING: Fresh install will remove all existing data!${NC}"
    echo -n "Are you sure you want to continue? (yes/no): "
    read confirm

    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi

    echo ""
    echo -e "${BLUE}Stopping and removing existing containers...${NC}"
    docker-compose down -v
    echo -e "${GREEN}✓${NC} Cleanup complete"
    echo ""
fi

# Build profiles
COMPOSE_PROFILES=""
if [ "$WITH_NGINX" = true ]; then
    COMPOSE_PROFILES="$COMPOSE_PROFILES,with-nginx"
fi
if [ "$WITH_MONITORING" = true ]; then
    COMPOSE_PROFILES="$COMPOSE_PROFILES,monitoring"
fi

# Remove leading comma
COMPOSE_PROFILES=${COMPOSE_PROFILES#,}

# Export environment
export NODE_ENV=$MODE
export COMPOSE_PROFILES

# Build images
echo -e "${BLUE}Building Docker images...${NC}"
if [ -n "$COMPOSE_PROFILES" ]; then
    docker-compose --profile "$COMPOSE_PROFILES" build
else
    docker-compose build
fi
echo -e "${GREEN}✓${NC} Images built successfully"
echo ""

# Start services
echo -e "${BLUE}Starting services...${NC}"
if [ -n "$COMPOSE_PROFILES" ]; then
    docker-compose --profile "$COMPOSE_PROFILES" up -d
else
    docker-compose up -d
fi
echo -e "${GREEN}✓${NC} Services started"
echo ""

# Wait for services to be healthy
echo -e "${BLUE}Waiting for services to be healthy...${NC}"
echo "This may take up to 60 seconds..."

MAX_WAIT=60
WAIT_TIME=0

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if docker-compose ps | grep -q "unhealthy"; then
        echo -n "."
        sleep 2
        WAIT_TIME=$((WAIT_TIME + 2))
    else
        break
    fi
done

echo ""

# Check service status
echo ""
echo -e "${BLUE}Service Status:${NC}"
docker-compose ps

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""

# Get service URLs
BACKEND_PORT=$(grep "^PORT=" .env | cut -d '=' -f2)
BACKEND_PORT=${BACKEND_PORT:-5000}

FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d '=' -f2)
FRONTEND_PORT=${FRONTEND_PORT:-3000}

echo -e "${BLUE}Access your services:${NC}"
echo ""
echo "  📊 Dashboard:      http://localhost:$FRONTEND_PORT"
echo "  🔌 Backend API:    http://localhost:$BACKEND_PORT"
echo "  🗄️  PostgreSQL:     localhost:5432"
echo "  💾 Redis:          localhost:6379"

if [ "$WITH_MONITORING" = true ]; then
    GRAFANA_PORT=$(grep "^GRAFANA_PORT=" .env | cut -d '=' -f2)
    GRAFANA_PORT=${GRAFANA_PORT:-3001}
    echo "  📈 Grafana:        http://localhost:$GRAFANA_PORT"
    echo "  📉 Prometheus:     http://localhost:9090"
fi

echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo ""
echo "  View logs:         docker-compose logs -f"
echo "  Stop services:     docker-compose down"
echo "  Restart service:   docker-compose restart <service>"
echo "  Check health:      curl http://localhost:$BACKEND_PORT/api/health"
echo ""

# Show logs for a few seconds
echo -e "${BLUE}Showing recent logs (press Ctrl+C to exit):${NC}"
echo ""
sleep 2
docker-compose logs --tail=50 -f
