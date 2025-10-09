# API Routes Reference

Complete reference for all REST API endpoints in Dispatch. All routes are prefixed with `/api/`.

## Authentication

**Methods:**

1. **Authorization Header** (preferred):

   ```
   Authorization: Bearer YOUR_TERMINAL_KEY
   ```

2. **Query Parameter** (backwards compatible):
   ```
   ?authKey=YOUR_TERMINAL_KEY
   ```

**Authentication is validated by hooks middleware** (`src/hooks.server.js`) for protected routes. The `locals.auth` object contains authentication state.

## Session Management

### POST /api/sessions

Create a new session.

**Request Body:**

```json
{
	"kind": "pty", // or 'claude', 'file-editor'
	"type": "pty", // Alias for kind (backwards compat)
	"cwd": "/workspace/my-project", // Optional working directory
	"resume": false, // Set to true with sessionId to resume
	"sessionId": "pty_abc123", // Required if resume=true
	"options": {
		// Session-specific options
		"cols": 120,
		"rows": 30,
		"env": { "MY_VAR": "value" }
	}
}
```

**Response (201 Created):**

```json
{
  "runId": "pty_abc123",
  "success": true,
  "kind": "pty",
  "type": "pty"
}

// Or for resume:
{
  "runId": "pty_abc123",
  "id": "pty_abc123",
  "success": true,
  "resumed": true,
  "kind": "pty",
  "type": "pty",
  "reason": "Session restarted"
}
```

**Error Codes:**

- `400` - Invalid or missing kind
- `404` - Session not found (when resuming)
- `503` - Session functionality temporarily unavailable

### GET /api/sessions

List all sessions.

**Query Parameters:**

- `include=all` - Include stopped sessions (default: active only)

**Response:**

```json
{
	"sessions": [
		{
			"id": "pty_abc123",
			"type": "pty",
			"title": "Terminal Session",
			"workspacePath": "/workspace/my-project",
			"isActive": true,
			"createdAt": 1698765432100,
			"lastActivity": 1698765532100,
			"inLayout": true,
			"tileId": "tile-1",
			"pinned": false
		}
	]
}
```

### DELETE /api/sessions

Close a session.

**Query Parameters:**

- `runId` (required) - Session identifier

**Response:**

```json
{
	"success": true
}
```

**Error Codes:**

- `400` - Missing runId parameter
- `500` - Deletion failed

### PUT /api/sessions

Update workspace layout for a session.

**Request Body:**

```json
// Set layout
{
  "action": "setLayout",
  "runId": "pty_abc123",
  "clientId": "client-xyz",
  "tileId": "tile-1"
}

// Remove layout
{
  "action": "removeLayout",
  "runId": "pty_abc123",
  "clientId": "client-xyz"
}

// Get layout
{
  "action": "getLayout",
  "clientId": "client-xyz"
}
```

**Response:**

```json
{
  "success": true
}

// For getLayout:
{
  "layout": [
    {
      "run_id": "pty_abc123",
      "tile_id": "tile-1",
      "updated_at": 1698765432100
    }
  ]
}
```

### GET /api/sessions/[id]/history

Get session event history.

**Query Parameters:**

- `seq` (optional) - Starting sequence number (default: 0)
- `limit` (optional) - Maximum events to return (default: 100)

**Response:**

```json
{
	"events": [
		{
			"runId": "pty_abc123",
			"seq": 1,
			"channel": "pty:stdout",
			"type": "chunk",
			"payload": { "data": "..." },
			"ts": 1698765432100
		}
	],
	"hasMore": false
}
```

### GET /api/sessions/layout

Get workspace layout for current client.

**Query Parameters:**

- `clientId` (required) - Client identifier

**Response:**

```json
{
	"layout": [
		{
			"run_id": "pty_abc123",
			"client_id": "client-xyz",
			"tile_id": "tile-1",
			"created_at": 1698765432100,
			"updated_at": 1698765532100
		}
	]
}
```

## Workspace Management

See [Workspace API Reference](./workspace-api.md) for detailed workspace endpoints.

### GET /api/workspaces

List all workspaces.

**Query Parameters:**

- `authKey` (required) - Authentication key
- `limit` (optional) - Results per page (default: 50)
- `offset` (optional) - Results to skip (default: 0)
- `status` (optional) - Filter by status: `new`, `active`, `inactive`, `archived`

### POST /api/workspaces

Create a new workspace.

### GET /api/workspaces/[workspaceId]

Get workspace details including sessions.

### PUT /api/workspaces/[workspaceId]

Update workspace metadata.

### DELETE /api/workspaces/[workspaceId]

Delete a workspace.

## Settings Management

### GET /api/settings

Get all settings or settings for a specific category.

**Query Parameters:**

- `category` (optional) - Filter by category: `global`, `claude`, `workspace`, `terminal`

**Response:**

```json
{
  "global": {
    "theme": "retro",
    "defaultWorkspaceDirectory": "/workspace"
  },
  "claude": {
    "model": "claude-3-5-sonnet-20241022",
    "permissionMode": "default",
    "maxTurns": null
  },
  "workspace": {
    "envVariables": {}
  }
}

// Or with category filter:
{
  "global": {
    "theme": "retro"
  }
}
```

**Authentication:** Required (401 if not authenticated)

### GET /api/settings/[category]

Get settings for a specific category.

**Response:**

```json
{
	"category": "claude",
	"settings": {
		"model": "claude-3-5-sonnet-20241022",
		"permissionMode": "default"
	},
	"description": "Default Claude session settings",
	"created_at": 1698765432100,
	"updated_at": 1698765532100
}
```

### PUT /api/settings/[category]

Update settings for a category.

**Request Body:**

```json
{
	"model": "claude-3-5-sonnet-20241022",
	"permissionMode": "auto",
	"maxTurns": 10
}
```

**Response:**

```json
{
	"success": true,
	"category": "claude",
	"settings": {
		"model": "claude-3-5-sonnet-20241022",
		"permissionMode": "auto",
		"maxTurns": 10
	}
}
```

### GET /api/settings/workspace

Get workspace-specific settings (environment variables).

**Response:**

```json
{
	"envVariables": {
		"NODE_ENV": "development",
		"MY_VAR": "value"
	}
}
```

### PUT /api/settings/workspace

Update workspace environment variables.

**Request Body:**

```json
{
	"envVariables": {
		"NODE_ENV": "production",
		"API_KEY": "secret"
	}
}
```

### GET /api/settings/onboarding

Get onboarding completion status.

**Response:**

```json
{
	"completed": true,
	"completedAt": "2024-01-15T10:30:00.000Z"
}
```

### POST /api/settings/onboarding

Mark onboarding as completed.

**Request Body:**

```json
{
	"completed": true
}
```

## File Operations

### GET /api/files

Read a file.

**Query Parameters:**

- `path` (required) - Absolute file path

**Response:**

```json
{
	"path": "/workspace/my-project/file.txt",
	"content": "file contents here",
	"size": 1024,
	"modified": "2024-01-15T10:30:00.000Z",
	"readonly": false
}
```

**Error Codes:**

- `400` - Missing path or path is not a file
- `403` - Access denied
- `404` - File not found
- `413` - File too large (max 10MB)

### PUT /api/files

Write/update a file.

**Query Parameters:**

- `path` (required) - Absolute file path

**Request Body:**

```json
{
	"content": "new file contents"
}
```

**Response:**

```json
{
	"success": true,
	"path": "/workspace/my-project/file.txt",
	"size": 1024,
	"modified": "2024-01-15T10:30:00.000Z"
}
```

**Error Codes:**

- `400` - Missing path, invalid content, or directory doesn't exist
- `403` - Permission denied
- `507` - No space left on device

### POST /api/files/upload

Upload a file.

**Request:** Multipart form data

- `file` - File to upload
- `path` - Destination path

**Response:**

```json
{
	"success": true,
	"path": "/workspace/uploads/file.pdf",
	"size": 2048
}
```

## Directory Browsing

### GET /api/browse

Browse directory contents.

**Query Parameters:**

- `path` (optional) - Directory path (default: workspace root)
- `authKey` (required) - Authentication key

**Response:**

```json
{
	"path": "/workspace/my-project",
	"entries": [
		{
			"name": "src",
			"path": "/workspace/my-project/src",
			"type": "directory",
			"size": 4096,
			"modified": "2024-01-15T10:30:00.000Z",
			"permissions": "rwxr-xr-x"
		},
		{
			"name": "README.md",
			"path": "/workspace/my-project/README.md",
			"type": "file",
			"size": 1024,
			"modified": "2024-01-15T10:30:00.000Z",
			"permissions": "rw-r--r--"
		}
	],
	"parent": "/workspace"
}
```

### POST /api/browse/create

Create a new directory or file.

**Request Body:**

```json
{
	"path": "/workspace/my-project/new-dir",
	"type": "directory", // or 'file'
	"authKey": "your-key"
}
```

**Response:**

```json
{
	"success": true,
	"path": "/workspace/my-project/new-dir",
	"type": "directory"
}
```

### POST /api/browse/clone

Clone a git repository.

**Request Body:**

```json
{
	"url": "https://github.com/user/repo.git",
	"destination": "/workspace/repos",
	"authKey": "your-key"
}
```

**Response:**

```json
{
	"success": true,
	"path": "/workspace/repos/repo",
	"message": "Repository cloned successfully"
}
```

## Git Operations

### GET /api/git/status

Get git status for a repository.

**Query Parameters:**

- `path` - Repository path

**Response:**

```json
{
	"branch": "main",
	"modified": ["file1.js", "file2.js"],
	"staged": ["file3.js"],
	"untracked": ["newfile.js"],
	"ahead": 2,
	"behind": 0
}
```

### GET /api/git/branches

List git branches.

**Query Parameters:**

- `path` - Repository path

**Response:**

```json
{
	"current": "main",
	"branches": ["main", "develop", "feature/new-thing"]
}
```

### POST /api/git/checkout

Checkout a branch.

**Request Body:**

```json
{
	"path": "/workspace/my-project",
	"branch": "develop",
	"create": false // Set to true to create new branch
}
```

### POST /api/git/branch

Create a new branch.

**Request Body:**

```json
{
	"path": "/workspace/my-project",
	"name": "feature/new-thing"
}
```

### POST /api/git/stage

Stage files for commit.

**Request Body:**

```json
{
	"path": "/workspace/my-project",
	"files": ["file1.js", "file2.js"] // or ["."] for all
}
```

### POST /api/git/commit

Commit staged changes.

**Request Body:**

```json
{
	"path": "/workspace/my-project",
	"message": "feat: Add new feature"
}
```

### POST /api/git/push

Push commits to remote.

**Request Body:**

```json
{
	"path": "/workspace/my-project",
	"remote": "origin", // Optional
	"branch": "main" // Optional
}
```

### POST /api/git/pull

Pull changes from remote.

**Request Body:**

```json
{
	"path": "/workspace/my-project"
}
```

### GET /api/git/log

Get commit log.

**Query Parameters:**

- `path` - Repository path
- `limit` (optional) - Number of commits (default: 50)

**Response:**

```json
{
	"commits": [
		{
			"hash": "abc123",
			"message": "feat: Add new feature",
			"author": "John Doe",
			"date": "2024-01-15T10:30:00.000Z"
		}
	]
}
```

### GET /api/git/diff

Get diff for staged/unstaged changes.

**Query Parameters:**

- `path` - Repository path
- `staged` (optional) - Set to 'true' for staged diff

**Response:**

```json
{
	"diff": "diff --git a/file.js b/file.js\n..."
}
```

## Git Worktree Management

### GET /api/git/worktree/list

List all worktrees for a repository.

**Query Parameters:**

- `path` - Repository path

**Response:**

```json
{
	"worktrees": [
		{
			"path": "/workspace/my-project",
			"branch": "main",
			"isMain": true
		},
		{
			"path": "/workspace/my-project-feature",
			"branch": "feature/new-thing",
			"isMain": false
		}
	]
}
```

### POST /api/git/worktree/add

Create a new worktree.

**Request Body:**

```json
{
	"repoPath": "/workspace/my-project",
	"branch": "feature/new-thing",
	"path": "/workspace/my-project-feature"
}
```

### POST /api/git/worktree/remove

Remove a worktree.

**Request Body:**

```json
{
	"path": "/workspace/my-project-feature"
}
```

### POST /api/git/worktree/init-detect

Initialize or detect worktree-friendly repository.

**Request Body:**

```json
{
	"path": "/workspace/my-project"
}
```

## Claude Code

### GET /api/claude/projects

List Claude Code projects.

**Response:**

```json
{
	"projects": [
		{
			"id": "project-1",
			"name": "My Project",
			"path": "/workspace/my-project"
		}
	]
}
```

### GET /api/claude/auth

Get Claude authentication status.

**Response:**

```json
{
	"authenticated": true,
	"user": {
		"email": "user@example.com"
	}
}
```

### POST /api/claude/auth

Initiate Claude authentication.

**Request Body:**

```json
{
	"action": "login"
}
```

## Theme Management

### GET /api/themes

List all available themes.

**Response:**

```json
{
	"themes": [
		{
			"id": "retro",
			"name": "Retro",
			"description": "Classic terminal look"
		},
		{
			"id": "dracula",
			"name": "Dracula",
			"description": "Dark theme with purple accents"
		}
	]
}
```

### GET /api/themes/active

Get currently active theme.

**Response:**

```json
{
	"themeId": "retro"
}
```

### PUT /api/themes/active

Set active theme.

**Request Body:**

```json
{
	"themeId": "dracula"
}
```

### GET /api/themes/[themeId]

Get theme details.

**Response:**

```json
{
	"id": "retro",
	"name": "Retro",
	"description": "Classic terminal look",
	"colors": {
		"background": "#000000",
		"foreground": "#00ff00"
	}
}
```

### GET /api/themes/[themeId]/can-delete

Check if theme can be deleted.

**Response:**

```json
{
	"canDelete": false,
	"reason": "Theme is currently active"
}
```

### DELETE /api/themes/[themeId]

Delete a custom theme.

**Response:**

```json
{
	"success": true
}
```

## Authentication

### GET /api/auth/check

Check authentication status.

**Response:**

```json
{
	"authenticated": true,
	"method": "terminal_key",
	"sessionId": "session-abc123"
}
```

### GET /api/auth/config

Get authentication configuration.

**Response:**

```json
{
	"enabled": true,
	"methods": ["terminal_key", "oauth"]
}
```

### POST /api/auth/callback

OAuth callback handler.

## Environment & Status

### GET /api/environment

Get environment information.

**Response:**

```json
{
	"workspacesRoot": "/workspace",
	"nodeVersion": "22.0.0",
	"platform": "linux",
	"tunnelEnabled": true
}
```

### GET /api/status

Get server status.

**Response:**

```json
{
	"status": "running",
	"uptime": 3600000,
	"activeSessions": 5,
	"version": "1.0.0"
}
```

## Admin Endpoints

Require authentication and are intended for debugging/monitoring.

### GET /api/admin/sockets

List active socket connections.

**Response:**

```json
{
	"sockets": [
		{
			"id": "socket-123",
			"connected": true,
			"rooms": ["run:pty_abc123"],
			"connectedAt": 1698765432100
		}
	]
}
```

### GET /api/admin/events

Get recent socket events.

**Query Parameters:**

- `limit` (optional) - Number of events (default: 100)

**Response:**

```json
{
	"events": [
		{
			"socketId": "socket-123",
			"type": "run:attach",
			"data": {},
			"timestamp": 1698765432100
		}
	]
}
```

### GET /api/admin/history

Get event history for all sessions.

### GET /api/admin/history/[socketId]

Get event history for specific socket.

### GET /api/admin/logs

Get application logs.

**Query Parameters:**

- `component` (optional) - Filter by component
- `level` (optional) - Filter by level
- `limit` (optional) - Number of logs (default: 100)

### POST /api/admin/sockets/[socketId]/disconnect

Forcefully disconnect a socket.

### GET /api/admin/vscode-tunnel

Get VS Code tunnel status.

### POST /api/maintenance

Run database maintenance operations.

**Request Body:**

```json
{
	"action": "cleanup", // 'cleanup' or 'vacuum'
	"olderThan": 86400000 // Milliseconds (optional, for cleanup)
}
```

## Error Responses

All endpoints use consistent error response format:

```json
{
	"error": "Error message here",
	"details": {
		// Optional additional context
		"field": "value"
	}
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `413` - Payload Too Large
- `422` - Unprocessable Entity (business logic error)
- `500` - Internal Server Error
- `503` - Service Unavailable
- `507` - Insufficient Storage

## Rate Limiting

Currently no rate limiting is implemented. For production deployments, consider adding rate limiting middleware.

## CORS

CORS is configured to allow all origins (`*`) for development. Tighten this for production deployments.

## API Versioning

Currently no API versioning. Breaking changes will be documented in release notes.
