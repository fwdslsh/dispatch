# Database Schema Reference

Dispatch uses SQLite for persistent storage with an event-sourced architecture for session management. The database is located at `~/.dispatch/data/workspace.db` (or `.testing-home/dispatch/data/workspace.db` in development).

## Database Configuration

**SQLite Pragmas:**

- `journal_mode=WAL` - Write-Ahead Logging for better concurrent access
- `foreign_keys=ON` - Enforce referential integrity
- `busy_timeout=5000` - 5-second timeout for locked database

**Location:**

- Production: `~/.dispatch/data/workspace.db`
- Development: `.testing-home/dispatch/data/workspace.db`

## Core Tables

### sessions

The central table for all run sessions (terminal, Claude, file editor).

```sql
CREATE TABLE sessions (
    run_id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    kind TEXT NOT NULL,              -- Session type: 'terminal', 'ai', 'file-editor'
    status TEXT NOT NULL,            -- 'starting'|'running'|'stopped'|'error'
    created_at INTEGER NOT NULL,     -- Unix timestamp in milliseconds
    updated_at INTEGER NOT NULL,     -- Unix timestamp in milliseconds
    meta_json TEXT NOT NULL          -- JSON: {workspacePath, shell, env, model, etc.}
)
```

**Indexes:**

- `ix_sessions_kind` on `kind`
- `ix_sessions_status` on `status`

**Field Details:**

- `run_id`: Unique session identifier (e.g., `terminal_abc123`, `claude_xyz789`)
- `owner_user_id`: User identifier (for future multi-user support, currently nullable)
- `kind`: Session type constant from `SESSION_TYPE`
  - `pty` - Terminal session via node-pty
  - `claude` - Claude Code session
  - `file-editor` - File editing session
- `status`: Current session state
  - `starting` - Session is initializing
  - `running` - Session is active
  - `stopped` - Session has been terminated
  - `error` - Session encountered an error
- `created_at` / `updated_at`: Timestamps in milliseconds (Unix epoch)
- `meta_json`: JSON blob containing session-specific metadata

**Example meta_json structures:**

```json
// Terminal session
{
  "workspacePath": "/workspace/my-project",
  "shell": "/bin/bash",
  "cwd": "/workspace/my-project",
  "env": {"PATH": "..."},
  "options": {
    "cols": 80,
    "rows": 24,
    "workspaceEnv": {"MY_VAR": "value"}
  }
}

// Claude session
{
  "workspacePath": "/workspace/my-project",
  "cwd": "/workspace/my-project",
  "options": {
    "model": "claude-3-5-sonnet-20241022",
    "permissionMode": "default",
    "maxTurns": null
  }
}
```

### session_events

Event sourcing log for all session activity. Enables session replay and multi-client synchronization.

```sql
CREATE TABLE session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    seq INTEGER NOT NULL,            -- Monotonic sequence per run_id
    channel TEXT NOT NULL,           -- Event channel: 'terminal:stdout', 'claude:message', 'system:status'
    type TEXT NOT NULL,              -- Event type: 'chunk', 'text', 'json', 'open', 'close'
    payload BLOB NOT NULL,           -- JSON or binary data
    ts INTEGER NOT NULL,             -- Unix timestamp in milliseconds
    FOREIGN KEY (run_id) REFERENCES sessions(run_id)
)
```

**Indexes:**

- `ix_events_run_seq` (UNIQUE) on `(run_id, seq)` - Ensures unique sequence numbers
- `ix_events_run_ts` on `(run_id, ts)` - Enables timestamp-based queries

**Field Details:**

- `id`: Auto-incrementing primary key
- `run_id`: Foreign key to sessions table
- `seq`: Monotonically increasing sequence number per session (starts at 1)
- `channel`: Event channel identifier
  - `terminal:stdout` - Terminal standard output
  - `terminal:stderr` - Terminal standard error
  - `claude:message` - Claude message events
  - `claude:error` - Claude error events
  - `system:status` - System status changes
- `type`: Event payload type
  - `chunk` - Binary data chunk
  - `text` - Text data
  - `json` - JSON object
  - `open` - Session opened
  - `close` - Session closed
- `payload`: BLOB containing event data (JSON or binary)
- `ts`: Event timestamp in milliseconds

**Event Sourcing Pattern:**

Clients can replay events from a specific sequence number:

```javascript
// Client tracks last seen sequence number
const events = await db.getSessionEventsSince(runId, lastSeq);

// Events are ordered by seq for guaranteed ordering
events.forEach((event) => {
	// Process event
	lastSeq = event.seq;
});
```

### workspace_layout

Client-specific UI layouts for sessions. Each browser/device maintains its own layout.

```sql
CREATE TABLE workspace_layout (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    client_id TEXT NOT NULL,           -- Device/browser-specific identifier
    tile_id TEXT NOT NULL,             -- UI tile identifier
    created_at INTEGER,                -- Unix timestamp in milliseconds
    updated_at INTEGER,                -- Unix timestamp in milliseconds
    UNIQUE(run_id, client_id)          -- One layout per run per client
)
```

**Indexes:**

- `ix_workspace_layout_client` on `client_id`

**Field Details:**

- `run_id`: Session identifier
- `client_id`: Browser/device identifier (from `localStorage`)
- `tile_id`: UI tile position identifier (e.g., `tile-1`, `tile-2`)
- Unique constraint ensures each client has one layout entry per session

### workspaces

Workspace metadata for organizing projects.

```sql
CREATE TABLE workspaces (
    path TEXT PRIMARY KEY,
    name TEXT,
    last_active INTEGER,               -- Unix timestamp in milliseconds
    created_at INTEGER,                -- Unix timestamp in milliseconds
    updated_at INTEGER,                -- Unix timestamp in milliseconds
    theme_override TEXT DEFAULT NULL  -- Optional theme override for workspace
)
```

**Field Details:**

- `path`: Absolute filesystem path (e.g., `/workspace/my-project`)
- `name`: Display name (auto-derived from path if not provided)
- `last_active`: Last activity timestamp for sorting and archival
- `theme_override`: Optional theme identifier to override global theme

**Workspace Status:**

Status is derived dynamically based on sessions and activity:

```javascript
if (sessionCounts.running > 0) status = 'active';
else if (daysSinceActivity > 30) status = 'archived';
else if (lastActive) status = 'inactive';
else status = 'new';
```

### logs

Application logs for debugging and monitoring.

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,                        -- 'info', 'warn', 'error', 'debug'
    component TEXT,                    -- Component identifier
    message TEXT,                      -- Log message
    data TEXT,                         -- JSON blob for additional data
    timestamp INTEGER                  -- Unix timestamp in milliseconds
)
```

**Indexes:**

- `ix_logs_timestamp` on `timestamp`

### settings

Server-wide configuration settings organized by category.

```sql
CREATE TABLE settings (
    category TEXT PRIMARY KEY,         -- 'global', 'ai', 'terminal', 'workspace'
    settings_json TEXT NOT NULL,       -- JSON object containing all settings for category
    description TEXT,                  -- Human-readable category description
    created_at INTEGER NOT NULL,       -- Unix timestamp in milliseconds
    updated_at INTEGER NOT NULL        -- Unix timestamp in milliseconds
)
```

**Default Categories:**

```json
// global
{
  "theme": "retro",
  "defaultWorkspaceDirectory": "/workspace"
}

// claude
{
  "model": "claude-3-5-sonnet-20241022",
  "permissionMode": "default",
  "executable": "auto",
  "maxTurns": null,
  "includePartialMessages": false,
  "continueConversation": false
}

// workspace
{
  "envVariables": {
    "MY_VAR": "value"
  }
}
```

### user_preferences

User-specific UI preferences (distinct from server settings).

```sql
CREATE TABLE user_preferences (
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    preferences_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, category)
)
```

**Field Details:**

- `user_id`: Currently always `'default'` (single-user system)
- `category`: Preference category (e.g., `ui`, `editor`, `terminal`)
- `preferences_json`: JSON object with user preferences

## Authentication Tables

### auth_sessions

OAuth session tracking for authenticated users.

```sql
CREATE TABLE auth_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

### auth_users

User account information.

```sql
CREATE TABLE auth_users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
)
```

### device_pairs

Device authorization for terminal access.

```sql
CREATE TABLE device_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT UNIQUE NOT NULL,
    user_code TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    user_id TEXT,
    status TEXT DEFAULT 'pending'     -- 'pending', 'approved', 'denied', 'expired'
)
```

### device_codes

Device authorization codes for pairing flow.

```sql
CREATE TABLE device_codes (
    device_code TEXT PRIMARY KEY,
    user_code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    scope TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    interval INTEGER DEFAULT 5
)
```

## Common Query Patterns

### Get Sessions for Workspace

```sql
SELECT s.run_id, s.kind, s.status, s.created_at, s.updated_at, s.meta_json
FROM sessions s
WHERE JSON_EXTRACT(s.meta_json, '$.workspacePath') = '/workspace/my-project'
ORDER BY s.created_at DESC;
```

### Count Sessions by Status for Workspace

```sql
SELECT COUNT(*) as count, status
FROM sessions
WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = '/workspace/my-project'
GROUP BY status;
```

### Get Session Events Since Sequence

```sql
SELECT run_id, seq, channel, type, payload, ts
FROM session_events
WHERE run_id = 'terminal_abc123' AND seq > 100
ORDER BY seq ASC;
```

### Get Next Sequence Number

```sql
SELECT COALESCE(MAX(seq), 0) as maxSeq
FROM session_events
WHERE run_id = 'terminal_abc123';
-- Next seq = maxSeq + 1
```

### Get Client Layout

```sql
SELECT run_id, tile_id
FROM workspace_layout
WHERE client_id = 'client-123'
ORDER BY updated_at DESC;
```

### Get All Workspaces with Session Counts

```sql
SELECT w.path, w.name, w.last_active,
       COUNT(s.run_id) as total_sessions,
       SUM(CASE WHEN s.status = 'running' THEN 1 ELSE 0 END) as running_sessions
FROM workspaces w
LEFT JOIN sessions s ON JSON_EXTRACT(s.meta_json, '$.workspacePath') = w.path
GROUP BY w.path
ORDER BY w.last_active DESC;
```

## Data Integrity

**Foreign Keys:**

- `session_events.run_id` → `sessions.run_id`
  - Cascading deletes: When a session is deleted, its events are deleted first

**Unique Constraints:**

- `workspace_layout(run_id, client_id)` - One layout per client per session
- `session_events(run_id, seq)` - Unique sequence numbers per session

**Serialization:**

- Write operations are serialized via a `writeQueue` in DatabaseManager to prevent SQLITE_BUSY errors
- Read operations use retry logic with exponential backoff (3 retries, 100ms base)

## Migration Strategy

Migrations are handled by `/src/lib/server/shared/db/migrate.js`:

- Migration tracking via `_migrations` table
- Migrations run on startup before table creation
- Schema updates use `ALTER TABLE` with existence checks

**Example Migration:**

```javascript
{
  id: 'add_theme_override',
  run: async (db) => {
    const columns = await db.all('PRAGMA table_info(workspaces)');
    const hasColumn = columns.some(col => col.name === 'theme_override');
    if (!hasColumn) {
      await db.run('ALTER TABLE workspaces ADD COLUMN theme_override TEXT DEFAULT NULL');
    }
  }
}
```

## Performance Considerations

**Indexes:** All high-traffic queries have supporting indexes

- Sessions: `kind`, `status`
- Events: `(run_id, seq)`, `(run_id, ts)`
- Layout: `client_id`
- Logs: `timestamp`

**WAL Mode:** Enables concurrent reads while writes are in progress

**Connection Pooling:** Single connection with serialized writes via queue

**Cleanup:**

- Stopped sessions can be manually cleaned via maintenance API
- Event log grows indefinitely (consider periodic archival for production)

## Troubleshooting

**View Schema:**

```bash
sqlite3 ~/.dispatch/data/workspace.db "SELECT sql FROM sqlite_master WHERE type='table';"
```

**Check Table Info:**

```bash
sqlite3 ~/.dispatch/data/workspace.db "PRAGMA table_info(sessions);"
```

**View Recent Events:**

```bash
sqlite3 ~/.dispatch/data/workspace.db "
  SELECT run_id, seq, channel, type, datetime(ts/1000, 'unixepoch') as time
  FROM session_events
  ORDER BY ts DESC
  LIMIT 20;
"
```

**Session Status:**

```bash
sqlite3 ~/.dispatch/data/workspace.db "
  SELECT kind, status, COUNT(*) as count
  FROM sessions
  GROUP BY kind, status;
"
```
