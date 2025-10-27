#!/bin/bash
# Stop script for Teams Message Extractor

set -e

echo "========================================="
echo "Teams Message Extractor - Shutdown"
echo "========================================="
echo ""

# Determine which compose file to use
if [ -n "$1" ]; then
    COMPOSE_FILE="docker-compose.$1.yml"
else
    # Try to detect running containers
    if docker ps --format '{{.Names}}' | grep -q "prod"; then
        COMPOSE_FILE="docker-compose.prod.yml"
    elif docker ps --format '{{.Names}}' | grep -q "dev"; then
        COMPOSE_FILE="docker-compose.dev.yml"
    else
        COMPOSE_FILE="docker-compose.yml"
    fi
fi

echo "Using configuration: $COMPOSE_FILE"
echo ""

# Ask for confirmation
read -p "Are you sure you want to stop all services? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop services
echo "🛑 Stopping services..."
docker-compose -f $COMPOSE_FILE down

echo ""
echo "✅ All services stopped"
echo ""

# Ask about cleanup
read -p "Do you want to remove volumes (data will be lost)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    docker-compose -f $COMPOSE_FILE down -v
    echo "✅ Volumes removed"
fi

echo ""
echo "========================================="
echo "✅ Shutdown Complete"
echo "========================================="
