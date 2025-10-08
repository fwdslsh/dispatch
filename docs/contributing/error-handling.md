# Error Handling Patterns

## Overview

Dispatch uses standardized error handling patterns across the codebase to ensure consistent error propagation, user-friendly error messages, and robust failure recovery. This guide documents the patterns used in services, ViewModels, API routes, and Socket.IO handlers.

**Core Principles**:
- Fail gracefully with user-friendly messages
- Log errors with context for debugging
- Propagate errors to appropriate layers
- Never expose sensitive information in error messages
- Always clean up resources in `finally` blocks

## Error Handling Layers

### 1. Service Layer (API Clients)

Services handle HTTP/WebSocket communication errors and transform them into application-specific errors.

**Pattern**: Try-catch with response validation

```javascript
// SessionApiClient.js
export class SessionApiClient {
	async list({ workspace, includeAll = false } = {}) {
		try {
			const params = new URLSearchParams();
			if (workspace) params.append('workspace', workspace);
			if (includeAll) params.append('include', 'all');

			const url = `${this.baseUrl}/api/sessions${params.toString() ? '?' + params : ''}`;
			const response = await fetch(url, {
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);
			return { sessions: data.sessions || [] };
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to list sessions:', error);
			}
			throw error; // Re-throw for ViewModel layer
		}
	}

	async handleResponse(response) {
		if (!response.ok) {
			const errorBody = await response.text();
			let errorMessage;

			try {
				const errorData = JSON.parse(errorBody);
				errorMessage = errorData.error || errorData.message || response.statusText;
			} catch {
				errorMessage = errorBody || response.statusText;
			}

			const error = new Error(errorMessage);
			error.status = response.status;
			error.statusText = response.statusText;

			// Add specific error codes
			if (errorMessage.includes('node-pty failed to load')) {
				error.code = 'TERMINAL_UNAVAILABLE';
			} else if (errorMessage.includes('Vite module runner')) {
				error.code = 'SERVER_RESTARTING';
			}

			throw error;
		}

		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			return response.json();
		}

		return response.text();
	}
}
```

**Key Features**:
- Centralized response handling
- Error code extraction
- Specific error codes for common issues
- Debug logging with conditional output
- Error object enrichment (status, statusText, code)

### 2. ViewModel Layer (Business Logic)

ViewModels handle service errors and update reactive state for UI display.

**Pattern**: Try-catch-finally with state management

```javascript
// SessionViewModel.svelte.js
export class SessionViewModel {
	constructor(appStateManager, sessionApi) {
		this.appStateManager = appStateManager;
		this.sessionApi = sessionApi;

		// Operation state tracking
		this.operationState = $state({
			loading: false,
			creating: false,
			error: null,
			lastOperation: null
		});
	}

	async createSession({ type, workspacePath, options = {} }) {
		// Prevent duplicate operations
		if (this.operationState.creating) {
			log.warn('Session creation already in progress');
			return null;
		}

		this.operationState.creating = true;
		this.operationState.error = null;
		this.operationState.lastOperation = 'create';

		// Set global loading state
		this.appStateManager.ui.setLoading('creatingSession', true);

		try {
			const sessionData = { type, workspacePath, ...options };

			log.info('Creating session', sessionData);
			const result = await this.sessionApi.create(sessionData);

			const newSession = this.validateAndNormalizeSession(result);
			log.info('Session created successfully', newSession.id);

			// Update global state
			this.appStateManager.createSession(newSession);

			return newSession;
		} catch (error) {
			log.error('Failed to create session', error);

			// Set local error state
			this.operationState.error = error.message || 'Failed to create session';

			// Propagate to global error state
			this.appStateManager.sessions.setError(error.message);

			return null; // Return null instead of throwing
		} finally {
			// Always clean up operation state
			this.operationState.creating = false;
			this.appStateManager.ui.setLoading('creatingSession', false);
		}
	}

	async loadSessions(filters = {}) {
		this.operationState.loading = true;
		this.operationState.error = null;
		this.operationState.lastOperation = 'load';

		this.appStateManager.sessions.setLoading(true);

		try {
			const result = await this.sessionApi.list(filters);
			log.info('Loaded sessions from API', result.sessions?.length || 0);

			const validatedSessions = this.validateAndNormalizeSessions(
				result.sessions || []
			);

			this.appStateManager.loadSessions(validatedSessions);

			log.info('Successfully loaded sessions');
		} catch (error) {
			log.error('Failed to load sessions', error);

			this.operationState.error = error.message || 'Failed to load sessions';
			this.appStateManager.sessions.setError(error.message);
		} finally {
			this.operationState.loading = false;
			this.appStateManager.sessions.setLoading(false);
		}
	}

	// Error state management
	clearError() {
		this.operationState.error = null;
		this.appStateManager.sessions.clearError();
	}

	getCurrentError() {
		return this.operationState.error || this.appStateManager.ui.errors.sessions;
	}
}
```

**Key Features**:
- Operation state tracking (loading, creating, error)
- Prevent duplicate operations
- User-friendly error messages
- Error propagation to global state
- Return null on error instead of throwing
- Always clean up in `finally` block

### 3. Component Layer (Views)

Components display errors from ViewModels and handle user interaction errors.

**Pattern**: Reactive error display with user actions

```svelte
<script>
	import { SessionViewModel } from './state/SessionViewModel.svelte.js';
	import { useServiceContainer } from './services/ServiceContainer.svelte.js';

	const container = useServiceContainer();
	const appState = await container.get('appStateManager');
	const sessionApi = await container.get('sessionApi');

	const viewModel = new SessionViewModel(appState, sessionApi);

	// Reactive error binding
	const error = $derived(viewModel.operationState.error);
	const loading = $derived(viewModel.operationState.loading);

	async function handleCreateSession() {
		const result = await viewModel.createSession({
			type: 'pty',
			workspacePath: '/workspace'
		});

		if (result) {
			// Success - UI updates automatically via reactive state
			console.log('Session created:', result.id);
		} else {
			// Error - displayed via error binding
			console.error('Failed to create session');
		}
	}
</script>

<div class="session-manager">
	{#if loading}
		<div class="loading-indicator">
			Creating session...
		</div>
	{/if}

	{#if error}
		<div class="error-banner" role="alert">
			<span class="error-icon">⚠️</span>
			<span class="error-message">{error}</span>
			<button onclick={() => viewModel.clearError()}>
				Dismiss
			</button>
		</div>
	{/if}

	<button onclick={handleCreateSession} disabled={loading}>
		Create Session
	</button>
</div>

<style>
	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background-color: var(--error-bg);
		color: var(--error-text);
		border-radius: 4px;
		margin-bottom: 1rem;
	}
</style>
```

**Key Features**:
- Reactive error display via `$derived`
- User-friendly error UI
- Dismissible error messages
- Loading state feedback
- Accessibility (role="alert")

### 4. Socket.IO Event Handlers

Socket.IO handlers manage real-time communication errors and connection failures.

**Pattern**: Event-based error handling with reconnection

```javascript
// RunSessionClient.js
export class RunSessionClient {
	constructor(config = {}) {
		this.config = config;
		this.socket = null;
		this.connected = false;
		this.authenticated = false;
		this.logger = createLogger('RunSessionClient');
		this.connect();
	}

	connect() {
		if (this.socket?.connected) return;

		const socketUrl = this.config.socketUrl || window.location.origin;
		this.socket = io(socketUrl, { path: '/socket.io' });

		this.socket.on('connect', () => {
			this.logger.info('Connected to server');
			this.connected = true;
			this.identifyClient();
		});

		this.socket.on('disconnect', () => {
			console.log('RunSessionClient: Disconnected from server');
			this.connected = false;
			this.authenticated = false;
		});

		this.socket.on('run:event', (event) => {
			this.handleRunEvent(event);
		});

		this.socket.on('run:error', (error) => {
			console.error('RunSessionClient: Run error:', error);

			// Forward error to attached session handler
			const attachment = this.attachedSessions.get(error.runId);
			if (attachment?.onError) {
				attachment.onError(error);
			}
		});

		this.socket.on('connect_error', (error) => {
			console.error('RunSessionClient: Connection error:', error);
			this.connected = false;
			this.authenticated = false;
		});
	}

	async authenticate(key) {
		return new Promise((resolve, reject) => {
			if (!this.connected) {
				reject(new Error('Not connected to server'));
				return;
			}

			this.socket.emit(
				'client:hello',
				{ clientId: this.clientId, terminalKey: key },
				(response) => {
					if (response?.success) {
						this.authenticated = true;
						resolve();
					} else {
						reject(new Error(response?.error || 'Authentication failed'));
					}
				}
			);
		});
	}

	async attachToRunSession(runId, onEvent, afterSeq = 0, onError = null) {
		return new Promise((resolve, reject) => {
			if (!this.authenticated) {
				reject(new Error('Not authenticated'));
				return;
			}

			this.socket.emit('run:attach', { runId, afterSeq }, (response) => {
				if (response?.success) {
					// Store attachment with error handler
					this.attachedSessions.set(runId, {
						lastSeq: afterSeq,
						onEvent,
						onError
					});

					resolve({
						runId,
						backlogEvents: response.events?.length || 0
					});
				} else {
					reject(new Error(response?.error || 'Failed to attach to run session'));
				}
			});
		});
	}

	sendInput(runId, data) {
		if (!this.authenticated) {
			throw new Error('Not authenticated');
		}

		this.socket.emit('run:input', { runId, data });
	}

	// Graceful cleanup
	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
		this.connected = false;
		this.authenticated = false;
		this.attachedSessions.clear();
	}
}
```

**Key Features**:
- Connection state tracking
- Error event handlers
- Promise-based async operations
- Error callbacks for session-specific errors
- Graceful cleanup on disconnect

### 5. API Route Handlers

API routes validate input, handle errors, and return consistent error responses.

**Pattern**: Input validation with structured error responses

```javascript
// routes/api/sessions/+server.js
import { json, error } from '@sveltejs/kit';
import { services } from '$lib/server/shared/index.js';

export async function POST({ request }) {
	try {
		const body = await request.json();

		// Validate required fields
		if (!body.kind) {
			throw error(400, 'Missing required field: kind');
		}

		if (!body.cwd) {
			throw error(400, 'Missing required field: cwd');
		}

		// Validate session type
		const validTypes = ['pty', 'claude', 'file-editor'];
		if (!validTypes.includes(body.kind)) {
			throw error(400, `Invalid session type: ${body.kind}. Must be one of: ${validTypes.join(', ')}`);
		}

		// Create session via orchestrator
		const sessionOrchestrator = services.sessionOrchestrator;
		const runId = await sessionOrchestrator.createSession(
			body.kind,
			body.cwd,
			body.options || {}
		);

		return json({ runId, success: true });
	} catch (err) {
		console.error('POST /api/sessions error:', err);

		// Handle known error types
		if (err.status) {
			// SvelteKit error - already has status
			throw err;
		}

		// Handle adapter errors
		if (err.message?.includes('not available')) {
			throw error(503, {
				error: err.message,
				code: 'SERVICE_UNAVAILABLE'
			});
		}

		// Generic server error
		throw error(500, {
			error: 'Failed to create session',
			details: err.message
		});
	}
}

export async function DELETE({ url }) {
	try {
		const runId = url.searchParams.get('runId');

		if (!runId) {
			throw error(400, 'Missing required parameter: runId');
		}

		const sessionOrchestrator = services.sessionOrchestrator;
		await sessionOrchestrator.deleteSession(runId);

		return json({ success: true });
	} catch (err) {
		console.error('DELETE /api/sessions error:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, {
			error: 'Failed to delete session',
			details: err.message
		});
	}
}
```

**Key Features**:
- Input validation with clear error messages
- Structured error responses
- HTTP status code mapping
- Error code classification
- Detailed logging with context

### 6. Adapter Layer

Adapters handle external library errors and emit error events.

**Pattern**: Try-catch with error event emission

```javascript
// ClaudeAdapter.js
export class ClaudeAdapter {
	async create({ cwd, options = {}, onEvent }) {
		const { query } = await import('@anthropic-ai/claude-code');

		const claudeOptions = buildClaudeOptions({ ...options, cwd });

		let activeQuery = null;
		let isClosing = false;

		return {
			kind: SESSION_TYPE.CLAUDE,
			input: {
				async write(data) {
					if (isClosing) {
						logger.warn('CLAUDE_ADAPTER', 'Ignoring input - adapter is closing');
						return;
					}

					const message = typeof data === 'string'
						? data
						: new TextDecoder().decode(data);

					activeQuery = query({
						prompt: message,
						options: claudeOptions
					});

					try {
						for await (const event of activeQuery) {
							if (isClosing) break;
							emitClaudeEvent(event);
						}
					} catch (error) {
						if (!isClosing) {
							logger.error('CLAUDE_ADAPTER', 'Claude query error:', error);

							// Emit error event to client
							onEvent({
								channel: 'claude:error',
								type: 'execution_error',
								payload: {
									error: error.message,
									stack: error.stack,
									timestamp: Date.now()
								}
							});
						}
					}
				}
			},
			close() {
				try {
					isClosing = true;

					if (activeQuery) {
						logger.info('CLAUDE_ADAPTER', 'Closing gracefully');
					}
				} catch (error) {
					logger.warn('CLAUDE_ADAPTER', 'Error during close:', error.message);
				} finally {
					activeQuery = null;
				}
			}
		};
	}
}
```

**Key Features**:
- Graceful error handling during execution
- Error event emission to clients
- State-aware error handling (isClosing)
- Error logging with context
- Resource cleanup in `finally`

## Error Message Guidelines

### User-Facing Messages

✅ **Good**: "Failed to create session. Please try again."
❌ **Bad**: "Error: ENOENT: no such file or directory"

✅ **Good**: "Unable to connect to server. Check your connection."
❌ **Bad**: "fetch failed: TypeError: Failed to fetch"

✅ **Good**: "Terminal unavailable. Please contact administrator."
❌ **Bad**: "node-pty.node is not a valid Win32 application"

### Log Messages

Include context for debugging:

```javascript
log.error('Failed to create session', {
	sessionType: type,
	workspacePath,
	error: error.message,
	stack: error.stack
});
```

### Error Codes

Use specific codes for common errors:

```javascript
const ErrorCodes = {
	TERMINAL_UNAVAILABLE: 'TERMINAL_UNAVAILABLE',
	SERVER_RESTARTING: 'SERVER_RESTARTING',
	NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
	SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
	INVALID_INPUT: 'INVALID_INPUT'
};
```

## Async Error Patterns

### Promise-based APIs

```javascript
async function fetchData() {
	try {
		const response = await fetch('/api/data');
		return await response.json();
	} catch (error) {
		console.error('Failed to fetch data:', error);
		throw error; // Re-throw for caller to handle
	}
}
```

### Event-based APIs

```javascript
socket.on('error', (error) => {
	console.error('Socket error:', error);
	// Emit to error handler
	errorHandler.handleSocketError(error);
});
```

### Callback-based APIs

```javascript
function operationWithCallback(callback) {
	try {
		const result = performOperation();
		callback(null, result);
	} catch (error) {
		callback(error);
	}
}
```

## Resource Cleanup

Always clean up resources in `finally` blocks:

```javascript
async function processData() {
	let resource = null;

	try {
		resource = await acquireResource();
		return await processResource(resource);
	} catch (error) {
		console.error('Processing failed:', error);
		throw error;
	} finally {
		// Always clean up, even if error occurred
		if (resource) {
			await resource.release();
		}
	}
}
```

## Error Boundaries (Future Enhancement)

Consider adding error boundaries for component-level error handling:

```svelte
<!-- ErrorBoundary.svelte -->
<script>
	let { children, fallback } = $props();
	let error = $state(null);

	function handleError(event) {
		error = event.detail.error;
		console.error('Component error:', error);
	}
</script>

{#if error}
	{@render fallback?.(error)}
{:else}
	{@render children?.()}
{/if}
```

## Testing Error Handling

### Unit Test Example

```javascript
import { describe, it, expect, vi } from 'vitest';
import { SessionViewModel } from './SessionViewModel.svelte.js';

describe('SessionViewModel Error Handling', () => {
	it('should handle API errors gracefully', async () => {
		const mockApi = {
			create: vi.fn().mockRejectedValue(new Error('API Error'))
		};

		const mockAppState = {
			createSession: vi.fn(),
			sessions: { setError: vi.fn() },
			ui: { setLoading: vi.fn() }
		};

		const viewModel = new SessionViewModel(mockAppState, mockApi);

		const result = await viewModel.createSession({
			type: 'pty',
			workspacePath: '/workspace'
		});

		// Should return null on error
		expect(result).toBeNull();

		// Should set error state
		expect(viewModel.operationState.error).toBe('API Error');

		// Should propagate to global state
		expect(mockAppState.sessions.setError).toHaveBeenCalledWith('API Error');

		// Should clean up loading state
		expect(viewModel.operationState.creating).toBe(false);
	});
});
```

## Common Pitfalls

### ❌ Swallowing Errors

```javascript
// WRONG - error is lost
try {
	await riskyOperation();
} catch (error) {
	// Empty catch - error disappears
}
```

```javascript
// CORRECT - log and handle
try {
	await riskyOperation();
} catch (error) {
	console.error('Operation failed:', error);
	this.error = error.message;
}
```

### ❌ Not Cleaning Up

```javascript
// WRONG - resource leak on error
async function process() {
	const resource = await acquire();
	await use(resource); // May throw
	await release(resource); // Never called if error
}
```

```javascript
// CORRECT - always clean up
async function process() {
	let resource;
	try {
		resource = await acquire();
		await use(resource);
	} finally {
		if (resource) {
			await release(resource);
		}
	}
}
```

### ❌ Exposing Sensitive Information

```javascript
// WRONG - exposes internal details
catch (error) {
	return { error: error.stack }; // Stack trace to user!
}
```

```javascript
// CORRECT - user-friendly message
catch (error) {
	console.error('Internal error:', error); // Log full details
	return { error: 'Operation failed. Please try again.' };
}
```

## See Also

- [MVVM Patterns Guide](../architecture/mvvm-patterns.md) - ViewModel architecture
- [Adapter Registration Guide](../architecture/adapter-guide.md) - Adapter error handling
- [Testing Quick Start](../../docs/testing-quickstart.md) - Testing error scenarios
- [API Documentation](../../docs/reference/api-reference.md) - API error responses
