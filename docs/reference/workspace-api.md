# Workspace Management API

The Workspace API provides REST endpoints for managing development workspaces in Dispatch. All endpoints require authentication via the `TERMINAL_KEY`.

## Authentication

All workspace endpoints require authentication. Authentication is validated by the hooks middleware (`src/hooks.server.js`).

**Methods:**

1. **Authorization Header** (preferred): `Authorization: Bearer YOUR_TERMINAL_KEY`

**Implementation:**

- Authentication is checked by SvelteKit hooks before route handlers execute
- `locals.auth.authenticated` indicates authentication status
- 401 responses are returned automatically for unauthenticated requests to protected routes

## Endpoints

### List Workspaces

**GET** `/api/workspaces`

Lists all available workspaces with metadata and session counts.

**Query Parameters:**

- `authKey` (string, required): Authentication key
- `limit` (integer, optional): Number of workspaces per page (default: 50)
- `offset` (integer, optional): Number of workspaces to skip (default: 0)
- `status` (string, optional): Filter by workspace status (`new`, `active`, `archived`)

**Response:**

```json
{
	"workspaces": [
		{
			"id": "/workspace/my-project",
			"name": "My Project",
			"path": "/workspace/my-project",
			"status": "active",
			"createdAt": "2024-01-15T10:30:00.000Z",
			"updatedAt": "2024-01-15T14:20:00.000Z",
			"lastActive": "2024-01-15T14:20:00.000Z",
			"sessionCounts": {
				"total": 3,
				"running": 1,
				"stopped": 2,
				"error": 0
			}
		}
	],
	"pagination": {
		"total": 1,
		"limit": 50,
		"offset": 0,
		"hasMore": false
	}
}
```

### Create Workspace

**POST** `/api/workspaces`

Creates a new workspace.

**Request Body:**

```json
{
	"path": "/workspace/new-project",
	"name": "New Project",
	"authKey": "YOUR_TERMINAL_KEY"
}
```

**Validation Rules:**

- `path`: Must be absolute, within allowed workspace root, no path traversal
- `name`: Required, 1-100 characters
- Path must not already exist as a workspace

**Response (201 Created):**

```json
{
	"id": "/workspace/new-project",
	"name": "New Project",
	"path": "/workspace/new-project",
	"status": "new",
	"createdAt": "2024-01-15T15:00:00.000Z",
	"updatedAt": "2024-01-15T15:00:00.000Z",
	"lastActive": null,
	"sessionCounts": {
		"total": 0,
		"running": 0,
		"stopped": 0,
		"error": 0
	}
}
```

### Get Workspace Details

**GET** `/api/workspaces/{workspaceId}`

Retrieves detailed information about a specific workspace, including active sessions.

**Parameters:**

- `workspaceId` (string): URL-encoded workspace path

**Response:**

```json
{
	"id": "/workspace/my-project",
	"name": "My Project",
	"path": "/workspace/my-project",
	"status": "active",
	"createdAt": "2024-01-15T10:30:00.000Z",
	"updatedAt": "2024-01-15T14:20:00.000Z",
	"lastActive": "2024-01-15T14:20:00.000Z",
	"sessionCounts": {
		"running": 1,
		"stopped": 2,
		"starting": 0,
		"error": 0
	},
	"sessionStats": {
		"total": 3,
		"byStatus": {
			"running": 1,
			"stopped": 2
		},
		"byType": {
			"pty": 2,
			"claude": 1
		}
	},
	"activeSessions": [
		{
			"id": "sess_abc123",
			"type": "pty",
			"status": "running",
			"createdAt": "2024-01-15T14:00:00.000Z",
			"lastActivity": "2024-01-15T14:20:00.000Z"
		}
	]
}
```

### Update Workspace

**PUT** `/api/workspaces/{workspaceId}`

Updates workspace metadata.

**Parameters:**

- `workspaceId` (string): URL-encoded workspace path

**Request Body:**

```json
{
	"name": "Updated Project Name",
	"status": "active"
}
```

**Updatable Fields:**

- `name`: Workspace display name (required if provided, cannot be empty)
- `status`: Workspace status (`active`, `inactive`, `archived`)

**Validation:**

- Cannot archive workspace with active (running/starting) sessions
- Name must not be empty string if provided

**Response:**

```json
{
	"id": "/workspace/my-project",
	"name": "Updated Project Name",
	"path": "/workspace/my-project",
	"status": "active",
	"createdAt": "2024-01-15T10:30:00.000Z",
	"lastActive": "2024-01-15T15:30:00.000Z",
	"updatedAt": "2024-01-15T15:30:00.000Z",
	"sessionCounts": {
		"total": 3,
		"running": 1,
		"stopped": 2,
		"starting": 0,
		"error": 0
	}
}
```

**Error Responses:**

```json
// 400 - Invalid status
{
	"message": "Invalid status. Must be one of: active, inactive, archived"
}

// 400 - Empty name
{
	"message": "Workspace name cannot be empty"
}

// 400 - Active sessions when archiving
{
	"message": "Cannot archive workspace with active sessions"
}
```

### Delete Workspace

**DELETE** `/api/workspaces/{workspaceId}`

Soft deletes a workspace from the database. Sessions and events are preserved for historical reference.

**Parameters:**

- `workspaceId` (string): URL-encoded workspace path

**Validation:**

- Workspace cannot have active (running or starting) sessions
- Must stop all sessions before deletion

**Implementation Details:**

- Removes workspace entry from `workspaces` table
- Removes associated workspace layout entries
- **Does NOT delete sessions or session events** (preserved for history)
- This is a soft delete - workspace metadata is removed but session data remains

**Response:**

```json
{
	"message": "Workspace deleted successfully"
}
```

**Error Responses:**

```json
// 400 - Active sessions
{
	"message": "Cannot delete workspace with active sessions"
}

// 404 - Not found
{
	"message": "Workspace not found"
}
```

## Error Responses

All endpoints return consistent error formats:

**400 Bad Request:**

```json
{
	"message": "Invalid workspace path: must be absolute path"
}
```

**401 Unauthorized:**

```json
{
	"message": "Authentication required. Provide valid authKey."
}
```

**404 Not Found:**

```json
{
	"message": "Workspace not found: /workspace/missing"
}
```

**409 Conflict:**

```json
{
	"message": "Workspace already exists: /workspace/existing"
}
```

**422 Unprocessable Entity:**

```json
{
	"message": "Cannot delete workspace with 2 active sessions"
}
```

## Usage Examples

### Create and manage a workspace

```bash
# Create workspace
curl -X POST http://localhost:3030/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/workspace/my-app",
    "name": "My Application",
    "authKey": "your-key-here"
  }'

# List workspaces
curl "http://localhost:3030/api/workspaces?authKey=your-key-here"

# Get workspace details
curl "http://localhost:3030/api/workspaces/%2Fworkspace%2Fmy-app?authKey=your-key-here"

# Update workspace
curl -X PUT http://localhost:3030/api/workspaces/%2Fworkspace%2Fmy-app \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Updated App",
    "authKey": "your-key-here"
  }'

# Delete workspace (after stopping all sessions)
curl -X DELETE "http://localhost:3030/api/workspaces/%2Fworkspace%2Fmy-app?authKey=your-key-here"
```

### Integration with Session API

Workspaces integrate with the existing Session API (`/api/sessions`). When creating sessions, specify the workspace path:

```bash
# Create session in specific workspace
curl -X POST http://localhost:3030/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "pty",
    "workspacePath": "/workspace/my-app",
    "authKey": "your-key-here"
  }'
```

The workspace's session counts and statistics will automatically update based on session activity.

## Integration Notes

### Session Integration

Sessions are associated with workspaces via the `workspacePath` field in `meta_json`:

```javascript
// Session meta_json structure
{
  "workspacePath": "/workspace/my-project",
  "cwd": "/workspace/my-project",
  "options": { ... }
}
```

**Querying sessions by workspace:**

```sql
SELECT * FROM sessions
WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = '/workspace/my-project';
```

### Architecture Components

- **WorkspaceRepository** (`src/lib/server/workspace/WorkspaceRepository.js`): Database operations
- **WorkspaceService** (`src/lib/client/shared/services/WorkspaceService.js`): Client-side API wrapper
- **WorkspaceState** (`src/lib/client/shared/state/WorkspaceState.svelte.js`): Reactive state management
- **DatabaseManager**: SQLite operations with event sourcing

### Status Derivation

Workspace status is computed dynamically based on session state and activity:

```javascript
if (sessionCounts.running > 0) {
	status = 'active';
} else if (workspace.lastActive) {
	const daysSinceActivity = (Date.now() - workspace.lastActive) / (1000 * 60 * 60 * 24);
	status = daysSinceActivity > 30 ? 'archived' : 'inactive';
} else {
	status = 'new';
}
```

### Real-time Updates

- Session creation/updates automatically trigger workspace activity updates
- Socket.IO `run:event` emissions notify clients of session state changes
- Multiple browser tabs stay synchronized via event sourcing

## Implementation Details

### Path Validation

Workspace paths are validated in the `+server.js` handlers:

```javascript
function isValidWorkspacePath(path) {
	if (!path || typeof path !== 'string') return false;

	// Block path traversal
	if (path.includes('..') || path.includes('~')) return false;

	// Limit length
	if (path.length > 500) return false;

	// Must be absolute
	if (!path.startsWith('/')) return false;

	return true;
}
```

### Name Derivation

If no name is provided, workspace name is derived from the path:

```javascript
function extractWorkspaceName(path) {
	if (!path) return 'Unnamed Workspace';
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || 'Root';
}
```

### Database Schema

**workspaces table:**

```sql
CREATE TABLE workspaces (
  path TEXT PRIMARY KEY,
  name TEXT,
  last_active INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  theme_override TEXT DEFAULT NULL
)
```

See [Database Schema Reference](./database-schema.md) for complete schema documentation.

## Rate Limiting

Currently no rate limiting is implemented. For production deployments, consider adding rate limiting middleware.

## Security Considerations

- **Path traversal prevention**: Rejects paths containing `..` or `~`
- **Path length limits**: Maximum 500 characters
- **Absolute paths only**: Must start with `/`
- **Active session checks**: Cannot delete workspaces with running sessions
- **Authentication required**: All endpoints require valid `TERMINAL_KEY`
- **No filesystem access**: Workspace API only manages database metadata (file operations handled separately)
