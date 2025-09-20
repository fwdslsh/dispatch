# Session Architecture

## Overview

The session architecture provides a clean abstraction layer that shields the application from session type details while keeping the implementation straightforward and extensible.

## Key Components

### 1. SessionManager (`src/lib/server/core/SessionManager.js`)

The central abstraction that provides a unified interface for all session operations:

- **Session Creation**: Single `createSession()` method for all types
- **Session Management**: Type-agnostic operations (stop, send, status)
- **Session Registry**: Extensible type registry for adding new session types
- **Unified IDs**: Application-managed IDs decouple frontend from backend implementations

### 2. Session Types

Currently supported session types:

- **`pty`**: Terminal/shell sessions via node-pty
- **`claude`**: Claude Code AI assistant sessions

New session types can be added by registering them in the `sessionTypes` object.

### 3. Socket.IO Setup

The socket setup (`socket-setup-simplified.js`) uses the SessionManager for all operations with clean routing logic.

## Usage

### Creating a Session

```javascript
// API endpoint or socket handler
const session = await sessionManager.createSession({
  type: 'pty',           // or 'claude'
  workspacePath: '/path/to/workspace',
  options: {
    // Type-specific options
    shell: '/bin/bash',
    env: { /* environment */ }
  }
});

// Returns:
{
  id: 'uuid-v4',         // Unified session ID
  type: 'pty',
  typeSpecificId: 'pty_1', // Internal ID used by terminal manager
  workspacePath: '/path/to/workspace'
}
```

### Sending Input to a Session

```javascript
// Works for any session type
await sessionManager.sendToSession(sessionId, inputData);
```

### Session Operations

```javascript
// Resize a terminal (type-specific operation)
await sessionManager.sessionOperation(sessionId, 'resize', {
	cols: 80,
	rows: 24
});
```

### Stopping a Session

```javascript
await sessionManager.stopSession(sessionId);
```

## Benefits of the Architecture

1. **Single Interface**: One `SessionManager` handles all session types
2. **Type Abstraction**: Application code doesn't need to know about session type details
3. **Easy Extension**: New session types can be added by registering them
4. **Unified IDs**: Consistent ID management across all session types
5. **Clean Socket.IO**: Event handling without complex routing

## Architecture Design Principles

- Single SessionManager interface for all session operations
- Type-specific logic encapsulated in registry
- Unified session IDs throughout the application
- Clean separation of concerns between session types

## Adding New Session Types

To add a new session type:

1. Create the type-specific manager (e.g., `DockerSessionManager`)
2. Register it in SessionManager's constructor:

```javascript
this.sessionTypes = {
	// ... existing types
	docker: {
		manager: this.docker,
		createMethod: 'startContainer',
		stopMethod: 'stopContainer',
		getIdField: (result) => result.containerId
	}
};
```

3. The new type is now available through the unified interface

## Frontend Session Management

### Session Creation Workflow

The simplified session creation follows these principles:

1. **Type Selection First**: User selects session type (pty/claude)
2. **Workspace Selection**: User selects or creates a workspace directory
3. **Optional Configuration**: Session types can provide additional options
4. **Single API Call**: Frontend calls `/api/sessions` with type and workspace

#### Simplified UI Flow

```javascript
// Simple session creation
const session = await fetch('/api/sessions', {
  method: 'POST',
  body: JSON.stringify({
    type: 'pty',        // or 'claude'
    workspacePath: '/path/to/workspace',
    options: {}         // Type-specific options
  })
});

// Returns unified session object
{
  id: 'uuid-v4',
  type: 'pty',
  typeSpecificId: 'pty_1',
  workspacePath: '/path/to/workspace'
}
```

### ProjectSessionMenu Simplification

The ProjectSessionMenu component should focus on:

1. **Active Sessions Tab**: Primary view showing all active workspace sessions
2. **Session Type Toggle**: Switch between claude/pty session types
3. **Quick Create**: Simple button to create new session of selected type

#### Simplified Component Structure

```svelte
<script>
	// Simplified state
	let sessionType = $state('claude');
	let activeSessions = $state([]);
	let selectedWorkspace = $state(null);

	// Load active sessions for current type
	async function loadActiveSessions() {
		const response = await fetch('/api/sessions');
		const data = await response.json();

		activeSessions = data.sessions
			.filter((s) => s.isActive && s.type === sessionType)
			.map((session) => ({
				id: session.id,
				type: session.type,
				workspacePath: session.workspacePath,
				title: session.title || `${session.type} Session`
			}));
	}

	// Simple session creation
	async function createSession() {
		const response = await fetch('/api/sessions', {
			method: 'POST',
			body: JSON.stringify({
				type: sessionType,
				workspacePath: selectedWorkspace || '/workspace/default'
			})
		});

		const session = await response.json();
		activeSessions = [...activeSessions, session];
		selectSession(session);
	}
</script>
```

### Session State Management

Frontend maintains minimal session state:

```javascript
// Session object structure
{
  id: string,           // Unified session ID
  type: string,         // Session type (pty/claude)
  workspacePath: string,// Workspace directory
  isActive: boolean,    // Connection status
  title?: string        // Display name
}
```

### Socket.IO Integration

Simplified socket events use unified session IDs:

```javascript
// Start session
socket.emit('session.start', {
	id: sessionId,
	key: authKey
});

// Send input (type-agnostic)
socket.emit('session.input', {
	id: sessionId,
	data: inputData
});

// Receive output
socket.on('session.output', ({ id, data }) => {
	// Handle output for any session type
});
```

## Testing

Run tests:

```bash
npm test
```

## Future Enhancements

Potential improvements for production:

1. **Session Persistence**: Save/restore session state across restarts
2. **Session Templates**: Predefined configurations for common use cases
3. **Session Sharing**: Multi-user access to sessions
4. **Session Recording**: Capture and replay session activity
5. **Plugin Architecture**: Dynamic loading of session type modules
