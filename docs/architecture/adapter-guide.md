# Session Adapter Registration Guide

## Overview

Dispatch uses an **adapter pattern** to support multiple session types (PTY terminals, Claude Code, File Editor) through a unified interface. This guide shows how to add new session types by creating adapters and registering them with the session management system.

**Core Concept**: Each session type implements a standard adapter interface that wraps its specific functionality (node-pty, Claude SDK, etc.) while exposing a consistent API for session management.

## Architecture Overview

### Unified Session Management Flow

```
Client Request
    ↓
API Route (/api/sessions)
    ↓
SessionOrchestrator (simplified architecture)
    ↓
Session Adapter (PtyAdapter, ClaudeAdapter, FileEditorAdapter)
    ↓
Underlying Implementation (node-pty, @anthropic-ai/claude-code, custom)
    ↓
Events → Socket.IO → Client
```

### Key Components

1. **Session Adapters** - Wrap session-specific implementations
2. **SessionOrchestrator** - Manages session lifecycle (simplified architecture)
3. **Socket.IO Events** - Real-time event streaming
4. **API Routes** - REST endpoints for session CRUD

## Adapter Interface

All adapters must implement this interface:

```javascript
{
	kind: string,           // Session type identifier
	input: {
		write(data)         // Handle input data
	},
	close(),                // Terminate session
	[optional methods]      // Type-specific operations
}
```

### Event Callback Pattern

Adapters receive an `onEvent` callback for emitting events:

```javascript
onEvent({
	channel: string, // Event channel (e.g., 'pty:stdout', 'claude:message')
	type: string, // Event type (e.g., 'chunk', 'closed')
	payload: any // Event data
});
```

## Existing Adapter Examples

### PtyAdapter - Terminal Sessions

**Location**: `/src/lib/server/terminal/PtyAdapter.js`

**Purpose**: Wraps `node-pty` for terminal sessions

```javascript
import { SESSION_TYPE } from '../../shared/session-types.js';

export class PtyAdapter {
	async create({ cwd, options = {}, onEvent }) {
		// Lazy load node-pty
		const pty = await import('node-pty');

		// Prepare options with defaults
		const ptyOptions = {
			cwd: cwd || process.env.WORKSPACES_ROOT,
			cols: options.cols || 80,
			rows: options.rows || 24,
			name: options.name || 'xterm-256color',
			encoding: 'utf8',
			env: { ...process.env, ...options.env }
		};

		// Spawn terminal
		const term = pty.spawn(
			options.shell || process.env.SHELL || 'bash',
			options.args || [],
			ptyOptions
		);

		// Set up event handlers
		term.onData((data) => {
			onEvent({
				channel: 'pty:stdout',
				type: 'chunk',
				payload: new TextEncoder().encode(data)
			});
		});

		term.onExit((exitInfo) => {
			onEvent({
				channel: 'system:status',
				type: 'closed',
				payload: {
					exitCode: exitInfo.exitCode,
					signal: exitInfo.signal
				}
			});
		});

		// Return adapter interface
		return {
			kind: SESSION_TYPE.PTY,
			input: {
				write(data) {
					const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
					term.write(text);
				}
			},
			resize(cols, rows) {
				term.resize(cols, rows);
				onEvent({
					channel: 'pty:resize',
					type: 'dimensions',
					payload: { cols, rows }
				});
			},
			close() {
				term.kill();
			},
			get pid() {
				return term.pid;
			},
			get cols() {
				return term.cols;
			},
			get rows() {
				return term.rows;
			}
		};
	}
}
```

**Key Features**:

- Lazy loading of node-pty dependency
- Environment variable handling
- Terminal dimension management
- Process lifecycle events

### ClaudeAdapter - Claude Code Sessions

**Location**: `/src/lib/server/claude/ClaudeAdapter.js`

**Purpose**: Wraps `@anthropic-ai/claude-code` SDK

```javascript
import { SESSION_TYPE } from '../../shared/session-types.js';
import { buildClaudeOptions } from './claude-options.js';

export class ClaudeAdapter {
	async create({ cwd, options = {}, onEvent }) {
		// Lazy load Claude Code SDK
		const { query } = await import('@anthropic-ai/claude-code');

		// Build SDK options
		const claudeOptions = buildClaudeOptions({ ...options, cwd });

		let activeQuery = null;
		let isClosing = false;

		const emitClaudeEvent = (rawEvent) => {
			if (!rawEvent) return;

			// Serialize event (SDK events may have circular refs)
			const serialized = JSON.parse(JSON.stringify(rawEvent));

			onEvent({
				channel: 'claude:message',
				type: serialized.type || 'event',
				payload: { events: [serialized] }
			});
		};

		return {
			kind: SESSION_TYPE.CLAUDE,
			input: {
				async write(data) {
					if (isClosing) return;

					const message = typeof data === 'string' ? data : new TextDecoder().decode(data);

					// Create new query
					activeQuery = query({
						prompt: message,
						options: claudeOptions
					});

					// Stream events
					try {
						for await (const event of activeQuery) {
							if (isClosing) break;
							emitClaudeEvent(event);
						}
					} catch (error) {
						if (!isClosing) {
							onEvent({
								channel: 'claude:error',
								type: 'execution_error',
								payload: {
									error: error.message,
									stack: error.stack
								}
							});
						}
					}
				}
			},
			close() {
				isClosing = true;
				activeQuery = null;
			}
		};
	}
}
```

**Key Features**:

- Async streaming with `for await`
- Event serialization for Socket.IO
- Graceful error handling
- Closing state management

### FileEditorAdapter - File Editing Sessions

**Location**: `/src/lib/server/file-editor/FileEditorAdapter.js`

**Purpose**: Custom file browsing and editing

```javascript
import { EventEmitter } from 'node:events';
import { SESSION_TYPE } from '../../shared/session-types.js';

export class FileEditorAdapter {
	async create({ cwd, options = {}, onEvent }) {
		const workingDirectory = cwd || process.env.WORKSPACES_ROOT;

		const proc = new FileEditorProcess({
			cwd: workingDirectory,
			options,
			onEvent
		});

		await proc.initialize();

		return {
			kind: SESSION_TYPE.FILE_EDITOR,
			input: {
				write(data) {
					proc.handleInput(data);
				}
			},
			close() {
				proc.close();
			},
			getCwd() {
				return proc.getCwd();
			},
			isAlive() {
				return proc.isAlive();
			}
		};
	}
}

class FileEditorProcess extends EventEmitter {
	constructor({ cwd, options, onEvent }) {
		super();
		this.cwd = cwd;
		this.options = options;
		this.onEvent = onEvent;
		this.isActive = false;
	}

	async initialize() {
		this.isActive = true;

		this.onEvent({
			channel: 'file-editor:system',
			type: 'initialized',
			payload: {
				cwd: this.cwd,
				timestamp: Date.now()
			}
		});
	}

	handleInput(data) {
		const text = typeof data === 'string' ? data : new TextDecoder().decode(data);

		this.onEvent({
			channel: 'file-editor:input',
			type: 'received',
			payload: { data: text, timestamp: Date.now() }
		});
	}

	close() {
		this.isActive = false;
		this.onEvent({
			channel: 'file-editor:system',
			type: 'closed',
			payload: { timestamp: Date.now() }
		});
		this.removeAllListeners();
	}

	getCwd() {
		return this.cwd;
	}

	isAlive() {
		return this.isActive;
	}
}
```

**Key Features**:

- Custom EventEmitter-based process
- Flexible input handling
- Lifecycle management

## Step-by-Step: Adding a New Session Type

### Step 1: Define Session Type Constant

**File**: `/src/lib/shared/session-types.js`

```javascript
export const SESSION_TYPE = {
	PTY: 'pty',
	CLAUDE: 'claude',
	FILE_EDITOR: 'file-editor',
	// Add your new type
	JUPYTER: 'jupyter'
};
```

### Step 2: Create Adapter Class

**File**: `/src/lib/server/jupyter/JupyterAdapter.js`

```javascript
import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

/**
 * Jupyter adapter for Jupyter notebook sessions
 */
export class JupyterAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - Jupyter options
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		// Lazy load Jupyter kernel
		let jupyterKernel;
		try {
			jupyterKernel = await import('jupyter-kernel');
		} catch (error) {
			logger.error('JUPYTER_ADAPTER', 'Failed to load jupyter-kernel:', error);
			throw new Error(`Jupyter functionality not available: ${error.message}`);
		}

		// Prepare options
		const kernelOptions = {
			cwd: cwd || process.env.WORKSPACES_ROOT,
			kernelName: options.kernelName || 'python3',
			...options
		};

		logger.info('JUPYTER_ADAPTER', 'Starting Jupyter kernel:', kernelOptions);

		// Start kernel
		const kernel = await jupyterKernel.startKernel(kernelOptions);

		// Set up event handlers
		kernel.on('output', (output) => {
			onEvent({
				channel: 'jupyter:output',
				type: 'execution_result',
				payload: {
					data: output.data,
					executionCount: output.execution_count
				}
			});
		});

		kernel.on('error', (error) => {
			onEvent({
				channel: 'jupyter:error',
				type: 'error',
				payload: {
					ename: error.ename,
					evalue: error.evalue,
					traceback: error.traceback
				}
			});
		});

		kernel.on('exit', (exitInfo) => {
			logger.info('JUPYTER_ADAPTER', 'Kernel exited:', exitInfo);
			onEvent({
				channel: 'system:status',
				type: 'closed',
				payload: {
					exitCode: exitInfo.exitCode
				}
			});
		});

		// Return adapter interface
		return {
			kind: SESSION_TYPE.JUPYTER,
			input: {
				async write(data) {
					const code = typeof data === 'string' ? data : new TextDecoder().decode(data);

					// Execute code in kernel
					const result = await kernel.execute(code);

					// Emit execution event
					onEvent({
						channel: 'jupyter:execution',
						type: 'started',
						payload: {
							code,
							executionCount: result.execution_count
						}
					});
				}
			},
			interrupt() {
				kernel.interrupt();
			},
			restart() {
				kernel.restart();
			},
			close() {
				kernel.shutdown();
			},
			// Expose kernel info
			getKernelInfo() {
				return kernel.info();
			}
		};
	}
}
```

### Step 3: Register Adapter

**File**: `/src/lib/server/shared/services.js` (simplified architecture)

```javascript
import { PtyAdapter } from '../terminal/PtyAdapter.js';
import { ClaudeAdapter } from '../claude/ClaudeAdapter.js';
import { FileEditorAdapter } from '../file-editor/FileEditorAdapter.js';
import { JupyterAdapter } from '../jupyter/JupyterAdapter.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

// Initialize services
export async function initializeServices() {
	// ... other initialization ...

	// Register session adapters
	sessionOrchestrator.registerAdapter(SESSION_TYPE.PTY, new PtyAdapter());
	sessionOrchestrator.registerAdapter(SESSION_TYPE.CLAUDE, new ClaudeAdapter());
	sessionOrchestrator.registerAdapter(SESSION_TYPE.FILE_EDITOR, new FileEditorAdapter());

	// Register new adapter
	sessionOrchestrator.registerAdapter(SESSION_TYPE.JUPYTER, new JupyterAdapter());
}
```

### Step 4: Create Frontend Components

**File**: `/src/lib/client/jupyter/JupyterPane.svelte`

```svelte
<script>
	import { RunSessionClient } from '../shared/services/RunSessionClient.js';
	import { getClientId } from '../shared/utils/uuid.js';

	let { sessionId } = $props();

	const client = new RunSessionClient();
	const clientId = getClientId();

	let output = $state([]);
	let input = $state('');
	let executing = $state(false);

	async function handleEvent(event) {
		if (event.channel === 'jupyter:output') {
			output.push(event.payload);
		} else if (event.channel === 'jupyter:error') {
			output.push({ type: 'error', ...event.payload });
		}
	}

	async function executeCode() {
		if (!input.trim() || executing) return;

		executing = true;
		try {
			client.sendInput(sessionId, input);
			input = '';
		} finally {
			executing = false;
		}
	}

	onMount(async () => {
		// Authenticate
		const authKey = localStorage.getItem('dispatch-auth-token');
		await client.authenticate(authKey);

		// Attach to session
		await client.attachToRunSession(sessionId, handleEvent);
	});

	onDestroy(() => {
		client.detachFromRunSession(sessionId);
	});
</script>

<div class="jupyter-pane">
	<div class="output">
		{#each output as item}
			{#if item.type === 'error'}
				<pre class="error">{item.traceback.join('\n')}</pre>
			{:else}
				<pre>{JSON.stringify(item.data, null, 2)}</pre>
			{/if}
		{/each}
	</div>

	<div class="input-area">
		<textarea bind:value={input} placeholder="Enter code..."></textarea>
		<button onclick={executeCode} disabled={executing}>
			{executing ? 'Executing...' : 'Execute'}
		</button>
	</div>
</div>
```

### Step 5: Register Session Module

**File**: `/src/lib/client/shared/session-modules/index.js`

```javascript
import { SESSION_TYPE } from '../../../shared/session-types.js';

export const sessionModules = {
	[SESSION_TYPE.PTY]: {
		header: () => import('../../terminal/TerminalHeader.svelte'),
		pane: () => import('../../terminal/TerminalPane.svelte')
	},
	[SESSION_TYPE.CLAUDE]: {
		header: () => import('../../claude/ClaudeHeader.svelte'),
		pane: () => import('../../claude/ClaudePane.svelte')
	},
	[SESSION_TYPE.FILE_EDITOR]: {
		header: () => import('../../file-editor/FileEditorHeader.svelte'),
		pane: () => import('../../file-editor/FileEditorPane.svelte')
	},
	// Register new module
	[SESSION_TYPE.JUPYTER]: {
		header: () => import('../../jupyter/JupyterHeader.svelte'),
		pane: () => import('../../jupyter/JupyterPane.svelte')
	}
};

export async function getSessionModule(sessionType) {
	const module = sessionModules[sessionType];
	if (!module) {
		throw new Error(`Unknown session type: ${sessionType}`);
	}
	return module;
}
```

## Event Channel Naming Conventions

Use consistent channel naming for events:

```
<session-type>:<category>

Examples:
- pty:stdout          (terminal output)
- pty:resize          (terminal dimension change)
- claude:message      (Claude Code message)
- claude:error        (Claude Code error)
- jupyter:output      (Jupyter cell output)
- jupyter:execution   (code execution)
- system:status       (session lifecycle events)
```

## Testing New Adapters

### Unit Test Example

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JupyterAdapter } from './JupyterAdapter.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

describe('JupyterAdapter', () => {
	let adapter;
	let onEventSpy;
	let mockKernel;

	beforeEach(() => {
		adapter = new JupyterAdapter();
		onEventSpy = vi.fn();

		// Mock jupyter-kernel module
		mockKernel = {
			execute: vi.fn().mockResolvedValue({ execution_count: 1 }),
			interrupt: vi.fn(),
			shutdown: vi.fn(),
			on: vi.fn()
		};

		vi.mock('jupyter-kernel', () => ({
			startKernel: vi.fn().mockResolvedValue(mockKernel)
		}));
	});

	it('should create adapter with correct kind', async () => {
		const instance = await adapter.create({
			cwd: '/workspace',
			options: {},
			onEvent: onEventSpy
		});

		expect(instance.kind).toBe(SESSION_TYPE.JUPYTER);
	});

	it('should execute code and emit events', async () => {
		const instance = await adapter.create({
			cwd: '/workspace',
			options: {},
			onEvent: onEventSpy
		});

		await instance.input.write('print("Hello")');

		expect(mockKernel.execute).toHaveBeenCalledWith('print("Hello")');
		expect(onEventSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				channel: 'jupyter:execution',
				type: 'started'
			})
		);
	});

	it('should close kernel on close', async () => {
		const instance = await adapter.create({
			cwd: '/workspace',
			options: {},
			onEvent: onEventSpy
		});

		instance.close();

		expect(mockKernel.shutdown).toHaveBeenCalled();
	});
});
```

### Integration Test Example

```javascript
import { describe, it, expect } from 'vitest';
import { createTestServer } from '../../../tests/helpers/test-server.js';

describe('Jupyter Session Integration', () => {
	let server;

	beforeAll(async () => {
		server = await createTestServer();
	});

	afterAll(async () => {
		await server.close();
	});

	it('should create and execute Jupyter session', async () => {
		// Create session
		const createRes = await fetch(`${server.url}/api/sessions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				kind: 'jupyter',
				cwd: '/workspace',
				options: { kernelName: 'python3' }
			})
		});

		const { runId } = await createRes.json();
		expect(runId).toBeDefined();

		// Connect via Socket.IO
		const socket = io(server.url);
		const events = [];

		socket.on('run:event', (event) => {
			events.push(event);
		});

		await new Promise((resolve) => {
			socket.emit('run:attach', { runId, afterSeq: 0 }, resolve);
		});

		// Send code execution
		socket.emit('run:input', {
			runId,
			data: 'print("Hello from Jupyter")'
		});

		// Wait for output
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const outputEvents = events.filter((e) => e.channel === 'jupyter:output');
		expect(outputEvents.length).toBeGreaterThan(0);
	});
});
```

## Common Adapter Patterns

### Lazy Loading Dependencies

```javascript
async create({ cwd, options, onEvent }) {
	// Lazy load to handle missing dependencies gracefully
	let dependency;
	try {
		dependency = await import('expensive-module');
	} catch (error) {
		throw new Error(`Module not available: ${error.message}`);
	}

	// Use dependency...
}
```

### Graceful Shutdown

```javascript
return {
	kind: SESSION_TYPE.CUSTOM,
	input: {
		/* ... */
	},
	close() {
		// Clean up resources
		if (this.activeProcess) {
			this.activeProcess.kill();
			this.activeProcess = null;
		}

		// Emit close event
		onEvent({
			channel: 'system:status',
			type: 'closed',
			payload: { timestamp: Date.now() }
		});
	}
};
```

### Error Propagation

```javascript
async write(data) {
	try {
		const result = await this.execute(data);
		onEvent({
			channel: 'custom:result',
			type: 'success',
			payload: result
		});
	} catch (error) {
		onEvent({
			channel: 'custom:error',
			type: 'execution_error',
			payload: {
				error: error.message,
				stack: error.stack
			}
		});
	}
}
```

## Troubleshooting

### Adapter Not Found

**Symptom**: Error "No adapter registered for type: xyz"

**Solution**: Verify adapter is registered in `services.js`:

```javascript
sessionOrchestrator.registerAdapter(SESSION_TYPE.XYZ, new XyzAdapter());
```

### Events Not Received

**Symptom**: Client doesn't receive events from adapter

**Solution**:

1. Verify `onEvent()` is called with correct channel/type
2. Check Socket.IO connection status
3. Verify client is attached to session via `run:attach`

### Session Doesn't Close

**Symptom**: Session stays active after close

**Solution**:

1. Implement `close()` method in adapter
2. Emit `system:status:closed` event
3. Clean up resources (processes, timers, etc.)

## See Also

- [MVVM Patterns Guide](./mvvm-patterns.md) - Frontend architecture patterns
- [Error Handling Guide](../contributing/error-handling.md) - Error handling best practices
- [Testing Quick Start](../../docs/testing-quickstart.md) - Testing setup and helpers
- [Session Types](../../lib/shared/session-types.js) - Session type constants
