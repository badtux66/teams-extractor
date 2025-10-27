#!/bin/bash
# Restore script for Teams Message Extractor

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"

echo "========================================="
echo "Teams Message Extractor - Restore"
echo "========================================="
echo ""

# List available backups
echo "📋 Available backups:"
echo ""
ls -lht "$BACKUP_DIR"/teams-extractor-backup-*.tar.gz 2>/dev/null || {
    echo "❌ No backups found in $BACKUP_DIR"
    exit 1
}
echo ""

# Prompt for backup file
read -p "Enter backup filename (or press Enter for latest): " BACKUP_FILE

if [ -z "$BACKUP_FILE" ]; then
    # Use latest backup
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/teams-extractor-backup-*.tar.gz | head -1)
    echo "Using latest backup: $(basename $BACKUP_FILE)"
else
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

# Verify backup exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirm restore
echo ""
echo "⚠️  WARNING: This will overwrite existing data!"
read -p "Are you sure you want to restore from this backup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop services
echo ""
echo "🛑 Stopping services..."
bash scripts/stop.sh

# Restore backup
echo ""
echo "📦 Restoring from backup..."
tar -xzf "$BACKUP_FILE" -C .

echo "✅ Restore complete"
echo ""

# Restart services
read -p "Do you want to restart services now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash scripts/start.sh
fi

echo ""
echo "========================================="
echo "✅ Restore Complete"
echo "========================================="
