# Dispatch Architecture Documentation

This document provides a comprehensive overview of Dispatch's event-sourced, adapter-based architecture for contributors and maintainers.

## Overview

Dispatch is built on modern architectural patterns that prioritize:

- **Event Sourcing**: All state changes captured as immutable events
- **Adapter Pattern**: Pluggable session types with unified interface
- **Real-time Sync**: Multi-client synchronization via Socket.IO
- **Container Isolation**: Security through process and filesystem isolation

## Core Architecture

### 1. RunSessionManager - Central Orchestrator

`src/lib/server/runtime/RunSessionManager.js`

The RunSessionManager is the heart of Dispatch's architecture, implementing event sourcing and adapter coordination:

```javascript
class RunSessionManager {
	constructor() {
		this.adapters = new Map(); // Registered session adapters
		this.activeSessions = new Map(); // Currently running sessions
		this.eventStore = new EventStore(); // Event persistence
		this.socketManager = socketManager; // Real-time communication
	}

	// Core session lifecycle
	async createSession(runId, adapterName, options) {
		const adapter = this.adapters.get(adapterName);
		const session = await adapter.create(runId, options);

		// Event sourcing: record session creation
		await this.recordEvent(runId, 'session:created', {
			adapterName,
			options,
			timestamp: Date.now()
		});

		return session;
	}

	// Event sourcing with real-time emission
	async recordEvent(runId, type, payload) {
		const event = {
			runId,
			type,
			payload,
			sequence: await this.getNextSequence(runId),
			timestamp: Date.now()
		};

		// Persist to database
		await this.eventStore.append(runId, event);

		// Real-time broadcast to connected clients
		this.socketManager.emitToSession(runId, 'run:event', event);
	}
}
```

### 2. Adapter Pattern - Session Type Abstraction

Each session type implements a common adapter interface, enabling polymorphic session management:

#### Base Adapter Interface

```javascript
class SessionAdapter {
	constructor(runSessionManager) {
		this.runSessionManager = runSessionManager;
	}

	// Required methods for all adapters
	async create(runId, options) {
		throw new Error('Not implemented');
	}
	async destroy(runId) {
		throw new Error('Not implemented');
	}
	async handleInput(runId, input) {
		throw new Error('Not implemented');
	}
	async getState(runId) {
		throw new Error('Not implemented');
	}
}
```

#### Terminal Adapter

`src/lib/server/terminal/PtyAdapter.js`

```javascript
class PtyAdapter extends SessionAdapter {
	constructor(runSessionManager) {
		super(runSessionManager);
		this.terminals = new Map(); // runId -> pty instance
	}

	async create(runId, options) {
		const pty = spawn(options.shell || 'bash', [], {
			name: 'xterm-color',
			cols: options.cols || 80,
			rows: options.rows || 24,
			cwd: options.workspacePath
		});

		// Forward pty output as events
		pty.onData((data) => {
			this.runSessionManager.recordEvent(runId, 'pty:output', { data });
		});

		this.terminals.set(runId, pty);
		return { status: 'created' };
	}

	async handleInput(runId, input) {
		const pty = this.terminals.get(runId);
		if (pty) {
			pty.write(input);
			// Record input for replay capability
			await this.runSessionManager.recordEvent(runId, 'pty:input', { input });
		}
	}
}
```

#### Claude Adapter

`src/lib/server/claude/ClaudeAdapter.js`

```javascript
class ClaudeAdapter extends SessionAdapter {
	constructor(runSessionManager) {
		super(runSessionManager);
		this.claudeInstances = new Map(); // runId -> claude instance
	}

	async create(runId, options) {
		const claude = new ClaudeCode({
			workspaceRoot: options.workspacePath,
			apiKey: process.env.ANTHROPIC_API_KEY
		});

		// Forward Claude events as Dispatch events
		claude.on('output', (output) => {
			this.runSessionManager.recordEvent(runId, 'claude:output', { output });
		});

		this.claudeInstances.set(runId, claude);
		return { status: 'created' };
	}

	async handleInput(runId, input) {
		const claude = this.claudeInstances.get(runId);
		if (claude) {
			await claude.sendMessage(input);
			await this.runSessionManager.recordEvent(runId, 'claude:input', { input });
		}
	}
}
```

### 3. Event Sourcing Implementation

#### Event Storage Schema

```sql
CREATE TABLE session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  runId TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,    -- JSON payload
  timestamp INTEGER NOT NULL,
  UNIQUE(runId, sequence)
);
```

#### Event Replay System

```javascript
class EventStore {
	async getEventHistory(runId, fromSequence = 0) {
		const events = await this.db.all(
			`
      SELECT * FROM session_events
      WHERE runId = ? AND sequence >= ?
      ORDER BY sequence ASC
    `,
			[runId, fromSequence]
		);

		return events.map((event) => ({
			...event,
			payload: JSON.parse(event.payload)
		}));
	}

	async replaySession(runId, fromSequence = 0) {
		const events = await this.getEventHistory(runId, fromSequence);

		// Replay events to rebuild session state
		for (const event of events) {
			await this.applyEvent(event);
		}

		return events;
	}
}
```

### 4. Socket.IO Communication Protocol

#### Client-Server Event Flow

```javascript
// Client attachment with replay capability
socket.emit('run:attach', {
	runId: 'session_123',
	fromSequence: 42 // Resume from specific point
});

// Server replays missed events
const events = await eventStore.getEventHistory(runId, fromSequence);
for (const event of events) {
	socket.emit('run:event', event);
}

// Real-time event forwarding
runSessionManager.on('event', (event) => {
	socket.to(`session_${event.runId}`).emit('run:event', event);
});
```

#### Multi-Client Synchronization

```javascript
// Multiple clients can attach to same session
socket.on('run:attach', async ({ runId, fromSequence }) => {
	// Join Socket.IO room for real-time updates
	socket.join(`session_${runId}`);

	// Replay events to sync client state
	const events = await eventStore.getEventHistory(runId, fromSequence);
	events.forEach((event) => socket.emit('run:event', event));

	// Client is now synchronized and will receive real-time updates
});
```

## Frontend Architecture (Svelte 5 MVVM)

### 1. Service Container Pattern

`src/lib/client/shared/services/ServiceContainer.svelte.js`

```javascript
class ServiceContainer {
	constructor() {
		this.services = new Map();
		this.factories = new Map();
	}

	register(name, factory) {
		this.factories.set(name, factory);
	}

	get(name) {
		if (!this.services.has(name)) {
			const factory = this.factories.get(name);
			if (!factory) throw new Error(`Service ${name} not registered`);
			this.services.set(name, factory());
		}
		return this.services.get(name);
	}
}

// Global container instance
export const container = new ServiceContainer();
```

### 2. MVVM with Svelte 5 Runes

#### ViewModel Layer

`src/lib/client/shared/state/SessionViewModel.svelte.js`

```javascript
export class SessionViewModel {
	// Reactive state with $state runes
	sessions = $state([]);
	currentSession = $state(null);
	loading = $state(false);
	error = $state(null);

	// Derived state
	activeSessions = $derived.by(() => this.sessions.filter((s) => s.status === 'running'));

	// Business logic methods
	async createSession(type, options) {
		this.loading = true;
		try {
			const sessionService = container.get('sessionService');
			const session = await sessionService.create(type, options);
			this.sessions.push(session);
			this.currentSession = session;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.loading = false;
		}
	}

	async attachToSession(runId, fromSequence = 0) {
		const socketService = container.get('socketService');
		await socketService.attachToSession(runId, fromSequence);
	}
}
```

#### Service Layer

`src/lib/client/shared/services/RunSessionClient.js`

```javascript
export class RunSessionClient {
	constructor(socketService) {
		this.socket = socketService.socket;
		this.eventHandlers = new Map();
	}

	async attachToSession(runId, fromSequence = 0) {
		return new Promise((resolve) => {
			this.socket.emit('run:attach', { runId, fromSequence });

			// Handle incoming events
			this.socket.on('run:event', (event) => {
				const handler = this.eventHandlers.get(event.type);
				if (handler) handler(event);
			});

			resolve();
		});
	}

	registerEventHandler(eventType, handler) {
		this.eventHandlers.set(eventType, handler);
	}

	sendInput(runId, input) {
		this.socket.emit('run:input', { runId, input });
	}
}
```

### 3. Component Integration

```svelte
<!-- Terminal.svelte -->
<script>
	import { container } from '$lib/client/shared/services/ServiceContainer.svelte.js';

	const sessionViewModel = container.get('sessionViewModel');
	const terminalService = container.get('terminalService');

	let { runId } = $props();

	// Reactive data from ViewModel
	const { sessions, currentSession } = sessionViewModel;

	// Event handling
	terminalService.registerEventHandler('pty:output', (event) => {
		// Update terminal display
		terminalElement.write(event.payload.data);
	});

	$effect(() => {
		if (runId) {
			sessionViewModel.attachToSession(runId);
		}
	});
</script>

<div class="terminal-container" bind:this={terminalElement}></div>
```

## Database Schema

### Core Tables

```sql
-- Session management
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  runId TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,           -- pty, claude, file-editor
  status TEXT NOT NULL,         -- starting, running, stopped, error
  workspacePath TEXT,
  metadata TEXT,                -- JSON session options
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Event sourcing
CREATE TABLE session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  runId TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON event data
  timestamp INTEGER NOT NULL,
  UNIQUE(runId, sequence),
  FOREIGN KEY (runId) REFERENCES sessions(runId)
);

-- Workspace management
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,          -- Workspace path
  name TEXT NOT NULL,
  status TEXT DEFAULT 'new',    -- new, active, archived
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  lastActive TEXT
);

-- UI state persistence
CREATE TABLE workspace_layout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clientId TEXT NOT NULL,
  workspacePath TEXT NOT NULL,
  layout TEXT NOT NULL,         -- JSON layout data
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspacePath) REFERENCES workspaces(id)
);
```

### Performance Considerations

**Indexing Strategy**:

```sql
-- Event replay performance
CREATE INDEX idx_session_events_runid_sequence ON session_events(runId, sequence);

-- Session lookups
CREATE INDEX idx_sessions_workspace ON sessions(workspacePath);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Workspace queries
CREATE INDEX idx_workspaces_status ON workspaces(status);
```

**Event Retention**: Consider implementing retention policies for large event histories:

```sql
-- Clean up old events (example: keep last 30 days)
DELETE FROM session_events
WHERE timestamp < strftime('%s', 'now', '-30 days') * 1000;
```

## Security Architecture

### 1. Container Isolation

```dockerfile
# Multi-stage build for minimal attack surface
FROM node:22-alpine AS runtime

# Non-root user
RUN addgroup -g 10001 appuser && \
    adduser -D -u 10001 -G appuser appuser

# Runtime user mapping
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

```bash
# entrypoint.sh - Runtime user mapping
#!/bin/bash
if [ -n "$HOST_UID" ] && [ -n "$HOST_GID" ]; then
    # Map container user to host user for file permissions
    gosu $HOST_UID:$HOST_GID "$@"
else
    exec "$@"
fi
```

### 2. Path Validation

```javascript
// Secure path validation
function validateWorkspacePath(path) {
	// Must be absolute
	if (!path.startsWith('/')) {
		throw new Error('Workspace path must be absolute');
	}

	// Prevent directory traversal
	const normalized = path.normalize(path);
	if (normalized.includes('..')) {
		throw new Error('Path traversal not allowed');
	}

	// Must be within workspace root
	const workspaceRoot = process.env.WORKSPACES_ROOT || '/workspace';
	if (!normalized.startsWith(workspaceRoot)) {
		throw new Error(`Path must be within ${workspaceRoot}`);
	}

	return normalized;
}
```

### 3. Authentication

```javascript
// Key-based authentication
export function validateKey(providedKey) {
	const validKey = process.env.TERMINAL_KEY;
	if (!validKey || validKey === 'change-me-to-a-strong-password') {
		throw new Error('TERMINAL_KEY must be configured in production');
	}
	return providedKey === validKey;
}

// Middleware integration
export async function requireAuth({ request, url }) {
	const authKey =
		url.searchParams.get('authKey') || request.headers.get('authorization')?.replace('Bearer ', '');

	if (!authKey || !validateKey(authKey)) {
		throw error(401, 'Authentication required');
	}
}
```

## Performance Characteristics

### Event Replay Performance

**Constitutional Requirement**: Event replay must complete in <100ms

**Optimization Strategies**:

1. **Indexed Queries**: Events indexed by (runId, sequence)
2. **Efficient Serialization**: JSON payloads stored as TEXT for SQLite efficiency
3. **Batch Processing**: Multiple events sent in single Socket.IO message
4. **Memory Management**: Large histories paginated to prevent memory issues

**Benchmark Results** (from performance tests):

- 1K events: ~15ms replay time
- 10K events: ~45ms replay time
- 100K events: ~85ms replay time (within constitutional limit)

### Real-time Communication

**Socket.IO Optimization**:

- Connection pooling for multiple tabs
- Event batching to reduce message frequency
- Selective event forwarding based on client subscriptions

**WebSocket Frame Efficiency**:

```javascript
// Efficient event batching
const eventBatch = [];
const batchTimer = setInterval(() => {
	if (eventBatch.length > 0) {
		socket.emit('run:event:batch', eventBatch);
		eventBatch.length = 0;
	}
}, 16); // ~60fps update rate
```

## Monitoring & Debugging

### Admin Console

Access at `/console?key=your-terminal-key`:

- Live session monitoring
- Event stream visualization
- Performance metrics
- Database query interface

### Debug Logging

```bash
# Enable comprehensive debugging
DEBUG=* npm run dev

# Specific subsystems
DEBUG=socket.io:* npm run dev
DEBUG=session:* npm run dev
DEBUG=database:* npm run dev
```

### Health Checks

```javascript
// Health check endpoint
export async function GET({ locals }) {
	const db = locals.services.database;

	const health = {
		status: 'healthy',
		timestamp: Date.now(),
		checks: {
			database: await checkDatabase(db),
			sessions: await checkActiveSessions(),
			memory: process.memoryUsage(),
			uptime: process.uptime()
		}
	};

	return json(health);
}
```

## Extension Points

### Adding New Session Types

1. **Create Adapter**: Implement SessionAdapter interface
2. **Register Adapter**: Add to RunSessionManager
3. **Frontend Components**: Create UI components for session type
4. **Session Module**: Register in session modules system

### Custom Event Types

```javascript
// Custom adapter with domain-specific events
class DatabaseAdapter extends SessionAdapter {
	async executeQuery(runId, query) {
		const result = await this.db.query(query);

		// Custom event type
		await this.runSessionManager.recordEvent(runId, 'db:query:result', {
			query,
			result,
			executionTime: result.duration
		});
	}
}
```

### Middleware Integration

```javascript
// Custom middleware for session lifecycle
runSessionManager.addMiddleware('before:create', async (runId, options) => {
	// Custom validation, logging, etc.
	console.log(`Creating session ${runId} with options:`, options);
});

runSessionManager.addMiddleware('after:event', async (event) => {
	// Custom event processing
	await analyticsService.recordEvent(event);
});
```

This architecture provides a robust foundation for multi-session, real-time development environments while maintaining security, performance, and extensibility.
