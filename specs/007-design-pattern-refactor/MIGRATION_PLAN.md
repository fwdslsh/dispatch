# Migration Plan: Clean Architecture Replacement

**Task**: T024 - Replace RunSessionManager with simplified architecture
**Status**: PLANNING
**Complexity**: HIGH
**Estimated Time**: 8-10 hours

## Executive Summary

This document provides a **clean replacement strategy** that eliminates RunSessionManager and integrates the new simplified architecture WITHOUT any compatibility shims, legacy wrappers, or technical debt.

### Core Principle: No Technical Debt

**Approach**: Direct code updates with clean abstractions

- ✅ **No compatibility layers** - Update code directly to new patterns
- ✅ **No legacy wrappers** - Adapters use clean, simple interface
- ✅ **Preserve good patterns** - Event buffering, sequence management from RunSessionManager
- ✅ **Extensible design** - Easy to add new session types

---

## Design Goals (Aligned with Spec)

### 1. Easy Session Type Development

Adding a new session type should require:

1. **Create Adapter** (`src/lib/server/[feature]/[Type]Adapter.js`)
2. **Register Adapter** (one line in `services.js`)
3. **Create UI Components** (`src/lib/client/[feature]/`)
4. **Register Module** (one line in `session-modules/index.js`)

**That's it.** No changes to core infrastructure.

### 2. Clean Adapter Interface

```javascript
/**
 * Standard adapter interface - ALL adapters implement this
 */
export class Adapter {
  /**
   * Create session process with event callback
   * @param {Object} options - Session-specific options
   * @param {Function} options.onEvent - Event emitter: onEvent({ channel, type, payload })
   * @returns {Promise<ProcessHandle>} Process handle
   */
  async create(options) {
    // Implementation specific to session type
  }
}

/**
 * Standard process handle - returned by all adapters
 */
interface ProcessHandle {
  input?: { write: (data: string) => void };  // Optional: stdin for input
  resize?: (cols: number, rows: number) => void;  // Optional: terminal resize
  close: () => void;  // Required: cleanup
  [customMethod]: any;  // Optional: adapter-specific methods
}
```

**Key Properties**:

- Single method: `create(options)`
- Events via callback: `onEvent({ channel, type, payload })`
- Process handle has standard shape + optional extensions
- No inheritance required, just duck typing

### 3. Preserve Proven Patterns from RunSessionManager

These patterns are **excellent** and must be preserved:

1. **Event Buffering During Initialization** (RunSessionManager.js:40-95)
   - Buffer events while adapter is initializing
   - Flush all buffered events after initialization
   - Prevents race conditions with sequence numbers

2. **Event Queue Serialization** (RunSessionManager.js:72-77)
   - Serial execution of async event recording
   - Prevents concurrent database writes
   - Maintains event ordering

3. **Atomic Sequence Number Management** (RunSessionManager.js:154)
   - In-memory counter for live sessions
   - Atomic increment ensures uniqueness
   - Falls back to database query for stopped sessions

4. **Session Resume Logic** (RunSessionManager.js:323-435)
   - Recreate process with same sessionId
   - Replay recent events for context
   - Handle adapter creation failures gracefully

**These patterns will be integrated into SessionOrchestrator, not discarded.**

---

## Architecture Analysis: What to Keep vs Replace

### Keep from Current Architecture ✅

**RunSessionManager patterns to preserve**:

- Event buffering during init
- Event queue serialization
- Sequence number atomicity
- Resume logic with event replay
- Adapter registration pattern
- `onEvent` callback interface

**Adapter interface to keep**:

- `adapter.create({ ...options, onEvent })` pattern
- Process handle with `input.write()` and `close()`
- Optional methods (resize, clear, etc.)

### Replace with New Architecture ✅

**Separate concerns into**:

- SessionOrchestrator - Session lifecycle coordination
- EventRecorder - Event persistence + pub/sub (with buffering logic)
- EventStore - Append-only event log
- SessionRepository - Session metadata CRUD
- AdapterRegistry - Adapter registration

**Eliminate**:

- Direct database access from RunSessionManager
- Direct Socket.IO access from session manager
- Monolithic 470-line class with too many responsibilities

---

## Critical Design Decisions

### Decision 1: SessionOrchestrator Adopts RunSessionManager's Adapter Pattern

**Current RunSessionManager** (GOOD):

```javascript
const proc = await adapter.create({
	...meta,
	onEvent: (ev) => {
		// Buffer events during initialization
		if (liveRun?.initializing) {
			eventBuffer.push(ev);
		} else {
			this.recordAndEmit(runId, ev);
		}
	}
});
```

**New SessionOrchestrator** (UPDATED to match):

```javascript
const process = await adapter.create({
	...options,
	onEvent: (ev) => {
		// Delegate to EventRecorder (which handles buffering)
		this.#eventRecorder.recordEvent(sessionId, ev);
	}
});
```

**Why**: Current pattern is clean, proven, and easy for adapter developers. Don't break it.

### Decision 2: EventRecorder Handles Buffering + Serialization

Move buffering logic from RunSessionManager into EventRecorder:

```javascript
export class EventRecorder {
	#eventStore;
	#emitter;
	#buffers = new Map(); // sessionId -> { initializing, eventBuffer, eventQueue }

	/**
	 * Start buffering events for a session during initialization
	 */
	startBuffering(sessionId) {
		this.#buffers.set(sessionId, {
			initializing: true,
			eventBuffer: [],
			eventQueue: Promise.resolve()
		});
	}

	/**
	 * Flush buffered events and switch to live mode
	 */
	async flushBuffer(sessionId) {
		const buffer = this.#buffers.get(sessionId);
		for (const event of buffer.eventBuffer) {
			await this.recordEvent(sessionId, event);
		}
		buffer.initializing = false;
		buffer.eventBuffer = [];
	}

	/**
	 * Record event with buffering + serialization
	 */
	async recordEvent(sessionId, event) {
		const buffer = this.#buffers.get(sessionId);

		if (!buffer) {
			// Not live - just record directly
			return await this.#eventStore.append(sessionId, event.channel, event.type, event.payload);
		}

		if (buffer.initializing) {
			// Buffer during initialization
			buffer.eventBuffer.push(event);
			return;
		}

		// Serialize async operations
		buffer.eventQueue = buffer.eventQueue.then(async () => {
			const row = await this.#eventStore.append(
				sessionId,
				event.channel,
				event.type,
				event.payload
			);
			this.#emitter.emit('event', { sessionId, ...row });
			return row;
		});

		return buffer.eventQueue;
	}
}
```

**Why**: Separates concerns while preserving proven buffering/serialization logic.

### Decision 3: Sequence Numbers Stay in EventStore

EventStore manages sequence numbers with atomic in-memory counter:

```javascript
export class EventStore {
	#db;
	#sequences = new Map(); // sessionId -> nextSeq

	async append(sessionId, channel, type, payload) {
		// Get or initialize sequence counter
		if (!this.#sequences.has(sessionId)) {
			const lastSeq = await this.#db.getMaxSequence(sessionId);
			this.#sequences.set(sessionId, lastSeq + 1);
		}

		// Atomic increment
		const seq = this.#sequences.get(sessionId);
		this.#sequences.set(sessionId, seq + 1);

		// Persist to database
		return await this.#db.appendSessionEvent(sessionId, seq, channel, type, payload);
	}

	clearSequence(sessionId) {
		this.#sequences.delete(sessionId);
	}
}
```

**Why**: Maintains atomic sequence numbering from RunSessionManager, prevents conflicts.

---

## Implementation Plan (Clean Replacement)

### Phase 1: Update Core Components (3-4 hours)

#### Step 1.1: Enhance EventRecorder with Buffering Logic

**File**: `src/lib/server/sessions/EventRecorder.js`

**Add**:

- `#buffers` Map for session buffering state
- `startBuffering(sessionId)` method
- `flushBuffer(sessionId)` method
- `recordEvent(sessionId, event)` with buffering + serialization
- `getEvents(sessionId, fromSeq)` method (expose EventStore access)
- `clearBuffer(sessionId)` for cleanup

**Result**: EventRecorder now handles all event buffering/serialization logic that was in RunSessionManager.

#### Step 1.2: Enhance EventStore with Sequence Management

**File**: `src/lib/server/database/EventStore.js`

**Add**:

- `#sequences` Map for atomic sequence counters
- Update `append()` to use in-memory counter
- `clearSequence(sessionId)` for cleanup on session close

**Result**: EventStore maintains sequence number atomicity like RunSessionManager.

#### Step 1.3: Update SessionOrchestrator to Use RunSessionManager Patterns

**File**: `src/lib/server/sessions/SessionOrchestrator.js`

**Changes**:

1. **createSession() method** - Add event buffering:

```javascript
async createSession(kind, options) {
  const { workspacePath, metadata = {}, ownerUserId = null } = options;

  // Create session metadata
  const session = await this.#sessionRepository.create({
    kind, workspacePath, metadata, ownerUserId
  });

  try {
    // Start buffering events during initialization
    this.#eventRecorder.startBuffering(session.id);

    // Get adapter
    const adapter = this.#adapterRegistry.getAdapter(kind);

    // Create process with onEvent callback
    const process = await adapter.create({
      ...options,
      onEvent: (ev) => {
        // Events are buffered or queued by EventRecorder
        this.#eventRecorder.recordEvent(session.id, ev);
      }
    });

    // Store active session
    this.#activeSessions.set(session.id, { adapter, process });

    // Flush buffered events
    await this.#eventRecorder.flushBuffer(session.id);

    // Update status
    await this.#sessionRepository.updateStatus(session.id, 'running');

    return { ...session, status: 'running' };

  } catch (error) {
    // Cleanup on error
    await this.#sessionRepository.updateStatus(session.id, 'error');
    this.#eventRecorder.clearBuffer(session.id);
    throw error;
  }
}
```

2. **sendInput() method** - Use process handle directly:

```javascript
async sendInput(sessionId, input) {
  const active = this.#activeSessions.get(sessionId);
  if (!active) {
    throw new Error(`Session not active: ${sessionId}`);
  }

  const { process } = active;

  // Standard interface: process.input?.write()
  if (!process.input?.write) {
    throw new Error(`Session ${sessionId} does not support input`);
  }

  process.input.write(input);

  // Record input event
  await this.#eventRecorder.recordEvent(sessionId, {
    channel: 'system:input',
    type: 'input',
    payload: { data: input }
  });
}
```

3. **Add resumeSession() method** - Port from RunSessionManager:

```javascript
async resumeSession(sessionId) {
  const session = await this.#sessionRepository.findById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (this.#activeSessions.has(sessionId)) {
    return { sessionId, resumed: false, reason: 'Already active' };
  }

  // Start buffering
  this.#eventRecorder.startBuffering(sessionId);

  try {
    const adapter = this.#adapterRegistry.getAdapter(session.kind);

    const process = await adapter.create({
      ...session.metadata,
      onEvent: (ev) => this.#eventRecorder.recordEvent(sessionId, ev)
    });

    this.#activeSessions.set(sessionId, { adapter, process });

    // Flush buffered events
    await this.#eventRecorder.flushBuffer(sessionId);

    // Update status
    await this.#sessionRepository.updateStatus(sessionId, 'running');

    // Get recent events for replay context
    const recentEvents = await this.#eventRecorder.getEvents(sessionId, 0);
    const last10 = recentEvents.slice(-10);

    return {
      sessionId,
      resumed: true,
      kind: session.kind,
      recentEventsCount: last10.length
    };

  } catch (error) {
    this.#eventRecorder.clearBuffer(sessionId);
    throw error;
  }
}
```

4. **Add getStats() method** - For monitoring:

```javascript
getStats() {
  return {
    activeSessions: this.#activeSessions.size,
    registeredAdapters: this.#adapterRegistry.getRegisteredTypes().length,
    supportedKinds: this.#adapterRegistry.getRegisteredTypes()
  };
}
```

**Result**: SessionOrchestrator now has same capabilities as RunSessionManager but with separated concerns.

#### Step 1.4: Enhance AdapterRegistry

**File**: `src/lib/server/sessions/AdapterRegistry.js`

**Add**:

```javascript
getRegisteredTypes() {
  return Array.from(this.#adapters.keys());
}

hasAdapter(kind) {
  return this.#adapters.has(kind);
}
```

**Result**: Better introspection for monitoring/debugging.

---

### Phase 2: Update Service Initialization (2 hours)

#### Step 2.1: Complete services.js with All Services

**File**: `src/lib/server/shared/services.js`

**Add missing services**:

```javascript
import { AuthService } from '../auth.js';
import { ClaudeAuthManager } from '../claude/ClaudeAuthManager.js';
import { MultiAuthManager, GitHubAuthProvider } from './auth/oauth.js';
import { TunnelManager } from './TunnelManager.js';
import { VSCodeTunnelManager } from './VSCodeTunnelManager.js';
import path from 'node:path';
import os from 'node:os';

export function createServices(config = {}) {
	// Resolve tilde paths
	const homeDir = config.HOME || process.env.HOME || os.homedir();
	const resolvedConfig = {
		dbPath: (config.dbPath || '~/.dispatch/data/workspace.db').replace(/^~/, homeDir),
		workspacesRoot: (config.workspacesRoot || '~/.dispatch-home/workspaces').replace(/^~/, homeDir),
		configDir: (config.configDir || '~/.config/dispatch').replace(/^~/, homeDir),
		port: config.port || 3030,
		tunnelSubdomain: config.tunnelSubdomain || ''
	};

	// Layer 1: Configuration
	const configService = new ConfigurationService({
		...config,
		...resolvedConfig
	});

	// Layer 2: Core infrastructure
	const jwtService = new JWTService(configService.get('TERMINAL_KEY'));
	const db = new DatabaseManager({ dbPath: resolvedConfig.dbPath, HOME: homeDir });

	// Layer 3: Repositories
	const sessionRepository = new SessionRepository(db);
	const eventStore = new EventStore(db);
	const settingsRepository = new SettingsRepository(db);
	const workspaceRepository = new WorkspaceRepository(db);

	// Layer 4: Session components
	const adapterRegistry = new AdapterRegistry();
	const eventRecorder = new EventRecorder(eventStore);
	const sessionOrchestrator = new SessionOrchestrator(
		sessionRepository,
		eventRecorder,
		adapterRegistry
	);

	// Layer 5: Auth services
	const authService = new AuthService();
	const claudeAuthManager = new ClaudeAuthManager();
	const multiAuthManager = new MultiAuthManager(db);

	// Layer 6: Tunnel services
	const tunnelManager = new TunnelManager({
		port: resolvedConfig.port,
		subdomain: resolvedConfig.tunnelSubdomain,
		database: db
	});
	const vscodeManager = new VSCodeTunnelManager({ database: db });

	// Layer 7: Register adapters
	const ptyAdapter = new PtyAdapter();
	const claudeAdapter = new ClaudeAdapter();
	const fileEditorAdapter = new FileEditorAdapter();

	adapterRegistry.register('pty', ptyAdapter);
	adapterRegistry.register('claude', claudeAdapter);
	adapterRegistry.register('file-editor', fileEditorAdapter);

	return {
		// Core
		config: configService,
		jwt: jwtService,
		db,

		// Repositories
		sessionRepository,
		eventStore,
		settingsRepository,
		workspaceRepository,

		// Session management
		adapterRegistry,
		eventRecorder,
		sessionOrchestrator,

		// Auth
		auth: authService,
		claudeAuthManager,
		multiAuthManager,

		// Tunnels
		tunnelManager,
		vscodeManager,

		// Adapters (direct access)
		ptyAdapter,
		claudeAdapter,
		fileEditorAdapter,

		// Convenience
		getAuthManager: () => multiAuthManager,
		getDatabase: () => db
	};
}

export let services = null;

export async function initializeServices(config = {}) {
	if (services) {
		return services;
	}

	services = createServices(config);

	// Initialize database
	await services.db.init();

	// Mark all sessions as stopped (cleanup from previous run)
	await services.sessionRepository.markAllStopped();

	// Initialize AuthService
	await services.auth.initialize(services.db);

	// Initialize MultiAuthManager
	await services.multiAuthManager.init();

	// Wire MultiAuthManager to AuthService
	services.auth.setMultiAuthManager(services.multiAuthManager);

	// Register OAuth providers from settings
	const authSettings = await services.settingsRepository.getByCategory('authentication');
	if (authSettings?.oauth_client_id && authSettings?.oauth_client_secret) {
		const githubProvider = new GitHubAuthProvider({
			clientId: authSettings.oauth_client_id,
			clientSecret: authSettings.oauth_client_secret,
			redirectUri:
				authSettings.oauth_redirect_uri ||
				`http://localhost:${services.config.get('PORT')}/auth/callback`,
			scopes: (authSettings.oauth_scope || 'user:email').split(' ')
		});
		await services.multiAuthManager.registerProvider(githubProvider);
	}

	// Initialize tunnel managers
	await services.tunnelManager.init();
	await services.vscodeManager.init();

	return services;
}

export function resetServices() {
	services = null;
}
```

**Result**: Complete service initialization with all dependencies wired.

#### Step 2.2: Replace index.js Implementation

**File**: `src/lib/server/shared/index.js`

**Complete replacement**:

```javascript
/**
 * Shared service initialization
 * REFACTORED: Using simplified architecture with ES6 modules
 */

import { initializeServices, services, resetServices } from './services.js';

// Re-export for convenience
export { initializeServices, services, resetServices };

/**
 * Export global services instance for API routes
 * Provides backward-compatible interface
 */
export const __API_SERVICES = {
	get services() {
		return services;
	},
	getAuthManager() {
		return services?.multiAuthManager;
	},
	getDatabase() {
		return services?.db;
	},
	getRunSessionManager() {
		// Return SessionOrchestrator - same interface for session operations
		return services?.sessionOrchestrator;
	}
};
```

**Result**: Clean 25-line file that delegates to services.js. RunSessionManager completely removed.

---

### Phase 3: Update Socket.IO Integration (2 hours)

#### Step 3.1: Update Socket Setup

**File**: `src/lib/server/socket/setup.js`

**Major changes**:

1. Use SocketEventMediator
2. Wire EventRecorder → Socket.IO
3. Apply middleware chain
4. Use handler factories

```javascript
import { createAuthMiddleware } from './middleware/auth.js';
import { createErrorMiddleware } from './middleware/errorHandling.js';
import { createLoggingMiddleware } from './middleware/logging.js';
import { SocketEventMediator } from './SocketEventMediator.js';
import { createSessionHandlers } from './handlers/sessionHandlers.js';
import { createAuthHandlers } from './handlers/authHandlers.js';
import { logger } from '../shared/utils/logger.js';

export function setupSocketIO(io, services) {
	logger.info('SOCKET', 'Initializing Socket.IO with SocketEventMediator');

	// Create mediator
	const mediator = new SocketEventMediator(io);

	// Apply middleware chain
	mediator.use(createAuthMiddleware(services.jwt));
	mediator.use(createErrorMiddleware());
	mediator.use(createLoggingMiddleware({ verbose: process.env.DEBUG === 'true' }));

	// Create handlers
	const sessionHandlers = createSessionHandlers(services.sessionOrchestrator);
	const authHandlers = createAuthHandlers(services.jwt, services.auth);

	// Register session handlers
	mediator.on('run:attach', sessionHandlers.attach);
	mediator.on('run:input', sessionHandlers.input);
	mediator.on('run:resize', sessionHandlers.resize);
	mediator.on('run:close', sessionHandlers.close);

	// Register auth handlers
	mediator.on('client:hello', authHandlers.hello);
	mediator.on('auth:validate', authHandlers.validate);

	// Subscribe to EventRecorder for real-time emission
	services.eventRecorder.subscribe('event', (eventData) => {
		const { sessionId, ...event } = eventData;
		io.to(`run:${sessionId}`).emit('run:event', event);
	});

	// Initialize mediator (starts listening)
	mediator.initialize();

	logger.info('SOCKET', 'Socket.IO setup complete');

	return mediator;
}
```

**Result**: Clean Socket.IO setup using new architecture components.

#### Step 3.2: Update Session Handlers

**File**: `src/lib/server/socket/handlers/sessionHandlers.js`

**Update to use SessionOrchestrator**:

```javascript
/**
 * Session socket handlers factory
 * @param {SessionOrchestrator} sessionOrchestrator
 */
export function createSessionHandlers(sessionOrchestrator) {
	return {
		async attach(socket, { runId, afterSeq = 0 }) {
			try {
				// Join room for this session
				socket.join(`run:${runId}`);

				// Attach to session (or resume if stopped)
				const result = await sessionOrchestrator.attachToSession(runId, afterSeq);

				// If not active, try to resume
				if (!result.process && result.session.status === 'stopped') {
					const resumed = await sessionOrchestrator.resumeSession(runId);
					return { success: true, resumed: true, ...resumed };
				}

				return {
					success: true,
					session: result.session,
					events: result.events,
					resumed: false
				};
			} catch (error) {
				logger.error('SOCKET', `Failed to attach to session ${runId}:`, error);
				return { success: false, error: error.message };
			}
		},

		async input(socket, { runId, data }) {
			try {
				await sessionOrchestrator.sendInput(runId, data);
				return { success: true };
			} catch (error) {
				logger.error('SOCKET', `Failed to send input to ${runId}:`, error);
				return { success: false, error: error.message };
			}
		},

		async resize(socket, { runId, cols, rows }) {
			try {
				const active = sessionOrchestrator.getActiveProcess(runId);
				if (active?.resize) {
					active.resize(cols, rows);
					return { success: true };
				}
				return { success: false, error: 'Resize not supported' };
			} catch (error) {
				logger.error('SOCKET', `Failed to resize ${runId}:`, error);
				return { success: false, error: error.message };
			}
		},

		async close(socket, { runId }) {
			try {
				await sessionOrchestrator.closeSession(runId);
				socket.leave(`run:${runId}`);
				return { success: true };
			} catch (error) {
				logger.error('SOCKET', `Failed to close session ${runId}:`, error);
				return { success: false, error: error.message };
			}
		}
	};
}
```

**Result**: Clean handlers that use SessionOrchestrator methods directly.

---

### Phase 4: Update API Routes (1 hour)

#### Step 4.1: Update Sessions API

**File**: `src/routes/api/sessions/+server.js`

```javascript
import { json } from '@sveltejs/kit';
import { __API_SERVICES } from '$lib/server/shared/index.js';

export async function GET({ url }) {
	try {
		const kind = url.searchParams.get('kind');
		const sessions = await __API_SERVICES.services.sessionRepository.findAll(kind);

		// Add live status
		const activeSessions = __API_SERVICES.services.sessionOrchestrator.getActiveSessions();
		const enriched = sessions.map((session) => ({
			...session,
			isLive: activeSessions.includes(session.id)
		}));

		return json({ success: true, sessions: enriched });
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const { kind, workspacePath, metadata, ownerUserId } = await request.json();

		const session = await __API_SERVICES.services.sessionOrchestrator.createSession(kind, {
			workspacePath,
			metadata,
			ownerUserId
		});

		return json({
			success: true,
			runId: session.id, // Client expects 'runId'
			session
		});
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
```

**File**: `src/routes/api/sessions/[id]/+server.js`

```javascript
import { json } from '@sveltejs/kit';
import { __API_SERVICES } from '$lib/server/shared/index.js';

export async function GET({ params }) {
	try {
		const session = await __API_SERVICES.services.sessionRepository.findById(params.id);

		if (!session) {
			return json({ success: false, error: 'Session not found' }, { status: 404 });
		}

		const activeSessions = __API_SERVICES.services.sessionOrchestrator.getActiveSessions();

		return json({
			success: true,
			session: {
				...session,
				isLive: activeSessions.includes(session.id)
			}
		});
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
}

export async function DELETE({ params }) {
	try {
		await __API_SERVICES.services.sessionOrchestrator.closeSession(params.id);
		return json({ success: true });
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
```

**Result**: API routes use SessionOrchestrator and repositories directly.

---

### Phase 5: Testing & Validation (2-3 hours)

#### Step 5.1: Unit Tests

**Create/Update**:

- `tests/server/sessions/event-recorder.test.js` - Test buffering logic
- `tests/server/sessions/session-orchestrator.test.js` - Test lifecycle methods
- `tests/server/database/event-store.test.js` - Test sequence management
- Update adapter tests if needed

#### Step 5.2: Integration Tests

**Test**:

- Complete session creation flow (pty, claude, file-editor)
- Event recording with buffering
- Socket.IO event emission
- Session resume
- Multi-client attachment

#### Step 5.3: E2E Tests

Run full suite:

```bash
npm run test:e2e
```

**Validate**:

- Terminal session works
- Claude session works
- File editor session works
- Session persistence works
- Multi-tab sync works

#### Step 5.4: Performance Validation

**Benchmarks**:

- Session creation < 100ms ✓
- Event throughput maintained ✓
- Memory < 10% increase ✓

---

## Files Changed Summary

### Modified Files

1. `src/lib/server/sessions/EventRecorder.js` - Add buffering + serialization
2. `src/lib/server/database/EventStore.js` - Add sequence management
3. `src/lib/server/sessions/SessionOrchestrator.js` - Add buffering, resume, stats
4. `src/lib/server/sessions/AdapterRegistry.js` - Add introspection methods
5. `src/lib/server/shared/services.js` - Add all missing services
6. `src/lib/server/shared/index.js` - **Complete rewrite** (25 lines)
7. `src/lib/server/socket/setup.js` - Use SocketEventMediator + handlers
8. `src/lib/server/socket/handlers/sessionHandlers.js` - Update to SessionOrchestrator
9. `src/routes/api/sessions/+server.js` - Use SessionOrchestrator
10. `src/routes/api/sessions/[id]/+server.js` - Use SessionOrchestrator

### Deleted Files

11. `src/lib/server/shared/runtime/RunSessionManager.js` - **DELETED** (470 lines removed)

### No Compatibility Shims Created

- ❌ No LegacyAdapterWrapper
- ❌ No RunSessionManagerCompat
- ❌ No feature flags
- ❌ No migration helpers

**Clean replacement: -470 lines of technical debt**

---

## Timeline Estimate

| Phase   | Tasks                         | Duration  |
| ------- | ----------------------------- | --------- |
| Phase 1 | Update core components        | 3-4 hours |
| Phase 2 | Update service initialization | 2 hours   |
| Phase 3 | Update Socket.IO integration  | 2 hours   |
| Phase 4 | Update API routes             | 1 hour    |
| Phase 5 | Testing & validation          | 2-3 hours |

**Total: 8-10 hours** (1-2 working days)

---

## Success Criteria

### Code Quality ✅

- ✅ Zero compatibility layers
- ✅ Zero legacy wrappers
- ✅ Clean, readable code
- ✅ Easy to add new session types
- ✅ Well-documented patterns

### Functionality ✅

- ✅ All tests pass
- ✅ Performance targets met
- ✅ Event buffering works
- ✅ Session resume works
- ✅ Multi-client sync works

### Extensibility ✅

Adding new session type requires:

1. Create adapter (implement `create()` method)
2. Register in `services.js` (1 line)
3. Add UI components
4. Register module (1 line)

**That's it. No core changes needed.**

---

## Developer Experience: Adding New Session Types

### Example: Add Database Session Type

**Step 1**: Create adapter

```javascript
// src/lib/server/database/DatabaseAdapter.js
export class DatabaseAdapter {
	async create(options) {
		const { connectionString, onEvent } = options;

		const connection = await connectToDatabase(connectionString);

		// Emit events
		connection.on('query', (query) => {
			onEvent({
				channel: 'database:query',
				type: 'query',
				payload: { query, timestamp: Date.now() }
			});
		});

		connection.on('result', (result) => {
			onEvent({
				channel: 'database:result',
				type: 'result',
				payload: result
			});
		});

		// Return process handle
		return {
			input: {
				write: (sql) => connection.execute(sql)
			},
			close: () => connection.disconnect()
		};
	}
}
```

**Step 2**: Register adapter

```javascript
// src/lib/server/shared/services.js
import { DatabaseAdapter } from '../database/DatabaseAdapter.js';

// In createServices():
const databaseAdapter = new DatabaseAdapter();
adapterRegistry.register('database', databaseAdapter);
```

**Step 3**: Create UI components

```svelte
<!-- src/lib/client/database/DatabasePane.svelte -->
<script>
	export let sessionId;
	export let events;
</script>

<div class="database-pane">
	{#each events as event}
		{#if event.type === 'query'}
			<div class="query">{event.payload.query}</div>
		{:else if event.type === 'result'}
			<div class="result">{JSON.stringify(event.payload)}</div>
		{/if}
	{/each}
</div>
```

**Step 4**: Register module

```javascript
// src/lib/client/shared/session-modules/index.js
import DatabasePane from '$lib/client/database/DatabasePane.svelte';
import DatabaseHeader from '$lib/client/database/DatabaseHeader.svelte';

registerModule('database', {
	paneComponent: DatabasePane,
	headerComponent: DatabaseHeader
});
```

**Done!** The new session type is fully integrated.

---

## Conclusion

This migration plan provides a **clean, debt-free replacement** of RunSessionManager with the new simplified architecture.

**Key Achievements**:

- ✅ **Preserves proven patterns** - Event buffering, sequence management, resume logic
- ✅ **Eliminates technical debt** - No compatibility shims or legacy wrappers
- ✅ **Maintains extensibility** - Easy to add new session types
- ✅ **Improves maintainability** - Separated concerns, clear responsibilities
- ✅ **Clean codebase** - Readable, understandable, well-structured

**Alignment with Spec**:

- ✅ Simplicity first (no unnecessary abstractions)
- ✅ ES6 modules only (no DI framework)
- ✅ YAGNI compliant (no unused features)
- ✅ Big bang deployment (no feature flags)

**Ready to Execute**: All design decisions made, implementation plan detailed, success criteria clear.
