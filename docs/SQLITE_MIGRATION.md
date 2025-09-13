# SQLite Migration

This document explains the migration from file-based storage to SQLite database for all server-side storage in Dispatch.

## Overview

The Dispatch application has been migrated from file-based storage to use SQLite for better performance, reliability, and centralized data management. All session history, workspace data, terminal logs, and Claude session metadata are now stored in a single SQLite database.

## Database Location

The SQLite database is created at:

- **Default**: `~/.dispatch/data`
- **Environment**: Can be customized by setting the database path in the DatabaseManager constructor

## Migration

### Automatic Migration

The database will be automatically initialized when the application starts. No manual intervention is required for new installations.

### Manual Migration for Existing Data

If you have existing file-based data that you want to migrate to SQLite, run:

```bash
npm run migrate
```

This will:

1. Scan for existing history files in `~/.dispatch/history/`
2. Look for workspace index files
3. Migrate terminal history from configured directories
4. Convert all data to SQLite format
5. Preserve existing data structure and functionality

### Testing the Migration

You can test the database functionality with:

```bash
# Test core database operations
npm run test:database

# Test manager integration with SQLite
npm run test:managers
```

## Database Schema

The SQLite database includes the following tables:

### Core Tables

- `sessions` - Socket session tracking
- `session_history` - Event history for each session
- `workspaces` - Workspace metadata
- `workspace_sessions` - Session mappings to workspaces

### Storage Tables

- `terminal_history` - Terminal output history
- `claude_sessions` - Claude session metadata
- `logs` - Application logs

### Indexes

Performance indexes are created on frequently queried columns like timestamps, session IDs, and workspace paths.

## Migration Details

### What's Migrated

- **History Files**: `~/.dispatch/history/*.json` → `sessions` and `session_history` tables
- **Workspace Index**: Various workspace JSON files → `workspaces` and `workspace_sessions` tables
- **Terminal History**: Log files → `terminal_history` table
- **Claude Metadata**: Session tracking → `claude_sessions` table

### What's Preserved

- **Claude JSONL Files**: These remain unchanged for Claude SDK compatibility
- **File Structure**: Original files are not deleted (consider backing them up)
- **API Compatibility**: All existing APIs continue to work unchanged

## Performance Benefits

- **Faster Queries**: SQL indexes provide faster data retrieval
- **Concurrent Access**: SQLite WAL mode enables better concurrent read/write
- **Data Integrity**: ACID transactions ensure data consistency
- **Centralized Management**: Single database file simplifies backup and maintenance

## Troubleshooting

### Migration Issues

If migration fails:

1. Check file permissions on `~/.dispatch/` directory
2. Ensure sufficient disk space for the database
3. Review console output for specific errors
4. Run `npm run test:database` to verify database functionality

### Runtime Issues

If the application fails to start:

1. Check that SQLite is properly installed (`sqlite3` npm package)
2. Verify database file permissions
3. Check available disk space
4. Review application logs for database initialization errors

### Reverting to File Storage

While not recommended, the original managers can be restored by:

1. Reverting the manager files to use file-based storage
2. Ensuring the old file structures exist
3. Removing database initialization from `hooks.server.js`

## Development

### Adding New Storage

To add new storage requirements:

1. Add table schema to `DatabaseManager.createTables()`
2. Add methods to `DatabaseManager` class
3. Update relevant manager classes to use new database methods
4. Add migration logic in `DataMigrator` if needed

### Testing

Always test storage changes with:

```bash
npm run test:database
npm run test:managers
```

### Database Operations

The `DatabaseManager` class provides methods for:

- Session management
- Event logging
- Workspace operations
- Terminal history
- Claude session tracking
- Application logging
- Data cleanup
