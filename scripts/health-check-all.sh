#!/bin/bash
# Complete system health check

set -e

echo "========================================="
echo "Teams Message Extractor - Health Check"
echo "========================================="
echo ""

# Check Docker
echo "🐳 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker is installed: $(docker --version)"
echo ""

# Check Docker Compose
echo "🐳 Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi
echo "✅ Docker Compose is installed: $(docker-compose --version)"
echo ""

# Check containers
echo "📦 Checking containers..."
BACKEND_STATUS=$(docker-compose ps -q backend 2>/dev/null)
FRONTEND_STATUS=$(docker-compose ps -q frontend 2>/dev/null)

if [ -z "$BACKEND_STATUS" ]; then
    echo "❌ Backend container is not running"
else
    echo "✅ Backend container is running"
fi

if [ -z "$FRONTEND_STATUS" ]; then
    echo "❌ Frontend container is not running"
else
    echo "✅ Frontend container is running"
fi
echo ""

# Check backend health
echo "🔧 Checking backend health..."
bash scripts/health-check-backend.sh
echo ""

# Check frontend health
echo "🌐 Checking frontend health..."
bash scripts/health-check-frontend.sh
echo ""

# Check environment
echo "🔐 Checking environment variables..."
if [ -f .env ]; then
    echo "✅ .env file exists"

    if grep -q "OPENAI_API_KEY=sk-" .env; then
        echo "✅ OPENAI_API_KEY is configured"
    else
        echo "⚠️  OPENAI_API_KEY may not be configured"
    fi

    if grep -q "N8N_WEBHOOK_URL=" .env; then
        echo "✅ N8N_WEBHOOK_URL is configured"
    else
        echo "⚠️  N8N_WEBHOOK_URL may not be configured"
    fi
else
    echo "⚠️  .env file not found"
fi
echo ""

# Check database
echo "🗄️  Checking database..."
if [ -f data/teams_messages.db ]; then
    DB_SIZE=$(du -h data/teams_messages.db | cut -f1)
    echo "✅ Database exists (size: $DB_SIZE)"

    # Count messages
    MSG_COUNT=$(sqlite3 data/teams_messages.db "SELECT COUNT(*) FROM messages;" 2>/dev/null || echo "0")
    echo "📊 Total messages: $MSG_COUNT"
else
    echo "⚠️  Database not found (will be created on first run)"
fi
echo ""

# Check logs
echo "📝 Checking logs..."
if [ -d logs ]; then
    echo "✅ Logs directory exists"

    if [ -f logs/processor.log ]; then
        LOG_SIZE=$(du -h logs/processor.log | cut -f1)
        echo "📄 Processor log size: $LOG_SIZE"
    fi
else
    echo "⚠️  Logs directory not found"
fi
echo ""

# Final summary
echo "========================================="
echo "Health Check Complete"
echo "========================================="
echo ""
echo "🌐 Access Points:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:8090"
echo "  - API Docs: http://localhost:8090/docs"
echo ""
