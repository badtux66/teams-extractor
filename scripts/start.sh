#!/bin/bash
# Startup script for Teams Message Extractor

set -e

echo "========================================="
echo "Teams Message Extractor - Startup"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
        echo "⚠️  Please edit .env and add your API keys!"
        echo ""
        read -p "Press Enter to continue or Ctrl+C to exit..."
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Determine environment
ENV=${1:-prod}

case $ENV in
    dev|development)
        echo "🚀 Starting in DEVELOPMENT mode..."
        COMPOSE_FILE="docker-compose.dev.yml"
        ;;
    prod|production)
        echo "🚀 Starting in PRODUCTION mode..."
        COMPOSE_FILE="docker-compose.prod.yml"
        ;;
    *)
        echo "🚀 Starting in DEFAULT mode..."
        COMPOSE_FILE="docker-compose.yml"
        ;;
esac

echo "Using configuration: $COMPOSE_FILE"
echo ""

# Create directories
echo "📁 Creating directories..."
mkdir -p data logs
chmod 755 data logs
echo "✅ Directories created"
echo ""

# Pull/build images
echo "🐳 Building Docker images..."
docker-compose -f $COMPOSE_FILE build --no-cache
echo "✅ Images built"
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose -f $COMPOSE_FILE up -d
echo "✅ Services started"
echo ""

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Health check
echo "🔍 Running health checks..."
bash scripts/health-check-all.sh

echo ""
echo "========================================="
echo "✅ Startup Complete!"
echo "========================================="
echo ""
echo "🌐 Access the application:"
echo "  - Web GUI: http://localhost:3000"
echo "  - Backend API: http://localhost:8090"
echo "  - API Documentation: http://localhost:8090/docs"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "  - Stop services: docker-compose -f $COMPOSE_FILE down"
echo "  - Restart: docker-compose -f $COMPOSE_FILE restart"
echo ""
