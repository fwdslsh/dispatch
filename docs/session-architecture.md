# Session Architecture - Simplified Approach

## Overview

The simplified session architecture provides a clean abstraction layer that shields the application from session type details while keeping the implementation straightforward for a POC application.

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

### 3. Simplified Socket.IO Setup

The simplified socket setup (`socket-setup-simplified.js`) uses the SessionManager for all operations, removing the need for complex routing logic.

## Usage

### Enabling Simplified Architecture

Set the environment variable to use the simplified implementation:

```bash
USE_SIMPLIFIED_SESSIONS=true npm run dev
```

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

## Benefits of Simplified Architecture

1. **Single Interface**: One `SessionManager` handles all session types
2. **Type Abstraction**: Application code doesn't need to know about session type details
3. **Easy Extension**: New session types can be added by registering them
4. **Unified IDs**: Consistent ID management across all session types
5. **Simplified Socket.IO**: Cleaner event handling without complex routing

## Comparison with Original Architecture

### Original Approach

- Direct interaction with TerminalManager and ClaudeSessionManager
- Complex routing logic in socket-setup.js
- Session type awareness throughout the codebase
- Multiple ID formats and conversions

### Simplified Approach

- Single SessionManager interface
- Type-specific logic encapsulated in registry
- Unified session IDs throughout
- Clean separation of concerns

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

## Migration Path

The architecture supports gradual migration:

1. Both implementations coexist (controlled by `USE_SIMPLIFIED_SESSIONS`)
2. API endpoints can use SessionManager while maintaining backward compatibility
3. Frontend remains unchanged (uses unified session IDs)
4. Can switch between implementations for testing

## Code Changes Required

### 1. Update Socket Manager Default (`src/lib/server/socket-manager.js`)

Change the default to use simplified sessions:

```javascript
// Change from:
const USE_SIMPLIFIED = process.env.USE_SIMPLIFIED_SESSIONS === 'true';

// To:
const USE_SIMPLIFIED = process.env.USE_SIMPLIFIED_SESSIONS !== 'false';
```

This makes simplified the default, requiring `USE_SIMPLIFIED_SESSIONS=false` to use original.

### 2. Update Package.json Scripts

Add convenience scripts for testing both modes:

```json
{
	"scripts": {
		"dev:original": "USE_SIMPLIFIED_SESSIONS=false npm run dev",
		"dev:simplified": "npm run dev", // Default is simplified
		"test:original": "USE_SIMPLIFIED_SESSIONS=false npm test",
		"test:simplified": "npm test" // Default is simplified
	}
}
```

### 3. Ensure API Endpoints Use SessionManager

The `/api/sessions` endpoint already supports SessionManager. Verify other endpoints:

- `POST /api/sessions` - ✓ Already uses SessionManager with fallback
- `DELETE /api/sessions` - ✓ Already uses SessionManager with fallback
- WebSocket handlers - ✓ Already use SessionManager in simplified mode

### 4. Update Development Server Messages

Add clear messaging about which architecture is in use:

- `src/app.js` - ✓ Already logs mode
- `vite.config.js` - ✓ Already logs mode
- Add to startup banner for clarity

### 5. Documentation Updates

Update README and other docs to reflect simplified as default:

- Default behavior is simplified sessions
- Original can be enabled with `USE_SIMPLIFIED_SESSIONS=false`
- All examples use simplified by default

## Testing

Run tests with simplified architecture (default):

```bash
npm test
```

Run tests with original architecture:

```bash
USE_SIMPLIFIED_SESSIONS=false npm test
```

Compare both implementations:

```bash
# Test simplified (default)
npm run test:simplified

# Test original
npm run test:original
```

## Future Enhancements

Potential improvements for production:

1. **Session Persistence**: Save/restore session state across restarts
2. **Session Templates**: Predefined configurations for common use cases
3. **Session Sharing**: Multi-user access to sessions
4. **Session Recording**: Capture and replay session activity
5. **Plugin Architecture**: Dynamic loading of session type modules
