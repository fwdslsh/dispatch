#!/bin/bash
# Verify backup integrity
# Usage: ./scripts/verify-backup.sh <backup-file>

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    echo "Example: $0 backups/dispatch-backup-20250929-143000.db"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Verifying backup: $BACKUP_FILE"
echo ""

# Integrity check
echo "1. Running integrity check..."
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
    echo "   ✗ FAILED: Database corruption detected"
    echo "   $INTEGRITY"
    exit 1
fi
echo "   ✓ PASSED"

# Quick analysis check
echo "2. Running quick analysis..."
if ! sqlite3 "$BACKUP_FILE" "PRAGMA quick_check;" > /dev/null 2>&1; then
    echo "   ✗ FAILED: Quick check failed"
    exit 1
fi
echo "   ✓ PASSED"

# Foreign key check
echo "3. Checking foreign key constraints..."
FK_ERRORS=$(sqlite3 "$BACKUP_FILE" "PRAGMA foreign_key_check;" | wc -l)
if [ $FK_ERRORS -gt 0 ]; then
    echo "   ✗ FAILED: $FK_ERRORS foreign key violations found"
    sqlite3 "$BACKUP_FILE" "PRAGMA foreign_key_check;"
    exit 1
fi
echo "   ✓ PASSED"

# Count records
echo "4. Verifying table contents..."
SETTINGS_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM configuration_settings;" 2>/dev/null || echo "0")
CATEGORIES_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM settings_categories;" 2>/dev/null || echo "0")
echo "   Settings: $SETTINGS_COUNT"
echo "   Categories: $CATEGORIES_COUNT"

if [ "$SETTINGS_COUNT" -lt 1 ] || [ "$CATEGORIES_COUNT" -lt 1 ]; then
    echo "   ✗ WARNING: Tables appear empty or missing"
    exit 1
else
    echo "   ✓ PASSED"
fi

# File size check
echo "5. Checking file size..."
FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
FILE_SIZE_HR=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   Size: $FILE_SIZE_HR ($FILE_SIZE bytes)"

if [ $FILE_SIZE -lt 1000 ]; then
    echo "   ✗ WARNING: File size suspiciously small"
    exit 1
else
    echo "   ✓ PASSED"
fi

echo ""
echo "✓ Backup verification complete - all checks passed!"
exit 0