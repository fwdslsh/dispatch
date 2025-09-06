# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-30-session-naming/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Socket.IO Events

### Extended Events

#### create (Extended)

**Purpose:** Create new PTY session with optional custom name
**Parameters:**

```javascript
{
  mode: "claude" | "shell",
  cols: number,
  rows: number,
  meta: object,
  name?: string  // NEW: Optional custom session name
}
```

**Response:**

```javascript
{
  success: boolean,
  sessionId: string,
  name: string,     // Actual name used (custom or generated)
  error?: string
}
```

**Validation:**

- Name length: 1-50 characters if provided
- Allowed characters: alphanumeric, spaces, hyphens, underscores
- Duplicate names get incremental suffix

#### rename (New Event)

**Purpose:** Rename an existing session
**Parameters:**

```javascript
{
  sessionId: string,
  newName: string
}
```

**Response:**

```javascript
{
  success: boolean,
  sessionId: string,
  oldName: string,
  newName: string,
  error?: string
}
```

**Errors:**

- Session not found
- Invalid name format
- Name already in use
- Session is active (cannot rename while running)

### Broadcast Events

#### sessions-updated (Extended)

**Purpose:** Broadcast when session list changes including name updates
**Data:**

```javascript
{
  sessions: Array<{
    id: string,
    name: string,        // Always includes name
    mode: string,
    created: timestamp,
    active: boolean
  }>
}
```

## Error Handling

**Name Validation Errors:**

- `NAME_TOO_LONG`: Name exceeds 50 characters
- `NAME_TOO_SHORT`: Empty name provided
- `INVALID_CHARACTERS`: Contains forbidden characters
- `NAME_CONFLICT`: Name already exists (when uniqueness required)

**Session Management Errors:**

- `SESSION_NOT_FOUND`: Attempting to rename non-existent session
- `SESSION_ACTIVE`: Cannot rename session with running processes
- `SYMLINK_ERROR`: File system symlink creation failed
