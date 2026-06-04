#!/bin/sh
set -e

# Apply migrations forward-only (advisory-locked by Prisma to avoid races across
# replicas — Phase 5 §4). Then start the API.
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting ClubScan API..."
exec node dist/main.js
