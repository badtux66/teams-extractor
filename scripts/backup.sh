#!/bin/bash
# Backup script for Teams Message Extractor

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="teams-extractor-backup-$TIMESTAMP"

echo "========================================="
echo "Teams Message Extractor - Backup"
echo "========================================="
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup: $BACKUP_NAME"
echo ""

# Create backup archive
echo "📁 Backing up files..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='*.log' \
    --exclude='.git' \
    data/ \
    logs/ \
    .env

echo "✅ Backup created: $BACKUP_DIR/$BACKUP_NAME.tar.gz"

# Display backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)
echo "📊 Backup size: $BACKUP_SIZE"
echo ""

# Cleanup old backups (keep last 7 days)
echo "🧹 Cleaning up old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/teams-extractor-backup-*.tar.gz | tail -n +8 | xargs -r rm
echo "✅ Cleanup complete"
echo ""

# List all backups
echo "📋 Available backups:"
ls -lh "$BACKUP_DIR"/teams-extractor-backup-*.tar.gz 2>/dev/null || echo "No backups found"
echo ""

echo "========================================="
echo "✅ Backup Complete"
echo "========================================="
