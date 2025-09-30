# Database Backup and Restoration Guide

**Target Audience**: Developers and system administrators
**Database**: SQLite (`dispatch.db`)
**Last Updated**: September 2025

## Overview

This guide provides instructions for backing up and restoring the Dispatch database, including settings, sessions, workspaces, and all application data. Since Dispatch uses SQLite, backup procedures are straightforward and can be performed without stopping the application.

## Important Notes

### When to Back Up

**Essential backup scenarios:**
- Before major database schema changes
- Before upgrading Dispatch version
- Before modifying settings programmatically
- After significant configuration changes
- As part of regular maintenance (recommended: daily/weekly)

### What Gets Backed Up

The `dispatch.db` file contains:
- All settings and configuration (settings_categories, configuration_settings)
- Session data and history (sessions, session_events)
- Workspace definitions (workspaces)
- Workspace layouts (workspace_layout)
- Onboarding state (onboarding_state)
- Retention policies (retention_policies)
- User preferences (user_preferences)

## Backup Methods

### Method 1: SQLite Online Backup (Recommended)

**Advantages**: Safe during operation, consistent backup, built-in consistency checks

**Procedure:**

```bash
# Basic backup
sqlite3 dispatch.db ".backup dispatch-backup.db"

# With timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 dispatch.db ".backup dispatch-backup-${TIMESTAMP}.db"

# Verify backup integrity
sqlite3 dispatch-backup.db "PRAGMA integrity_check;"
```

**Automation script** (`scripts/backup-database.sh`):

```bash
#!/bin/bash
# Database backup script with rotation

DB_FILE="dispatch.db"
BACKUP_DIR="./backups"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dispatch-backup-$TIMESTAMP.db"

echo "Creating backup: $BACKUP_FILE"

# Perform backup
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Verify backup integrity
echo "Verifying backup integrity..."
INTEGRITY_CHECK=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")

if [ "$INTEGRITY_CHECK" = "ok" ]; then
    echo "✓ Backup completed successfully"
    echo "  File: $BACKUP_FILE"
    echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "✗ Backup integrity check failed!"
    exit 1
fi

# Remove old backups (older than RETENTION_DAYS)
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "dispatch-backup-*.db" -type f -mtime +$RETENTION_DAYS -delete

# List remaining backups
echo ""
echo "Available backups:"
ls -lh "$BACKUP_DIR"/dispatch-backup-*.db 2>/dev/null || echo "No backups found"

echo ""
echo "Backup complete!"
```

Make the script executable:
```bash
chmod +x scripts/backup-database.sh
```

Run the backup:
```bash
./scripts/backup-database.sh
```

### Method 2: File System Copy

**Advantages**: Simple, no tools required

**Important**: Only safe when application is stopped or during low activity periods

**Procedure:**

```bash
# Stop the application first (recommended)
docker-compose down  # or npm stop

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp dispatch.db "backups/dispatch-backup-${TIMESTAMP}.db"

# Optional: Compress backup
gzip "backups/dispatch-backup-${TIMESTAMP}.db"

# Restart application
docker-compose up -d  # or npm start
```

### Method 3: SQL Dump (Text Format)

**Advantages**: Human-readable, version control friendly, portable

**Procedure:**

```bash
# Export entire database to SQL
sqlite3 dispatch.db .dump > dispatch-dump.sql

# With timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 dispatch.db .dump > "backups/dispatch-dump-${TIMESTAMP}.sql"

# Optional: Compress dump
gzip "backups/dispatch-dump-${TIMESTAMP}.sql"
```

**Export specific tables only:**

```bash
# Export only settings tables
sqlite3 dispatch.db << EOF > settings-backup.sql
.dump settings_categories
.dump configuration_settings
EOF

# Export only workspaces
sqlite3 dispatch.db << EOF > workspaces-backup.sql
.dump workspaces
.dump workspace_layout
EOF
```

## Restoration Methods

### Restore from SQLite Backup

```bash
# Stop application first
docker-compose down

# Backup current database (just in case)
cp dispatch.db dispatch-before-restore.db

# Restore from backup
cp dispatch-backup-20250929-143000.db dispatch.db

# Verify restored database
sqlite3 dispatch.db "PRAGMA integrity_check;"
sqlite3 dispatch.db "SELECT COUNT(*) as settings FROM configuration_settings;"

# Restart application
docker-compose up -d
```

### Restore from SQL Dump

```bash
# Stop application
docker-compose down

# Backup current database
cp dispatch.db dispatch-before-restore.db

# Remove current database
rm dispatch.db

# Restore from SQL dump
sqlite3 dispatch.db < dispatch-dump-20250929-143000.sql

# Verify restoration
sqlite3 dispatch.db "PRAGMA integrity_check;"

# Restart application
docker-compose up -d
```

### Selective Restore (Specific Tables)

```bash
# Start sqlite3 interactive mode
sqlite3 dispatch.db

# Within sqlite3:
-- Backup current data
.dump configuration_settings > /tmp/current-settings.sql

-- Drop table
DROP TABLE configuration_settings;

-- Restore from backup
.read settings-backup.sql

-- Verify
SELECT COUNT(*) FROM configuration_settings;

-- Exit
.quit
```

## Automated Backup Strategies

### Cron Job (Linux/Mac)

Add to crontab (`crontab -e`):

```cron
# Daily backup at 2 AM
0 2 * * * /path/to/dispatch/scripts/backup-database.sh >> /path/to/dispatch/logs/backup.log 2>&1

# Hourly backup during business hours (9 AM - 5 PM, Monday-Friday)
0 9-17 * * 1-5 /path/to/dispatch/scripts/backup-database.sh >> /path/to/dispatch/logs/backup.log 2>&1
```

### Docker Volume Backup

If using Docker with volume mounts:

```bash
# Backup Docker volume
docker run --rm \
  -v dispatch_data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/dispatch-volume-$(date +%Y%m%d).tar.gz -C /source .

# Restore Docker volume
docker run --rm \
  -v dispatch_data:/target \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/dispatch-volume-20250929.tar.gz -C /target
```

### Git-Based Backup (SQL Dumps)

For version-controlled backups:

```bash
# Initialize git repo in backups directory
cd backups
git init

# Create SQL dump
sqlite3 ../dispatch.db .dump > dispatch-latest.sql

# Commit changes
git add dispatch-latest.sql
git commit -m "Database backup $(date +%Y-%m-%d)"

# Optional: Push to remote
git push origin main
```

## Backup Verification

Always verify backups after creation:

```bash
#!/bin/bash
# Verify backup integrity

BACKUP_FILE="$1"

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
    exit 1
fi
echo "   ✓ PASSED"

# Quick analysis check
echo "2. Running quick analysis..."
sqlite3 "$BACKUP_FILE" "PRAGMA quick_check;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "   ✗ FAILED: Quick check failed"
    exit 1
fi
echo "   ✓ PASSED"

# Foreign key check
echo "3. Checking foreign key constraints..."
FK_ERRORS=$(sqlite3 "$BACKUP_FILE" "PRAGMA foreign_key_check;" | wc -l)
if [ $FK_ERRORS -gt 0 ]; then
    echo "   ✗ FAILED: $FK_ERRORS foreign key violations found"
    exit 1
fi
echo "   ✓ PASSED"

# Count records
echo "4. Verifying table contents..."
SETTINGS_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM configuration_settings;")
CATEGORIES_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM settings_categories;")
echo "   Settings: $SETTINGS_COUNT"
echo "   Categories: $CATEGORIES_COUNT"

if [ $SETTINGS_COUNT -lt 1 ] || [ $CATEGORIES_COUNT -lt 1 ]; then
    echo "   ✗ WARNING: Tables appear empty"
else
    echo "   ✓ PASSED"
fi

echo ""
echo "Backup verification complete!"
```

Save as `scripts/verify-backup.sh` and use:
```bash
chmod +x scripts/verify-backup.sh
./scripts/verify-backup.sh backups/dispatch-backup-20250929-143000.db
```

## Disaster Recovery

### Complete Database Loss

1. **Stop the application**
   ```bash
   docker-compose down
   ```

2. **Locate most recent backup**
   ```bash
   ls -lt backups/dispatch-backup-*.db | head -1
   ```

3. **Verify backup integrity**
   ```bash
   ./scripts/verify-backup.sh backups/dispatch-backup-YYYYMMDD-HHMMSS.db
   ```

4. **Restore backup**
   ```bash
   cp backups/dispatch-backup-YYYYMMDD-HHMMSS.db dispatch.db
   ```

5. **Verify restored database**
   ```bash
   sqlite3 dispatch.db "PRAGMA integrity_check;"
   sqlite3 dispatch.db "SELECT * FROM settings_categories;"
   ```

6. **Restart application**
   ```bash
   docker-compose up -d
   ```

7. **Verify application functionality**
   - Access web interface
   - Check settings are present
   - Verify workspaces load
   - Test session creation

### Partial Data Loss

If only specific data is lost or corrupted:

1. **Export affected tables from backup**
   ```bash
   sqlite3 dispatch-backup.db << EOF > recovered-settings.sql
   .dump settings_categories
   .dump configuration_settings
   EOF
   ```

2. **Drop affected tables from current database**
   ```bash
   sqlite3 dispatch.db << EOF
   DROP TABLE configuration_settings;
   DROP TABLE settings_categories;
   EOF
   ```

3. **Import from backup**
   ```bash
   sqlite3 dispatch.db < recovered-settings.sql
   ```

4. **Verify foreign key integrity**
   ```bash
   sqlite3 dispatch.db "PRAGMA foreign_key_check;"
   ```

## Best Practices

### Backup Frequency

- **Development**: Daily backups sufficient
- **Production**: Hourly or continuous (WAL-based)
- **Before Updates**: Always backup immediately before

### Backup Retention

Recommended retention policy:
- Keep last 7 daily backups
- Keep last 4 weekly backups (Sunday)
- Keep last 12 monthly backups (1st of month)
- Keep indefinite backups before major version upgrades

### Backup Storage

**Local storage:**
- Keep backups on different drive/partition
- Regularly verify backup accessibility

**Remote storage:**
- Use cloud storage (S3, GCS, Azure Blob)
- Encrypt backups before uploading
- Test restoration from remote backups

### Backup Testing

**Monthly restoration test**:
```bash
# 1. Create test directory
mkdir test-restore
cd test-restore

# 2. Copy latest backup
cp ../backups/dispatch-backup-latest.db ./dispatch.db

# 3. Start temporary instance
PORT=3031 npm start

# 4. Verify functionality
curl http://localhost:3031/api/settings?authKey=YOUR_KEY

# 5. Clean up
Ctrl+C
cd ..
rm -rf test-restore
```

## Backup Monitoring

### Check Backup Status

```bash
#!/bin/bash
# Monitor backup health

BACKUP_DIR="./backups"
MAX_AGE_HOURS=24

LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/dispatch-backup-*.db | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backups found!"
    exit 1
fi

# Check backup age
BACKUP_AGE=$(find "$LATEST_BACKUP" -mmin +$((MAX_AGE_HOURS * 60)) | wc -l)

if [ $BACKUP_AGE -gt 0 ]; then
    echo "WARNING: Latest backup is older than $MAX_AGE_HOURS hours"
    echo "  File: $LATEST_BACKUP"
    echo "  Age: $(stat -f %Sm -t "%Y-%m-%d %H:%M:%S" "$LATEST_BACKUP")"
    exit 1
fi

echo "Backup status: OK"
echo "  Latest: $(basename "$LATEST_BACKUP")"
echo "  Age: $(stat -f %Sm -t "%Y-%m-%d %H:%M:%S" "$LATEST_BACKUP")"
echo "  Size: $(du -h "$LATEST_BACKUP" | cut -f1)"
```

### Alerting

Integrate with monitoring systems:

```bash
# Example: Send email alert on backup failure
if ! ./scripts/backup-database.sh; then
    echo "Backup failed at $(date)" | mail -s "Dispatch Backup Failed" admin@example.com
fi

# Example: Slack notification
if ! ./scripts/backup-database.sh; then
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
        -H 'Content-Type: application/json' \
        -d '{"text":"Dispatch database backup failed!"}'
fi
```

## Emergency Procedures

### Database Corruption Detected

```bash
# 1. Stop application immediately
docker-compose down

# 2. Backup corrupted database for analysis
cp dispatch.db dispatch-corrupted-$(date +%Y%m%d).db

# 3. Attempt recovery
sqlite3 dispatch-corrupted.db ".recover" > recovered.sql

# 4. Create new database from recovery
rm dispatch.db
sqlite3 dispatch.db < recovered.sql

# 5. If recovery fails, restore from backup
cp backups/dispatch-backup-latest.db dispatch.db

# 6. Restart and verify
docker-compose up -d
```

### Backup Files Corrupted

```bash
# Check all backups
for backup in backups/dispatch-backup-*.db; do
    echo "Checking: $backup"
    sqlite3 "$backup" "PRAGMA integrity_check;"
done

# Find oldest working backup
for backup in $(ls -rt backups/dispatch-backup-*.db); do
    if sqlite3 "$backup" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo "Working backup found: $backup"
        break
    fi
done
```

## Additional Resources

- **SQLite Backup Documentation**: https://www.sqlite.org/backup.html
- **SQLite Integrity Check**: https://www.sqlite.org/pragma.html#pragma_integrity_check
- **Dispatch Settings Documentation**: `docs/settings-migration.md`
- **Database Schema**: `src/lib/server/settings/schema.sql`

## Support

For backup and recovery assistance:

1. Check this documentation for procedures
2. Verify backup integrity before restoration
3. Test restoration in non-production environment first
4. Consult SQLite documentation for advanced recovery scenarios