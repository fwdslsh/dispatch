# Unified Session Architecture Documentation

## Overview

The Dispatch application now uses a unified session architecture based on event-sourced run sessions. This document describes the current implementation and API patterns.

## Core Concepts

### Session Types

1. **Browser Session**: HTTP authentication session (handled by SvelteKit)
2. **Client Session**: Socket.IO connection with stable `clientId` (stored in localStorage)
3. **Run Session**: Long-lived server process with `runId` and event-sourced history

### Run Session Kinds

- **`pty`**: Terminal/shell sessions using node-pty
- **`claude`**: AI assistant sessions using Claude Code SDK

## Socket.IO API

### Connection & Authentication

```javascript
// Client connects and authenticates
socket.emit('auth', authKey, (response) => {
	if (response.success) {
		// Authentication successful
	}
});
```

### Client Identification

```javascript
// Identify client for multi-device support
socket.emit('client:hello', { clientId: getClientId() });
```

### Run Session Operations

#### Attach to Run Session

```javascript
socket.emit('run:attach', { runId, afterSeq: 0 }, (backlog) => {
	// Receive event backlog for session resume
	backlog.forEach((event) => handleEvent(event));
});

// Listen for real-time events
socket.on('run:event', (event) => {
	// Handle event: { runId, seq, channel, type, payload, ts }
});
```

#### Send Input to Session

```javascript
socket.emit('run:input', { runId, data: 'ls -la\\n' });
```

#### Resize Terminal Session

```javascript
socket.emit('run:resize', { runId, cols: 80, rows: 24 });
```

#### Close Session

```javascript
socket.emit('run:close', { runId });
```

## Event Channels

Events are categorized by channel to enable proper handling:

### PTY Sessions

- **`pty:stdout`**: Terminal output data
- **`pty:stderr`**: Terminal error output
- **`pty:resize`**: Terminal dimension changes
- **`pty:exit`**: Terminal process exit

### Claude Sessions

- **`claude:message`**: AI assistant messages
- **`claude:delta`**: Streaming message deltas
- **`claude:result`**: Final result/completion
- **`claude:auth_url`**: OAuth authentication URL
- **`claude:auth_complete`**: Authentication completion
- **`claude:auth_error`**: Authentication error

### System Events

- **`system:status`**: Session status changes
- **`system:error`**: System-level errors

## Client Implementation

### RunSessionClient

The unified client provides a consistent interface:

```javascript
import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';

// Authenticate
await runSessionClient.authenticate(authKey);

// Create session
const { runId } = await runSessionClient.createRunSession('pty', '/workspace', {
	shell: '/bin/bash',
	cols: 80,
	rows: 24
});

// Attach and handle events
await runSessionClient.attachToRunSession(runId, (event) => {
	if (event.channel === 'pty:stdout') {
		terminal.write(event.payload);
	}
});

// Send input
runSessionClient.sendInput(runId, 'echo "Hello World"\\n');

// Resize terminal
runSessionClient.resizeTerminal(runId, 120, 30);

// Detach when done
runSessionClient.detachFromRunSession(runId);
```

## Database Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  run_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- 'pty' | 'claude'
  status TEXT NOT NULL,            -- 'starting'|'running'|'stopped'|'error'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  meta_json TEXT NOT NULL          -- Session configuration
);
```

### Session Events Table

```sql
CREATE TABLE session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,            -- Monotonic sequence per run_id
  channel TEXT NOT NULL,           -- Event channel
  type TEXT NOT NULL,              -- Event type
  payload BLOB NOT NULL,           -- Event data
  ts INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES sessions(run_id)
);
```

### Workspace Layout Table

```sql
CREATE TABLE workspace_layout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  client_id TEXT NOT NULL,         -- Device-specific layout
  tile_id TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(run_id, client_id)
);
```

## Benefits

1. **Stateless UI Recovery**: All UI state can be rebuilt from (runId, seq) cursor
2. **Multi-Client Support**: Multiple tabs can attach to same runId with synchronized events
3. **Reliable Resume**: After disconnect, clients request events since last seen sequence
4. **Extensible Event Types**: Easy to add new channels without changing core architecture
5. **Simplified Testing**: Event-driven architecture with clear input/output
6. **Better Observability**: All session activity logged in queryable event stream

## Migration Notes

### Deprecated Patterns

The following patterns are no longer used:

- `socket.emit('terminal.start')` → Use `runSessionClient.createRunSession('pty', ...)`
- `socket.emit('terminal.write')` → Use `runSessionClient.sendInput(runId, data)`
- `socket.emit('claude.send')` → Use `runSessionClient.sendInput(runId, data)`
- `socket.on('terminal.output')` → Use `run:event` with `channel: 'pty:stdout'`
- `socket.on('claude.message.delta')` → Use `run:event` with `channel: 'claude:message'`

### Component Updates

All Svelte components now use `RunSessionClient` exclusively:

- `TerminalPane.svelte` - Uses unified run session events
- `ClaudePane.svelte` - Uses unified run session events
- No direct socket.io imports in components

## Testing

Tests should use the unified event patterns:

```javascript
// Create run session
const { runId } = await runSessionManager.createRunSession({
	kind: 'pty',
	meta: { cwd: '/test', shell: '/bin/sh' }
});

// Test event emission
const events = [];
await runSessionManager.attachToRunSession(runId, (event) => {
	events.push(event);
});

// Send input and verify output
await runSessionManager.sendInput(runId, 'echo test\\n');
expect(events).toContain(
	expect.objectContaining({
		channel: 'pty:stdout',
		payload: expect.stringContaining('test')
	})
);
```
