#!/bin/bash
# Health check script for frontend service

set -e

# Configuration
HOST="${HOST:-localhost}"
PORT="${PORT:-3000}"
MAX_RETRIES=3
RETRY_DELAY=2

echo "Starting health check for frontend at ${HOST}:${PORT}"

for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES..."

    if curl -f -s "http://${HOST}:${PORT}/" > /dev/null; then
        echo "✅ Frontend is healthy!"
        exit 0
    else
        echo "❌ Frontend health check failed"

        if [ $i -lt $MAX_RETRIES ]; then
            echo "Retrying in ${RETRY_DELAY} seconds..."
            sleep $RETRY_DELAY
        fi
    fi
done

echo "❌ Frontend is unhealthy after $MAX_RETRIES attempts"
exit 1
