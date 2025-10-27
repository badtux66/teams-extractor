#!/bin/bash
# Health check script for backend service

set -e

# Configuration
HOST="${HOST:-localhost}"
PORT="${PORT:-8090}"
MAX_RETRIES=3
RETRY_DELAY=2

echo "Starting health check for backend at ${HOST}:${PORT}"

for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES..."

    if curl -f -s "http://${HOST}:${PORT}/health" > /dev/null; then
        echo "✅ Backend is healthy!"

        # Parse and display health info
        HEALTH_INFO=$(curl -s "http://${HOST}:${PORT}/health")
        echo "Health info: $HEALTH_INFO"

        exit 0
    else
        echo "❌ Backend health check failed"

        if [ $i -lt $MAX_RETRIES ]; then
            echo "Retrying in ${RETRY_DELAY} seconds..."
            sleep $RETRY_DELAY
        fi
    fi
done

echo "❌ Backend is unhealthy after $MAX_RETRIES attempts"
exit 1
