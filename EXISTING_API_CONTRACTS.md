# Existing API Contracts Documentation

This document describes the current API contracts that must be maintained during the workspace refactoring to ensure backward compatibility.

## Session Management API

### GET /api/sessions

**Purpose**: List sessions across workspaces with filtering options

**Query Parameters**:

- `workspace` (optional): Filter sessions by specific workspace path
- `include` (optional): Set to 'all' to include unpinned sessions, otherwise only pinned sessions

**Response Format**:

```json
{
  "sessions": [
    {
      "id": "string",
      "typeSpecificId": "string",
      "workspacePath": "string",
      "sessionType": "pty|claude",
      "isActive": boolean,
      "pinned": boolean,
      "title": "string",
      "createdAt": "ISO string",
      "lastActivity": "ISO string"
    }
  ]
}
```

**Behavior**:

- Returns merged view of active sessions (from SessionRouter) and persisted sessions (from database)
- Active sessions take precedence over persisted sessions
- When `pinnedOnly=true` (default), only shows pinned sessions plus new active sessions
- New sessions default to `pinned: true`

### POST /api/sessions

**Purpose**: Create new session or resume existing session

**Request Body**:

```json
{
  "type": "pty|claude",
  "workspacePath": "string",
  "options": object,
  "resume": boolean,
  "sessionId": "string" // required when resume=true
}
```

**Response Format**:

```json
{
  "id": "string",
  "typeSpecificId": "string|null",
  "resumed": boolean // only present when resuming
}
```

**Behavior**:

- For new sessions: Creates session via unified SessionManager
- For resumed sessions: Checks if already active, otherwise recreates from persisted data
- Claude sessions validate typeSpecificId (must look like UUID or long string with alpha chars)
- Error responses include specific messages for common issues (node-pty, Vite restarts)

### PUT /api/sessions

**Purpose**: Update session properties (rename, pin/unpin)

**Request Body**:

```json
{
	"action": "rename|pin|unpin",
	"sessionId": "string",
	"workspacePath": "string",
	"newTitle": "string" // only for rename action
}
```

**Response Format**:

```json
{
  "success": boolean
}
```

### DELETE /api/sessions

**Purpose**: Terminate a session

**Query Parameters**:

- `sessionId`: Required session ID
- `workspacePath`: Required workspace path

**Response Format**:

```json
{
  "success": boolean
}
```

## Workspace Management API

### GET /api/workspaces

**Purpose**: List all available workspaces

**Response Format**:

```json
{
	"list": [
		{
			"path": "string",
			"name": "string",
			"lastAccessed": "ISO string"
		}
	]
}
```

### POST /api/workspaces

**Purpose**: Open, create, or clone workspaces

**Request Body**:

```json
{
  "action": "open|create|clone",
  "path": "string", // for open/create
  "from": "string", // for clone
  "to": "string", // for clone
  "isNewProject": boolean // optional
}
```

**Response Format**:

```json
{
	"path": "string"
}
```

**Behavior for 'open' action**:

1. If absolute path provided: Validates and returns directly without persisting
2. If relative path: Resolves against WORKSPACES_ROOT
3. If not found: Attempts to resolve as Claude project name using projectsRoot
4. Claude projects are returned directly without persistence in workspace index

**Behavior for 'create' action**:

- Creates new workspace directory
- Supports both absolute and relative paths
- Persists in workspace database

**Behavior for 'clone' action**:

- Copies workspace from one location to another
- Supports both absolute and relative paths for source and destination

## Claude Integration APIs

### GET /api/claude/projects

**Purpose**: List available Claude projects

### GET /api/claude/sessions/[project]

**Purpose**: Get Claude sessions for specific project

### POST /api/claude/auth

**Purpose**: Check Claude authentication status

## Admin APIs (Console Interface)

### GET /api/admin/events

**Purpose**: Get admin console events

### GET /api/admin/history

**Purpose**: Get socket history

### GET /api/admin/sockets

**Purpose**: Get active socket connections

## Socket.IO Event Contracts

### Client -> Server Events

**Authentication**:

- `auth(key, callback)` - Authenticate without starting session

**Terminal Operations**:

- `terminal.start(data, callback)` - Start terminal session
  - Data: `{key, workspacePath, shell, env}`
- `terminal.write(data)` - Send input to terminal
  - Data: `{key, id, data}`
- `terminal.resize(data)` - Resize terminal
  - Data: `{key, id, cols, rows}`

**Claude Operations**:

- `claude.send(data)` - Send message to Claude
  - Data: `{key, id, input}`
- `claude.auth.start(data)` - Initiate Claude OAuth flow
- `claude.auth.code(data)` - Submit OAuth authorization code
- `claude.commands.refresh(data, callback)` - Refresh available Claude commands

**Session Operations**:

- `session.status(data, callback)` - Get session status and activity state
- `session.catchup(data)` - Request missed messages for a session

**Utility**:

- `get-public-url(callback)` - Retrieve public tunnel URL

### Server -> Client Events

**Terminal Events**:

- `terminal.output({sessionId, data})` - Terminal output data
- `terminal.exit({sessionId, exitCode})` - Terminal session ended

**Claude Events**:

- `claude.message.delta(events)` - Claude response events array
- `claude.auth.url({url})` - OAuth authorization URL
- `claude.auth.complete({success})` - OAuth completion status
- `claude.auth.error({error})` - OAuth error

**Admin Events**:

- `admin.event.logged(event)` - Admin console event tracking

**Error Events**:

- `error(data)` - Error messages

## Database Schema Contracts

### Tables that external APIs depend on:

**workspaces**:

- `id` INTEGER PRIMARY KEY
- `path` TEXT UNIQUE
- `name` TEXT
- `created_at` DATETIME
- `last_accessed` DATETIME

**workspace_sessions**:

- `id` INTEGER PRIMARY KEY
- `workspace_path` TEXT
- `session_id` TEXT
- `type_specific_id` TEXT
- `session_type` TEXT
- `title` TEXT
- `pinned` BOOLEAN
- `created_at` DATETIME
- `last_activity` DATETIME

## Environment Variables

**Required**:

- `TERMINAL_KEY` - Authentication key

**Optional**:

- `PORT` - Server port (default: 3030)
- `WORKSPACES_ROOT` - Default workspace directory
- `DISPATCH_CONFIG_DIR` - Configuration directory
- `ENABLE_TUNNEL` - LocalTunnel support
- `LT_SUBDOMAIN` - LocalTunnel subdomain

## Critical Backward Compatibility Requirements

1. **API Endpoint URLs**: All existing API endpoints must continue to work
2. **Request/Response Formats**: JSON structures must remain compatible
3. **Socket.IO Events**: All event names and data structures must be preserved
4. **Database Schema**: Existing tables and columns must be maintained
5. **Session ID Format**: Unified session IDs and type-specific IDs must coexist
6. **Error Handling**: Error response formats and status codes must be consistent
7. **Authentication**: Shared key authentication mechanism must be preserved
8. **Workspace Path Handling**: Support for both absolute and relative paths must continue

## Migration Notes

During the refactoring:

- New MVVM components will use existing API contracts through new service layers
- ViewModels will wrap existing API calls to provide reactive state
- Service layer will maintain backward compatibility while providing modern abstractions
- Database operations will be enhanced but not break existing schema
- Socket.IO event handling will be wrapped but not changed

The refactoring should be transparent to existing API consumers.
