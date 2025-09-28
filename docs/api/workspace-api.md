# Workspace Management API

The Workspace API provides REST endpoints for managing development workspaces in Dispatch. All endpoints require authentication via the `TERMINAL_KEY`.

## Authentication

All workspace endpoints require authentication using one of these methods:

1. **Query Parameter**: `?authKey=YOUR_TERMINAL_KEY`
2. **Authorization Header**: `Authorization: Bearer YOUR_TERMINAL_KEY`

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
  "status": "archived",
  "authKey": "YOUR_TERMINAL_KEY"
}
```

**Updatable Fields:**
- `name`: Workspace display name
- `status`: Workspace status (`new`, `active`, `archived`)

**Response:**
```json
{
  "id": "/workspace/my-project",
  "name": "Updated Project Name",
  "status": "archived",
  "updatedAt": "2024-01-15T15:30:00.000Z"
}
```

### Delete Workspace

**DELETE** `/api/workspaces/{workspaceId}?authKey=YOUR_TERMINAL_KEY`

Deletes a workspace and all associated sessions.

**Parameters:**
- `workspaceId` (string): URL-encoded workspace path
- `authKey` (query): Authentication key

**Validation:**
- Workspace cannot have active (running) sessions
- All stopped sessions in the workspace will be cleaned up

**Response:**
```json
{
  "message": "Workspace deleted successfully",
  "deletedSessions": 2
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

- **Session Management**: Workspace API integrates with existing `RunSessionManager`
- **Database**: Uses existing SQLite schema with `workspaces` and `sessions` tables
- **Authentication**: Follows same patterns as existing Session API
- **Real-time Updates**: Session counts update in real-time via Socket.IO events
- **Multi-client Sync**: Multiple browsers see consistent workspace state

## Rate Limiting

Currently no rate limiting is implemented. For production deployments, consider adding rate limiting middleware to prevent abuse.

## Security Considerations

- All paths are validated to prevent directory traversal attacks
- Workspace deletion requires explicit confirmation of no active sessions
- Authentication key must be provided for all operations
- Path sanitization prevents access to system directories outside workspace root