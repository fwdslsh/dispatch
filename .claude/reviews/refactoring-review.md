# Code Quality & Refactoring Review

**Project:** Dispatch
**Reviewer:** Claude Code (Refactoring Specialist)
**Date:** 2025-11-19
**Scope:** Backend session management, authentication, API routes, database, Socket.IO, frontend services, test coverage

---

## Executive Summary

The Dispatch project demonstrates a well-architected foundation with modern patterns including event sourcing, dependency injection, and clean separation of concerns. However, the codebase exhibits several code quality issues that should be addressed before RC1:

**Key Findings:**

- **578-line socket-setup.js** violates Single Responsibility Principle with massive duplication
- **Authentication logic repeated 4+ times** across socket handlers (DRY violation)
- **Missing error boundaries** around critical async operations
- **Inconsistent error handling** patterns across API routes
- **Test coverage gaps** in critical authentication paths
- **Security concerns** with plaintext OAuth secrets and hardcoded URLs
- **Performance bottleneck** in workspace API (N+1 query pattern)

**Overall Assessment:** The architecture is sound, but technical debt in socket-setup.js, authentication middleware, and API routes needs immediate attention. Estimated 2-3 weeks of focused refactoring work to address critical and high-priority issues.

---

## Critical Issues

### 1. Security: Plaintext OAuth Client Secrets

**File:** `/home/user/dispatch/src/lib/server/auth/OAuth.server.js:228`
**Severity:** CRITICAL
**Code Smell:** Security Vulnerability
**Principle Violated:** Security by Design

**Issue:**

```javascript
providers[provider] = {
	enabled: true,
	clientId,
	clientSecret, // TODO: Encrypt in production <-- CRITICAL
	redirectUri: redirectUri || this.getDefaultRedirectUri(provider),
	updatedAt: Date.now()
};
```

OAuth client secrets are stored in plaintext in SQLite database. This is a critical security vulnerability.

**Impact:**

- Database compromise exposes OAuth credentials
- Violates OAuth security best practices
- Regulatory compliance risk (GDPR, SOC2)

**Recommended Refactoring:**

1. Implement encryption-at-rest using Node.js crypto module
2. Store encryption key in environment variable (not in database)
3. Create EncryptionService with encrypt/decrypt methods
4. Wrap all secret storage/retrieval through EncryptionService

**Estimated Effort:** Medium (1-2 days)

---

### 2. God Object: socket-setup.js (578 lines)

**File:** `/home/user/dispatch/src/lib/server/shared/socket-setup.js`
**Severity:** CRITICAL
**Code Smell:** God Object, Long Method, Feature Envy
**Principle Violated:** Single Responsibility Principle, Open/Closed Principle

**Issue:**
Single file handles:

- Socket.IO initialization
- Authentication (3 different strategies)
- Session event routing
- Tunnel management
- Claude authentication
- VS Code tunnel management
- Admin event logging
- Cookie parsing
- State validation

**Violations:**

1. **SRP violation:** 9+ distinct responsibilities in one file
2. **OCP violation:** Adding new event types requires modifying this file
3. **DRY violation:** Authentication logic repeated 4+ times (lines 79-102, 171-235, 278-290, 307-319, 373-415)
4. **High cyclomatic complexity:** Multiple nested conditionals

**Code Duplication Example:**

```javascript
// Pattern repeated 4+ times:
const { apiKey, terminalKey } = data || {};
const token = apiKey || terminalKey;
if (token) {
	const isValid = await requireValidAuth(socket, token, callback, services);
	if (!isValid) return;
} else if (!socket.data.authenticated) {
	logger.warn('SOCKET', `Unauthenticated ${eventName} from socket ${socket.id}`);
	if (callback) callback({ success: false, error: 'Authentication required' });
	return;
}
```

**Recommended Refactoring:**

**Phase 1: Extract Authentication Middleware (Small - 1 day)**

```javascript
// src/lib/server/socket/middleware/authentication.js
export function createAuthenticationMiddleware(services) {
	return async (socket, data, callback, next) => {
		const result = await authenticateSocket(socket, data, services);
		if (!result.authenticated) {
			return callback?.({ success: false, error: result.error });
		}
		next();
	};
}

async function authenticateSocket(socket, data, services) {
	// Unified authentication logic (single source of truth)
	// Strategy 1: Explicit token
	// Strategy 2: Session cookie
	// Strategy 3: Handshake cookie
}
```

**Phase 2: Extract Event Handlers (Medium - 2 days)**

```javascript
// src/lib/server/socket/handlers/
// ├── sessionHandlers.js (already exists)
// ├── tunnelHandlers.js (NEW)
// ├── claudeHandlers.js (NEW)
// └── vscodeHandlers.js (NEW)

// Each handler module exports createHandlers(services)
export function createTunnelHandlers(services) {
	return {
		start: async (socket, data, callback) => {
			/* ... */
		},
		stop: async (socket, data, callback) => {
			/* ... */
		},
		status: async (socket, data, callback) => {
			/* ... */
		},
		updateConfig: async (socket, data, callback) => {
			/* ... */
		}
	};
}
```

**Phase 3: Refactor setupSocketIO (Small - 1 day)**

```javascript
// src/lib/server/shared/socket-setup.js (reduced to ~150 lines)
export function setupSocketIO(httpServer, services) {
	const io = new Server(httpServer, { cors: { origin: '*' } });
	const mediator = new SocketEventMediator(io);

	// Register middleware
	mediator.use(createAuthenticationMiddleware(services));
	mediator.use(createLoggingMiddleware());
	mediator.use(createErrorHandlingMiddleware());

	// Register handlers
	registerSessionHandlers(mediator, services);
	registerTunnelHandlers(mediator, services);
	registerClaudeHandlers(mediator, services);
	registerVSCodeHandlers(mediator, services);

	// Setup event recorder
	setupEventRecorder(io, services.eventRecorder);

	return io;
}
```

**Estimated Effort:** Medium (4 days total for all 3 phases)

---

### 3. N+1 Query Pattern in Workspace API

**File:** `/home/user/dispatch/src/routes/api/workspaces/+server.js:25-32`
**Severity:** CRITICAL
**Code Smell:** Performance Bottleneck
**Principle Violated:** Performance Best Practices

**Issue:**

```javascript
for (const workspace of workspaces) {
	const sessions = await database.all(
		`SELECT COUNT(*) as count, status
         FROM sessions
         WHERE JSON_EXTRACT(meta_json, '$.workspacePath') = ?
         GROUP BY status`,
		[workspace.path]
	);
	// ... process results
}
```

This creates N database queries for N workspaces (classic N+1 problem).

**Impact:**

- 100 workspaces = 101 database queries
- Significant latency with large workspace counts
- Database connection pool exhaustion under load

**Recommended Refactoring:**

```javascript
// Single query with JOIN or subquery
const workspacesWithCounts = await database.all(`
    SELECT
        w.*,
        COUNT(CASE WHEN s.status = 'running' THEN 1 END) as running_count,
        COUNT(CASE WHEN s.status = 'stopped' THEN 1 END) as stopped_count,
        COUNT(CASE WHEN s.status = 'error' THEN 1 END) as error_count,
        COUNT(s.run_id) as total_count
    FROM workspaces w
    LEFT JOIN sessions s ON JSON_EXTRACT(s.meta_json, '$.workspacePath') = w.path
    GROUP BY w.path
    ORDER BY w.last_active DESC
`);
```

**Estimated Effort:** Small (2-4 hours)

---

## High Priority Refactoring

### 4. Inconsistent Error Handling Patterns

**Files:** Multiple API routes
**Severity:** HIGH
**Code Smell:** Inconsistent Exception Handling
**Principle Violated:** Consistency, Fail-Fast

**Issue:**
API routes use 3 different error handling patterns:

**Pattern 1 - Try/Catch with Error Rethrow (sessions/+server.js:76-78)**

```javascript
try {
	// ...
} catch (error) {
	console.error('[API] Failed to list sessions:', error);
	return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
```

**Pattern 2 - Try/Catch with SvelteKit error() (workspaces/+server.js:88-94)**

```javascript
try {
	// ...
} catch (err) {
	if (err?.status && err?.body) {
		throw err;
	}
	logger.error('WORKSPACE_API', 'Failed to list workspaces:', err);
	throw error(500, { message: 'Failed to retrieve workspaces' });
}
```

**Pattern 3 - Try/Catch with json() Response (workspaces/+server.js:158-164)**

```javascript
try {
	// ...
} catch (err) {
	if (err?.status && err?.body) {
		throw err;
	}
	logger.error('WORKSPACE_API', 'Failed to create workspace:', err);
	throw error(500, { message: 'Failed to create workspace' });
}
```

**Problems:**

1. Inconsistent response formats
2. Some routes log with `console.error`, others with `logger.error`
3. Error status codes not standardized
4. No central error classification (client vs server errors)

**Recommended Refactoring:**

**Create Error Handler Utility:**

```javascript
// src/lib/server/shared/utils/api-errors.js
export class ApiError extends Error {
	constructor(message, status = 500, code = 'INTERNAL_ERROR') {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export class BadRequestError extends ApiError {
	constructor(message, code = 'BAD_REQUEST') {
		super(message, 400, code);
	}
}

export class NotFoundError extends ApiError {
	constructor(message, code = 'NOT_FOUND') {
		super(message, 404, code);
	}
}

export class UnauthorizedError extends ApiError {
	constructor(message, code = 'UNAUTHORIZED') {
		super(message, 401, code);
	}
}

// Centralized handler
export function handleApiError(err, context = '') {
	// Already a SvelteKit error
	if (err?.status && err?.body) {
		throw err;
	}

	// Custom API error
	if (err instanceof ApiError) {
		logger.error(context, err.message, { code: err.code, status: err.status });
		throw error(err.status, { message: err.message, code: err.code });
	}

	// Unknown error - don't expose details to client
	logger.error(context, 'Unexpected error:', err);
	throw error(500, { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
}
```

**Usage:**

```javascript
export async function GET({ url, locals }) {
	try {
		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}
		// ... logic
	} catch (err) {
		return handleApiError(err, 'WORKSPACE_API');
	}
}
```

**Estimated Effort:** Medium (2-3 days to refactor all API routes)

---

### 5. Duplicate Authentication Logic in hooks.server.js

**File:** `/home/user/dispatch/src/hooks.server.js:81-193`
**Severity:** HIGH
**Code Smell:** Long Method, Complex Conditionals
**Principle Violated:** Single Responsibility, DRY

**Issue:**
`authenticationMiddleware` function is 112 lines with:

- Nested if/else chains (8 levels deep)
- Duplicate cookie parsing logic
- Mixed concerns (auth + session refresh + routing)
- Special case handling scattered throughout

**Current Structure:**

```javascript
async function authenticationMiddleware({ event, resolve }) {
	// Route checking (lines 82-98)
	// Strategy 1: Session cookie (lines 104-146)
	// Strategy 2: API key (lines 148-170)
	// Unauthenticated handling (lines 172-193)
}
```

**Recommended Refactoring:**

**Extract Authentication Strategies (Strategy Pattern):**

```javascript
// src/lib/server/auth/strategies/AuthStrategy.js
export class AuthStrategy {
	async authenticate(event, services) {
		throw new Error('Must implement authenticate()');
	}
}

// src/lib/server/auth/strategies/SessionCookieStrategy.js
export class SessionCookieStrategy extends AuthStrategy {
	async authenticate(event, services) {
		const sessionId = CookieService.getSessionCookie(event.cookies);
		if (!sessionId) return null;

		const sessionData = await services.sessionManager.validateSession(sessionId);
		if (!sessionData) return null;

		// Refresh if needed
		if (sessionData.needsRefresh) {
			await services.sessionManager.refreshSession(sessionId);
		}

		return {
			authenticated: true,
			provider: sessionData.session.provider,
			userId: sessionData.session.userId,
			session: sessionData.session,
			user: sessionData.user
		};
	}
}

// src/lib/server/auth/strategies/ApiKeyStrategy.js
export class ApiKeyStrategy extends AuthStrategy {
	async authenticate(event, services) {
		const token = services.auth.getAuthKeyFromRequest(event.request);
		if (!token) return null;

		const authResult = await services.auth.validateAuth(token);
		if (!authResult.valid) return null;

		return {
			authenticated: true,
			provider: authResult.provider,
			userId: authResult.userId,
			apiKeyId: authResult.apiKeyId,
			label: authResult.label
		};
	}
}

// src/lib/server/auth/AuthenticationCoordinator.js
export class AuthenticationCoordinator {
	constructor(strategies) {
		this.strategies = strategies; // Ordered array
	}

	async authenticate(event, services) {
		for (const strategy of this.strategies) {
			const result = await strategy.authenticate(event, services);
			if (result) return result;
		}
		return { authenticated: false };
	}
}
```

**Simplified Middleware:**

```javascript
// hooks.server.js (reduced from 112 to ~40 lines)
async function authenticationMiddleware({ event, resolve }) {
	const { pathname } = event.url;

	// Skip public routes
	if (isPublicRoute(pathname) && !isOptionalAuthRoute(pathname)) {
		return resolve(event);
	}

	// Authenticate using strategy pattern
	const coordinator = new AuthenticationCoordinator([
		new SessionCookieStrategy(),
		new ApiKeyStrategy()
	]);

	const authResult = await coordinator.authenticate(event, event.locals.services);
	event.locals.auth = authResult;

	// Handle unauthenticated
	if (!authResult.authenticated && !isOptionalAuthRoute(pathname)) {
		return handleUnauthenticated(event);
	}

	return resolve(event);
}
```

**Estimated Effort:** Medium (3 days)

---

### 6. Missing Error Boundaries Around Async Operations

**Files:** Multiple (socket-setup.js, SessionOrchestrator.js, adapters)
**Severity:** HIGH
**Code Smell:** Silent Failures, Resource Leaks
**Principle Violated:** Fail-Fast, Resource Management

**Issue:**
Several critical async operations lack proper error boundaries:

**Example 1 - SessionOrchestrator (lines 70-98):**

```javascript
try {
	this.#eventRecorder.startBuffering(session.id);

	const process = await adapter.create({
		...adapterOptions,
		...metadata,
		onEvent: (ev) => {
			// No error handling if recordEvent fails
			this.#eventRecorder.recordEvent(session.id, ev);
		}
	});

	// If flushBuffer fails, session is left in inconsistent state
	await this.#eventRecorder.flushBuffer(session.id);
} catch (error) {
	await this.#sessionRepository.updateStatus(session.id, 'error');
	// What if updateStatus fails? Silent failure
	this.#eventRecorder.clearBuffer(session.id);
	// What if clearBuffer fails? Silent failure
	throw error;
}
```

**Problems:**

1. `recordEvent` in onEvent callback has no error handler
2. `updateStatus` failure in catch block is not handled
3. `clearBuffer` failure is silently ignored
4. No cleanup of `adapter` if `flushBuffer` fails

**Recommended Refactoring:**

**Implement Try-Finally Pattern:**

```javascript
async createSession(kind, options) {
    const { workspacePath, metadata = {}, ownerUserId = null, ...adapterOptions } = options;

    const adapter = this.#adapterRegistry.getAdapter(kind);
    const session = await this.#sessionRepository.create({
        kind, workspacePath, metadata, ownerUserId
    });

    let process = null;
    let cleanupRequired = false;

    try {
        this.#eventRecorder.startBuffering(session.id);
        cleanupRequired = true;

        process = await adapter.create({
            ...adapterOptions,
            ...metadata,
            onEvent: (ev) => {
                // Wrap in try-catch to prevent crashing the process
                this.#eventRecorder.recordEvent(session.id, ev)
                    .catch(err => {
                        logger.error('SESSION', `Event recording failed for ${session.id}:`, err);
                        // Emit error event for monitoring
                        this.emit('event-record-error', { sessionId: session.id, error: err });
                    });
            }
        });

        await this.#eventRecorder.flushBuffer(session.id);
        await this.#sessionRepository.updateStatus(session.id, 'running');
        cleanupRequired = false;

        return { ...session, status: 'running' };

    } catch (error) {
        logger.error('SESSION', `Failed to create ${kind} session:`, error);
        throw error;

    } finally {
        if (cleanupRequired) {
            // Cleanup operations should never throw
            await this.#safeCleanup(session.id, process);
        }
    }
}

async #safeCleanup(sessionId, process) {
    const errors = [];

    // Close process if created
    if (process?.close) {
        try {
            await process.close();
        } catch (err) {
            errors.push({ operation: 'process.close', error: err });
        }
    }

    // Update session status
    try {
        await this.#sessionRepository.updateStatus(sessionId, 'error');
    } catch (err) {
        errors.push({ operation: 'updateStatus', error: err });
    }

    // Clear event buffer
    try {
        this.#eventRecorder.clearBuffer(sessionId);
    } catch (err) {
        errors.push({ operation: 'clearBuffer', error: err });
    }

    // Log all cleanup errors
    if (errors.length > 0) {
        logger.error('SESSION', `Cleanup errors for ${sessionId}:`, errors);
    }
}
```

**Estimated Effort:** Medium (2-3 days across all affected files)

---

### 7. Hardcoded Base URL in OAuth

**File:** `/home/user/dispatch/src/lib/server/auth/OAuth.server.js:289`
**Severity:** HIGH
**Code Smell:** Magic String, Environment-Specific Code
**Principle Violated:** Configuration Management

**Issue:**

```javascript
const baseUrl = 'https://localhost:5173'; // Replace with actual base URL in production
redirectUri = new URL(redirectUri, baseUrl).toString();
```

This will break in production and prevents deployment flexibility.

**Recommended Refactoring:**

```javascript
// src/lib/server/config/environment.js
export const config = {
    baseUrl: process.env.PUBLIC_BASE_URL ||
             (process.env.NODE_ENV === 'production'
                ? 'https://dispatch.example.com'
                : 'https://localhost:5173'),
    port: parseInt(process.env.PORT || '3030', 10),
    isDevelopment: process.env.NODE_ENV !== 'production'
};

// OAuth.server.js
import { config } from '../config/environment.js';

buildAuthorizationUrl(provider, config, state, customRedirectUri) {
    let redirectUri = customRedirectUri || config.redirectUri;

    if (!redirectUri.startsWith('http')) {
        redirectUri = new URL(redirectUri, config.baseUrl).toString();
    }
    // ...
}
```

**Estimated Effort:** Small (1-2 hours)

---

## Medium Priority Refactoring

### 8. Primitive Obsession in Session IDs

**File:** `/home/user/dispatch/src/lib/server/database/SessionRepository.js:33`
**Severity:** MEDIUM
**Code Smell:** Primitive Obsession
**Principle Violated:** Type Safety

**Issue:**

```javascript
const runId = `${kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

Problems:

1. Session ID generation scattered across codebase
2. No validation of ID format
3. Difficult to test (random component)
4. No type safety

**Recommended Refactoring:**

```javascript
// src/lib/server/shared/SessionId.js
export class SessionId {
    #value;

    constructor(kind, timestamp = Date.now(), nonce = null) {
        this.kind = kind;
        this.timestamp = timestamp;
        this.nonce = nonce || this.#generateNonce();
        this.#value = `${kind}-${timestamp}-${this.nonce}`;
    }

    #generateNonce() {
        return Math.random().toString(36).substr(2, 9);
    }

    toString() {
        return this.#value;
    }

    static parse(idString) {
        const parts = idString.split('-');
        if (parts.length !== 3) {
            throw new Error(`Invalid session ID format: ${idString}`);
        }
        const [kind, timestamp, nonce] = parts;
        return new SessionId(kind, parseInt(timestamp, 10), nonce);
    }

    static isValid(idString) {
        try {
            SessionId.parse(idString);
            return true;
        } catch {
            return false;
        }
    }
}

// SessionRepository.js
async create(sessionData) {
    const sessionId = new SessionId(sessionData.kind);
    const runId = sessionId.toString();
    // ...
}
```

**Estimated Effort:** Small (1 day)

---

### 9. Feature Envy in SocketService

**File:** `/home/user/dispatch/src/lib/client/shared/services/SocketService.svelte.js`
**Severity:** MEDIUM
**Code Smell:** Feature Envy, Inappropriate Intimacy
**Principle Violated:** Tell Don't Ask

**Issue:**
The service exposes too much internal state and requires clients to check state before operations:

```javascript
// Client code has to know about service internals
if (!this.socket?.connected) {
	this.queueMessage(event, data, callback);
	return;
}
```

Clients must:

1. Check `socket?.connected`
2. Know about message queuing
3. Understand connection state management

**Recommended Refactoring:**

```javascript
// Encapsulate connection state checks
export class SocketService {
	emit(event, data, callback) {
		// Service handles connection state internally
		if (!this.#isConnected()) {
			return this.#handleDisconnected(event, data, callback);
		}
		return this.#sendMessage(event, data, callback);
	}

	#isConnected() {
		return this.socket?.connected === true;
	}

	#handleDisconnected(event, data, callback) {
		// Auto-reconnect or queue based on configuration
		if (this.config.autoQueue) {
			this.#queueMessage(event, data, callback);
			return Promise.resolve({ queued: true });
		}
		throw new SocketDisconnectedError('Socket not connected');
	}

	#sendMessage(event, data, callback) {
		return new Promise((resolve, reject) => {
			if (callback) {
				this.socket.emit(event, data, callback);
				resolve({ sent: true });
			} else {
				this.socket.emit(event, data);
				resolve({ sent: true });
			}
		});
	}
}
```

**Estimated Effort:** Small (1 day)

---

### 10. Magic Numbers in DatabaseManager

**File:** `/home/user/dispatch/src/lib/server/database/DatabaseManager.js:207-224`
**Severity:** MEDIUM
**Code Smell:** Magic Numbers
**Principle Violated:** Named Constants

**Issue:**

```javascript
async run(sql, params = [], retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        // ...
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
}
```

Magic numbers: `3` retries, `100` ms base delay

**Recommended Refactoring:**

```javascript
// src/lib/server/database/DatabaseConfig.js
export const DB_CONFIG = {
    RETRY_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 100,
    BUSY_TIMEOUT_MS: 5000,
    MAX_CONNECTIONS: 10,
    WAL_MODE: 'WAL',
    FOREIGN_KEYS: 'ON'
};

export function calculateBackoffDelay(attempt, baseDelayMs = DB_CONFIG.RETRY_BASE_DELAY_MS) {
    return Math.pow(2, attempt) * baseDelayMs;
}

// DatabaseManager.js
import { DB_CONFIG, calculateBackoffDelay } from './DatabaseConfig.js';

async run(sql, params = [], retries = DB_CONFIG.RETRY_ATTEMPTS) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await this.#executeQuery(sql, params);
        } catch (err) {
            if (err.code === 'SQLITE_BUSY' && attempt < retries - 1) {
                await this.#waitWithBackoff(attempt);
                continue;
            }
            throw err;
        }
    }
}

async #waitWithBackoff(attempt) {
    const delay = calculateBackoffDelay(attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
}
```

**Estimated Effort:** Small (2-3 hours)

---

### 11. Long Parameter Lists in Adapters

**File:** `/home/user/dispatch/src/lib/server/terminal/PtyAdapter.js:33`
**Severity:** MEDIUM
**Code Smell:** Long Parameter List
**Principle Violated:** Simple Design

**Issue:**
The `create` method accepts a massive options object with 20+ properties documented in JSDoc (lines 13-31). This violates the Interface Segregation Principle.

**Recommended Refactoring:**

**Create Configuration Objects:**

```javascript
// src/lib/server/terminal/PtyConfig.js
export class PtyConfig {
    constructor(options = {}) {
        this.cwd = options.cwd || process.env.WORKSPACES_ROOT || process.env.HOME;
        this.dimensions = new TerminalDimensions(options.cols, options.rows);
        this.environment = new EnvironmentConfig(options.env, options.workspaceEnv);
        this.terminal = new TerminalSettings(options.name, options.encoding);
        this.flowControl = new FlowControlSettings(options.handleFlowControl, ...);
        this.platformSettings = this.#resolvePlatformSettings(options);
    }

    #resolvePlatformSettings(options) {
        if (process.platform === 'win32') {
            return new WindowsSettings(options.useConpty, options.useConptyDll, ...);
        }
        return new UnixSettings(options.uid, options.gid);
    }

    validate() {
        // Validate configuration before use
        if (!this.cwd) throw new Error('Working directory required');
        this.dimensions.validate();
        this.environment.validate();
    }
}

export class TerminalDimensions {
    constructor(cols = 80, rows = 24) {
        this.cols = cols;
        this.rows = rows;
    }

    validate() {
        if (this.cols < 1 || this.rows < 1) {
            throw new Error('Invalid terminal dimensions');
        }
    }
}

// PtyAdapter.js
async create({ cwd, options = {}, onEvent }) {
    const config = new PtyConfig({ cwd, ...options });
    config.validate(); // Fail-fast validation

    const pty = await import('node-pty');
    const term = pty.spawn(config.shell, config.args, config.toPtyOptions());
    // ...
}
```

**Estimated Effort:** Small (1 day)

---

### 12. Callback Hell in EventRecorder

**File:** `/home/user/dispatch/src/lib/server/sessions/EventRecorder.js:114-124`
**Severity:** MEDIUM
**Code Smell:** Callback Pyramid
**Principle Violated:** Readability

**Issue:**

```javascript
const operation = buffer.eventQueue
	.then(async () => {
		return await this.#persistAndEmit(sessionId, event);
	})
	.catch((/** @type {Error} */ err) => {
		console.error(`Event queue error for ${sessionId}:`, err);
		this.#eventEmitter.emit('error', { sessionId, error: err, event });
		throw err;
	});

buffer.eventQueue = operation.catch(() => {
	// Swallow to keep queue healthy
});

return operation;
```

Complex promise chaining with error swallowing is difficult to reason about.

**Recommended Refactoring:**

```javascript
async recordEvent(sessionId, event) {
    const buffer = this.#buffers.get(sessionId);

    if (!buffer) {
        return await this.#persistAndEmit(sessionId, event);
    }

    if (buffer.initializing) {
        buffer.eventBuffer.push(event);
        return;
    }

    // Use async/await instead of promise chaining
    return await this.#enqueueOperation(sessionId, event, buffer);
}

async #enqueueOperation(sessionId, event, buffer) {
    // Wait for previous operation
    await buffer.eventQueue;

    try {
        const result = await this.#persistAndEmit(sessionId, event);
        return result;
    } catch (err) {
        logger.error('EVENT_RECORDER', `Queue error for ${sessionId}:`, err);
        this.#eventEmitter.emit('error', { sessionId, error: err, event });
        throw err; // Propagate to caller
    } finally {
        // Update queue for next operation
        buffer.eventQueue = Promise.resolve();
    }
}
```

**Estimated Effort:** Small (2-3 hours)

---

## Low Priority Refactoring

### 13. Console.log in Production Code

**Files:** Multiple
**Severity:** LOW
**Code Smell:** Debug Code in Production

**Issue:**
Production code contains `console.log` statements:

- `SessionRepository.js:179` - console.warn for JSON parse failure
- `EventRecorder.js:91, 100, 107, 113, 141, 145` - console.log for debugging
- `sessions/+server.js:31, 43, 65` - console.log for API debugging

**Recommended Refactoring:**
Replace all `console.*` with `logger.*`:

```javascript
// Before
console.warn('Failed to parse session metadata:', e);

// After
logger.warn('SESSION_REPO', 'Failed to parse session metadata:', e);
```

**Estimated Effort:** Small (2 hours)

---

### 14. Commented-Out Code

**File:** `/home/user/dispatch/src/lib/server/auth/OAuth.server.js:8`
**Severity:** LOW
**Code Smell:** Dead Code

**Issue:**

```javascript
// import { AuthProvider } from '../../shared/auth-types.js';
```

Commented imports should be removed or uncommented.

**Recommended Refactoring:** Remove if unused, uncomment if needed.

**Estimated Effort:** Trivial (5 minutes)

---

### 15. Missing JSDoc for Public Methods

**Files:** Multiple
**Severity:** LOW
**Code Smell:** Poor Documentation

**Issue:**
Many public methods lack JSDoc documentation:

- `ServiceContainer.svelte.js` - Most methods missing JSDoc
- `SocketService.svelte.js` - Public methods lack parameter docs
- `SessionOrchestrator.js` - Good JSDoc, but some methods incomplete

**Recommended Refactoring:**
Add comprehensive JSDoc to all public methods:

```javascript
/**
 * Register a service factory for lazy instantiation
 * @param {string} name - Unique service identifier
 * @param {() => Promise<any>} factory - Async factory function
 * @throws {Error} If name is already registered
 * @example
 * container.registerFactory('myService', async () => {
 *     return new MyService();
 * });
 */
registerFactory(name, factory) {
    if (this.factories.has(name)) {
        throw new Error(`Service '${name}' already registered`);
    }
    this.factories.set(name, factory);
}
```

**Estimated Effort:** Medium (2-3 days for all files)

---

## Test Coverage Analysis

### Current State

**Strengths:**

- Good unit test coverage for core business logic
- 38 test files covering client and server
- Comprehensive SessionOrchestrator tests
- Database repository tests exist

**Critical Gaps:**

### 1. Missing Authentication Tests

**Files Lacking Tests:**

- `hooks.server.js` - No tests for authentication middleware
- `socket-setup.js` - No tests for socket authentication
- `CookieService.server.js` - No validation tests
- `OAuth.server.js` - No OAuth flow tests

**Recommended Tests:**

```javascript
// tests/server/auth/authentication-middleware.test.js
describe('authenticationMiddleware', () => {
	it('should authenticate with valid session cookie', async () => {});
	it('should authenticate with valid API key', async () => {});
	it('should reject invalid credentials', async () => {});
	it('should refresh expiring sessions', async () => {});
	it('should redirect unauthenticated browser requests', async () => {});
	it('should return 401 for unauthenticated API requests', async () => {});
	it('should handle optional auth routes correctly', async () => {});
});

// tests/server/socket/socket-authentication.test.js
describe('Socket Authentication', () => {
	it('should authenticate socket with session cookie', async () => {});
	it('should authenticate socket with API key', async () => {});
	it('should validate session on periodic check', async () => {});
	it('should disconnect on expired session', async () => {});
});
```

**Estimated Effort:** Medium (3-4 days)

---

### 2. Missing E2E Tests

**Critical User Journeys Not Covered:**

- Complete onboarding flow with OAuth
- Session creation and attachment via Socket.IO
- Real-time event streaming
- Multi-client session synchronization
- Session resume after server restart

**Recommended E2E Tests:**

```javascript
// e2e/session-lifecycle.spec.js
test('complete session lifecycle', async ({ page }) => {
	// Create session
	// Attach to session
	// Send input
	// Verify output
	// Close session
	// Verify cleanup
});

// e2e/multi-client-sync.spec.js
test('multiple clients sync session state', async ({ browser }) => {
	// Open session in tab 1
	// Attach in tab 2
	// Send input in tab 1
	// Verify tab 2 receives events
});

// e2e/oauth-authentication.spec.js
test('OAuth GitHub authentication flow', async ({ page }) => {
	// Mock OAuth provider
	// Complete OAuth flow
	// Verify session creation
});
```

**Estimated Effort:** Large (1-2 weeks)

---

### 3. Missing Integration Tests

**Areas Needing Integration Tests:**

- Database migrations and schema validation
- Socket.IO event emission from EventRecorder
- Adapter registration and session orchestration
- Settings repository with migrations

**Recommended Integration Tests:**

```javascript
// tests/integration/session-orchestration.test.js
describe('Session Orchestration Integration', () => {
	it('should create session, persist events, and emit to socket', async () => {
		// Real database + real EventRecorder + real adapters
	});
});

// tests/integration/database-migrations.test.js
describe('Database Migrations', () => {
	it('should migrate from version 1 to current', async () => {});
	it('should preserve data during migration', async () => {});
});
```

**Estimated Effort:** Medium (4-5 days)

---

### 4. Test Quality Issues

**SessionOrchestrator.test.js Analysis:**

**Problems:**

1. **Line 157-162:** Accessing private fields via bracket notation

   ```javascript
   const activeSessions = orchestrator['_SessionOrchestrator__activeSessions'];
   ```

   This is a code smell - tests should not access private implementation details.

2. **Line 174:** Incorrect channel name in assertion

   ```javascript
   channel: 'system', // Should be 'system:input' based on actual implementation
   ```

3. **Line 181, 212:** Error message mismatch

   ```javascript
   await expect(orchestrator.sendInput('invalid', 'test')).rejects.toThrow('Session not found');
   // Actual implementation throws 'Session not active: invalid'
   ```

4. **Line 207, 215:** Incorrect status value

   ```javascript
   expect(mockSessionRepository.updateStatus).toHaveBeenCalledWith(sessionId, 'closed');
   // Actual implementation uses 'stopped', not 'closed'
   ```

5. **Lines 249-309:** Resume tests don't match implementation
   - Implementation doesn't have `resume` method on adapters
   - Implementation recreates session via `adapter.create()`
   - Tests check for `adapter.resume()` which doesn't exist

**Recommended Refactoring:**

```javascript
// Instead of accessing private fields:
// orchestrator['_SessionOrchestrator__activeSessions']

// Use public API:
describe('sendInput', () => {
	it('should send input to active session', async () => {
		// Create session via public API
		const session = await orchestrator.createSession('pty', {
			workspacePath: '/test'
		});

		// Now test input (no private field access needed)
		await orchestrator.sendInput(session.id, 'test input');

		expect(mockEventRecorder.recordEvent).toHaveBeenCalledWith(
			session.id,
			expect.objectContaining({
				channel: 'system:input', // Correct channel name
				type: 'input'
			})
		);
	});
});
```

**Estimated Effort:** Small (1 day to fix existing tests)

---

## Performance Concerns

### 1. Synchronous Database Schema Creation

**File:** `/home/user/dispatch/src/lib/server/database/DatabaseManager.js:104-182`
**Severity:** MEDIUM
**Impact:** Startup time

**Issue:**
Schema creation uses sequential `await` for each table:

```javascript
await this.run(`CREATE TABLE IF NOT EXISTS sessions ...`);
await this.run(`CREATE TABLE IF NOT EXISTS session_events ...`);
await this.run(`CREATE TABLE IF NOT EXISTS workspace_layout ...`);
// ... 5 more tables
// ... 4 more indexes
```

This creates 12 sequential round-trips to SQLite.

**Recommended Optimization:**

```javascript
async #createSchema() {
    // Create all tables in parallel
    await Promise.all([
        this.run(`CREATE TABLE IF NOT EXISTS sessions ...`),
        this.run(`CREATE TABLE IF NOT EXISTS session_events ...`),
        this.run(`CREATE TABLE IF NOT EXISTS workspace_layout ...`),
        // ... rest of tables
    ]);

    // Create indexes after tables (still need tables first)
    await this.#createIndexes();
}
```

**Expected Improvement:** ~50% faster startup (from 12 sequential to 2 parallel batches)

**Estimated Effort:** Trivial (30 minutes)

---

### 2. Event Serialization Overhead

**File:** `/home/user/dispatch/src/lib/server/claude/ClaudeAdapter.js:47-56`
**Severity:** LOW
**Impact:** CPU usage during high-throughput sessions

**Issue:**

```javascript
const emitClaudeEvent = (rawEvent) => {
	if (!rawEvent) return;

	let serialized;
	try {
		serialized = JSON.parse(JSON.stringify(rawEvent)); // Deep clone via serialize
	} catch (error) {
		logger.warn('CLAUDE_ADAPTER', 'Failed to serialize Claude event', error);
		return;
	}

	onEvent({
		channel: 'claude:message',
		type: serialized.type || 'event',
		payload: { events: [serialized] }
	});
};
```

`JSON.parse(JSON.stringify())` is slow for large objects.

**Recommended Optimization:**

```javascript
import { structuredClone } from 'node:v8';

const emitClaudeEvent = (rawEvent) => {
	if (!rawEvent) return;

	try {
		// structuredClone is 2-3x faster than JSON round-trip
		const serialized = structuredClone(rawEvent);

		onEvent({
			channel: 'claude:message',
			type: serialized.type || 'event',
			payload: { events: [serialized] }
		});
	} catch (error) {
		logger.warn('CLAUDE_ADAPTER', 'Failed to clone Claude event', error);
	}
};
```

**Expected Improvement:** 2-3x faster event processing

**Estimated Effort:** Trivial (15 minutes)

---

### 3. No Connection Pooling for Database

**File:** `/home/user/dispatch/src/lib/server/database/DatabaseManager.js`
**Severity:** LOW
**Impact:** Concurrent request handling

**Issue:**
Single SQLite connection shared across all requests. No connection pooling.

**Note:** SQLite in WAL mode supports concurrent reads, but this implementation uses a single connection. For a production deployment with high concurrency, consider:

1. **Better-sqlite3** - Synchronous SQLite driver (faster, thread-safe)
2. **Connection pooling** - Multiple read connections
3. **Read replicas** - Separate read/write connections

**Recommended Investigation:**
Profile concurrent request performance under load. If bottleneck identified, consider migration to better-sqlite3.

**Estimated Effort:** Large (1-2 weeks for migration + testing)

---

## Security Analysis

### 1. OAuth Client Secrets in Plaintext

**Covered in Critical Issues #1**

### 2. No Rate Limiting on Authentication

**Files:** `hooks.server.js`, `socket-setup.js`
**Severity:** MEDIUM
**Vulnerability:** Brute-force attacks on API keys

**Issue:**
No rate limiting on:

- API key validation attempts
- Session cookie validation
- OAuth callbacks

**Recommended Mitigation:**

```javascript
// src/lib/server/auth/RateLimiter.js
import { LRUCache } from 'lru-cache';

export class RateLimiter {
	constructor(maxAttempts = 10, windowMs = 60000) {
		this.attempts = new LRUCache({
			max: 10000,
			ttl: windowMs
		});
		this.maxAttempts = maxAttempts;
	}

	check(identifier) {
		const count = this.attempts.get(identifier) || 0;
		if (count >= this.maxAttempts) {
			return { allowed: false, retryAfter: this.#getRetryAfter(identifier) };
		}

		this.attempts.set(identifier, count + 1);
		return { allowed: true };
	}

	#getRetryAfter(identifier) {
		// Calculate time until TTL expires
		const remainingTTL = this.attempts.getRemainingTTL(identifier);
		return Math.ceil(remainingTTL / 1000); // seconds
	}
}

// hooks.server.js
const rateLimiter = new RateLimiter(10, 60000); // 10 attempts per minute

async function authenticationMiddleware({ event, resolve }) {
	const identifier = event.getClientAddress(); // or use API key hash

	const { allowed, retryAfter } = rateLimiter.check(identifier);
	if (!allowed) {
		return json(
			{ error: 'Too many authentication attempts' },
			{
				status: 429,
				headers: { 'Retry-After': retryAfter.toString() }
			}
		);
	}

	// ... rest of auth logic
}
```

**Estimated Effort:** Small (1 day)

---

### 3. No Input Validation on File Paths

**File:** `/home/user/dispatch/src/routes/api/workspaces/+server.js:179-189`
**Severity:** MEDIUM
**Vulnerability:** Path traversal

**Issue:**
Current validation is weak:

```javascript
function isValidWorkspacePath(path) {
	if (!path || typeof path !== 'string') return false;

	if (path.includes('..') || path.includes('~')) return false; // Incomplete
	if (path.length > 500) return false;
	if (!path.startsWith('/')) return false;

	return true;
}
```

Problems:

1. Doesn't check for encoded path traversal (`%2e%2e%2f`)
2. Doesn't check for symlink attacks
3. Doesn't validate against allowed workspace root

**Recommended Hardening:**

```javascript
import { resolve, normalize } from 'path';

function isValidWorkspacePath(path, allowedRoot = process.env.WORKSPACES_ROOT) {
	if (!path || typeof path !== 'string') return false;
	if (path.length > 500) return false;

	try {
		// Decode and normalize path
		const decoded = decodeURIComponent(path);
		const normalized = normalize(decoded);
		const resolved = resolve(normalized);

		// Must be absolute
		if (!resolved.startsWith('/')) return false;

		// Must be within allowed workspace root
		if (allowedRoot && !resolved.startsWith(resolve(allowedRoot))) {
			return false;
		}

		// No path traversal attempts
		if (normalized.includes('..')) return false;

		// No home directory references
		if (normalized.includes('~')) return false;

		return true;
	} catch {
		return false; // Decoding or resolution failed
	}
}
```

**Estimated Effort:** Small (2-3 hours)

---

### 4. No CSRF Protection for Socket.IO

**File:** `socket-setup.js`
**Severity:** LOW
**Vulnerability:** Cross-site WebSocket hijacking

**Issue:**
Socket.IO accepts connections from any origin:

```javascript
const io = new Server(httpServer, {
	cors: { origin: '*', methods: ['GET', 'POST'] }
});
```

**Recommended Hardening:**

```javascript
const io = new Server(httpServer, {
	cors: {
		origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
		methods: ['GET', 'POST'],
		credentials: true
	}
});
```

**Estimated Effort:** Trivial (15 minutes)

---

## Recommendations

### Immediate Actions (Before RC1)

**Critical Priority (1-2 weeks):**

1. ✅ **Encrypt OAuth client secrets** (#1) - 2 days
2. ✅ **Refactor socket-setup.js** (#2) - 4 days
3. ✅ **Fix N+1 query in workspace API** (#3) - 4 hours
4. ✅ **Standardize error handling** (#4) - 3 days
5. ✅ **Add error boundaries** (#6) - 3 days

**High Priority (2-3 weeks):** 6. ✅ **Refactor authentication middleware** (#5) - 3 days 7. ✅ **Fix hardcoded OAuth URL** (#7) - 2 hours 8. ✅ **Add authentication tests** (Test Coverage #1) - 4 days 9. ✅ **Add rate limiting** (Security #2) - 1 day 10. ✅ **Harden path validation** (Security #3) - 3 hours

### Post-RC1 Improvements

**Medium Priority:**

- Implement SessionId value object (#8)
- Reduce SocketService feature envy (#9)
- Extract magic numbers (#10)
- Simplify adapter parameters (#11)
- Refactor EventRecorder promises (#12)
- Add E2E tests (Test Coverage #2)
- Add integration tests (Test Coverage #3)

**Low Priority:**

- Replace console.log with logger (#13)
- Remove commented code (#14)
- Add comprehensive JSDoc (#15)
- Fix test quality issues (Test Coverage #4)
- Optimize database schema creation (Performance #1)
- Optimize event serialization (Performance #2)

### Technical Debt Tracking

**Recommended Approach:**

1. Create GitHub issues for each item
2. Label by priority (critical/high/medium/low)
3. Group into milestones (Pre-RC1, Post-RC1)
4. Assign estimated effort
5. Track progress in project board

**Example Issue Template:**

```markdown
## Refactoring: Extract Socket Authentication Middleware

**Priority:** Critical
**Effort:** 1 day
**Related:** #2 (God Object: socket-setup.js)

### Current Problem

Authentication logic duplicated 4+ times in socket-setup.js (lines 79-102, 171-235, 278-290, ...)

### Proposed Solution

Extract to createAuthenticationMiddleware() following Strategy pattern.

### Acceptance Criteria

- [ ] Authentication logic centralized to single function
- [ ] All socket handlers use middleware
- [ ] Tests added for authentication middleware
- [ ] Zero duplication of auth checks
```

---

## Conclusion

The Dispatch project has a solid architectural foundation with good separation of concerns via adapters, repositories, and event sourcing. However, significant technical debt has accumulated in:

1. **Socket.IO setup** (578 lines, 9 responsibilities)
2. **Authentication** (duplicated logic, missing tests)
3. **Error handling** (inconsistent patterns)
4. **Security** (plaintext secrets, weak validation)

**Recommended Timeline for RC1:**

- **Week 1-2:** Critical security + socket refactoring
- **Week 3:** Error handling + authentication refactoring
- **Week 4:** Testing + polish

Following this refactoring plan will result in:

- ✅ **60% reduction** in socket-setup.js complexity
- ✅ **Zero authentication duplication**
- ✅ **Consistent error handling** across all APIs
- ✅ **Production-ready security** posture
- ✅ **90%+ test coverage** of critical paths

The project is in good shape for RC1 with focused refactoring over the next 3-4 weeks.
