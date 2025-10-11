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

## Settings Registration (Optional)

Session adapters can optionally provide settings UI that automatically appears in the Settings page under the "Sessions" category. This eliminates the need to manually edit core settings files.

### Step 6: Add Settings Section to Session Module

**File**: `/src/lib/client/jupyter/jupyter.js`

```javascript
import JupyterPane from './JupyterPane.svelte';
import JupyterHeader from './JupyterHeader.svelte';
import JupyterSettingsSection from './JupyterSettings.svelte';
import JupyterIcon from '../shared/components/Icons/JupyterIcon.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

export const jupyterSessionModule = {
	type: SESSION_TYPE.JUPYTER,
	component: JupyterPane,
	header: JupyterHeader,

	// Settings page section (auto-registered by session-modules/index.js)
	settingsSection: {
		id: 'jupyter',
		label: 'Jupyter',
		icon: JupyterIcon,
		component: JupyterSettingsSection,
		navAriaLabel: 'Jupyter kernel and notebook settings',
		order: 71 // Display order (70-79 reserved for session types)
	},

	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			kernelName: session.kernelName || 'python3',
			workspacePath: session.workspacePath
		};
	},

	prepareHeaderProps(session = {}, options = {}) {
		const { onClose, index } = options;
		return { session, onClose, index };
	}
};
```

### Settings Section Component

**File**: `/src/lib/client/jupyter/JupyterSettings.svelte`

```svelte
<script>
	import { settingsService } from '../shared/services/SettingsService.svelte.js';
	import Button from '../shared/components/Button.svelte';
	import Input from '../shared/components/Input.svelte';

	let settings = $state({
		defaultKernel: '',
		autoRestart: false,
		timeout: 30
	});

	let saveStatus = $state('');
	let saving = $state(false);

	onMount(() => {
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}
		updateSettingsFromService();
	});

	function updateSettingsFromService() {
		settings = {
			defaultKernel: settingsService.get('jupyter.defaultKernel', 'python3'),
			autoRestart: settingsService.get('jupyter.autoRestart', false),
			timeout: settingsService.get('jupyter.timeout', 30)
		};
	}

	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Save as client overrides
			Object.entries(settings).forEach(([key, value]) => {
				settingsService.setClientOverride(`jupyter.${key}`, value);
			});

			saveStatus = 'Jupyter settings saved successfully';
			setTimeout(() => { saveStatus = ''; }, 3000);
		} catch (error) {
			console.error('Failed to save Jupyter settings:', error);
			saveStatus = 'Failed to save settings';
		} finally {
			saving = false;
		}
	}

	async function resetToDefaults() {
		settingsService.resetClientOverridesForCategory('jupyter');
		updateSettingsFromService();
		saveStatus = 'Settings reset to defaults';
		setTimeout(() => { saveStatus = ''; }, 3000);
	}
</script>

<div class="jupyter-settings">
	<div class="section-header">
		<h3>JUPYTER</h3>
		<p class="section-description">
			Configure default settings for Jupyter notebook sessions.
		</p>
	</div>

	<h4>SESSION DEFAULTS</h4>

	<div class="form-group">
		<label for="default-kernel">Default Kernel</label>
		<Input
			id="default-kernel"
			bind:value={settings.defaultKernel}
			placeholder="python3"
		/>
	</div>

	<div class="form-group">
		<label for="timeout">Execution Timeout (seconds)</label>
		<Input
			id="timeout"
			type="number"
			bind:value={settings.timeout}
			min="1"
			max="300"
		/>
	</div>

	<div class="form-group">
		<label>
			<input type="checkbox" bind:checked={settings.autoRestart} />
			Auto-restart kernel on error
		</label>
	</div>

	<footer class="settings-footer">
		<div class="settings-footer__status">{saveStatus}</div>
		<div class="settings-footer__actions">
			<Button onclick={resetToDefaults} variant="ghost" size="small" disabled={saving}>
				Reset Defaults
			</Button>
			<Button onclick={saveSettings} variant="primary" size="small" disabled={saving} loading={saving}>
				{saving ? 'Saving...' : 'Save Settings'}
			</Button>
		</div>
	</footer>
</div>
```

### How Settings Registration Works

1. **Automatic Registration**: When you define `settingsSection` in your session module, it's automatically registered by `/src/lib/client/shared/session-modules/index.js`.

2. **Registry System**: The settings registry (`/src/lib/client/settings/registry/settings-registry.js`) manages all settings sections with ordering, categorization, and dynamic discovery.

3. **No Core Changes**: Adding settings for a new session type requires NO changes to core settings files - just add the `settingsSection` property to your module definition.

4. **Category Organization**:
   - `core` (order 10-39): Application-wide settings
   - `auth` (order 40-59): Authentication settings
   - `connectivity` (order 60-69): Network and tunnel settings
   - `sessions` (order 70-89): Session-type specific settings
   - `other` (order 90+): Miscellaneous settings

### Settings Section API

```javascript
settingsSection: {
	id: string,              // Unique identifier for the section
	label: string,           // Display name in navigation
	icon: Component,         // Svelte icon component
	component: Component,    // Svelte settings page component
	navAriaLabel: string,    // Accessibility label for navigation
	order: number,           // Display order (optional, default: 100)
	category: string         // Category grouping (optional, default: 'sessions')
}
```

**Example Real Implementation**: See `/src/lib/client/claude/claude.js` for Claude's settings section which combines authentication and session defaults in a single comprehensive UI.

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

### Settings Section Not Appearing

**Symptom**: Settings section doesn't appear in Settings page

**Solution**:

1. Verify `settingsSection` is defined in session module
2. Check that session module is registered in `/src/lib/client/shared/session-modules/index.js`
3. Inspect browser console for registration warnings
4. Verify component import paths are correct

## See Also

- [MVVM Patterns Guide](./mvvm-patterns.md) - Frontend architecture patterns
- [Error Handling Guide](../contributing/error-handling.md) - Error handling best practices
- [Testing Quick Start](../../docs/testing-quickstart.md) - Testing setup and helpers
- [Session Types](../../lib/shared/session-types.js) - Session type constants
