#!/bin/bash
# Database backup script with rotation
# Usage: ./scripts/backup-database.sh

DB_FILE="dispatch.db"
BACKUP_DIR="./backups"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dispatch-backup-$TIMESTAMP.db"

echo "Creating backup: $BACKUP_FILE"

# Perform backup using SQLite online backup
if ! sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"; then
    echo "✗ Backup failed!"
    exit 1
fi

# Verify backup integrity
echo "Verifying backup integrity..."
INTEGRITY_CHECK=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")

if [ "$INTEGRITY_CHECK" = "ok" ]; then
    echo "✓ Backup completed successfully"
    echo "  File: $BACKUP_FILE"
    echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "✗ Backup integrity check failed!"
    echo "  $INTEGRITY_CHECK"
    exit 1
fi

# Remove old backups (older than RETENTION_DAYS)
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "dispatch-backup-*.db" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "  Deleted $DELETED_COUNT old backup(s)"

# List remaining backups
echo ""
echo "Available backups:"
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/dispatch-backup-*.db 2>/dev/null | wc -l)
if [ $BACKUP_COUNT -gt 0 ]; then
    ls -lh "$BACKUP_DIR"/dispatch-backup-*.db | tail -5
    if [ $BACKUP_COUNT -gt 5 ]; then
        echo "  ... and $((BACKUP_COUNT - 5)) more"
    fi
else
    echo "  No backups found"
fi

echo ""
echo "Backup complete!"
exit 0