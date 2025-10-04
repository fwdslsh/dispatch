# Adapter Registration Guide

**Last Updated**: 2025-10-01
**Audience**: Contributors adding new session types to Dispatch

## Overview

Dispatch uses the **Adapter Pattern** to support multiple session types (Terminal/PTY, Claude Code, File Editor) through a unified interface. This guide explains how to create and register new adapters to extend Dispatch with custom session types.

## Architecture Overview

### The Adapter Pattern in Dispatch

```
┌─────────────────────────────────────┐
│     RunSessionManager (Core)         │
│  - Unified session lifecycle         │
│  - Event sourcing & replay           │
│  - Multi-client synchronization      │
└──────────────┬──────────────────────┘
               │
               │ registers adapters
               │
       ┌───────┴────────┬─────────────┬──────────────┐
       │                │             │              │
 ┌─────▼─────┐   ┌─────▼──────┐  ┌──▼──────────┐   ...
 │PtyAdapter │   │ClaudeAdapter│  │FileEditor   │
 │(Terminal) │   │(AI Sessions)│  │Adapter      │
 └───────────┘   └─────────────┘  └─────────────┘
```

**Key Concept**: Each adapter implements the same interface, allowing RunSessionManager to treat all session types uniformly while delegating type-specific behavior to adapters.

## File Locations

### Server-Side Structure

```
src/lib/server/
├── runtime/
│   └── RunSessionManager.js       # Core session manager
├── terminal/
│   └── PtyAdapter.js               # Terminal/PTY adapter
├── claude/
│   └── ClaudeAdapter.js            # Claude Code adapter
├── file-editor/
│   └── FileEditorAdapter.js        # File editor adapter
└── shared/
    └── index.js                    # Adapter registration
```

### Client-Side Structure

```
src/lib/client/
├── terminal/
│   └── TerminalPane.svelte         # UI for terminal sessions
├── claude/
│   └── ClaudePane.svelte           # UI for Claude sessions
├── file-editor/
│   └── FileEditorPane.svelte       # UI for file editor sessions
└── shared/
    └── session-modules/
        └── index.js                # UI module registration
```

## Minimal Working Adapter Example

### Step 1: Create the Adapter Class

File: `src/lib/server/my-feature/MyAdapter.js`

```javascript
/**
 * MyAdapter - Custom session type adapter
 * Implements the adapter interface for RunSessionManager
 */

export class MyAdapter {
	constructor(runId, options) {
		this.runId = runId;
		this.options = options;
		this.process = null; // Your custom process/connection
		this.eventEmitter = null; // Set by RunSessionManager
	}

	/**
	 * Initialize the adapter (required)
	 * Called when session is created/resumed
	 */
	async init() {
		console.log(`[MyAdapter] Initializing session ${this.runId}`);

		// Start your custom process/connection
		this.process = await this.startCustomProcess(this.options);

		// Set up event listeners
		this.process.on('data', (data) => {
			// Emit events to RunSessionManager
			this.eventEmitter?.emit('run:event', {
				channel: this.runId,
				type: 'my-adapter:output',
				payload: { data }
			});
		});

		this.process.on('error', (error) => {
			this.eventEmitter?.emit('run:event', {
				channel: this.runId,
				type: 'my-adapter:error',
				payload: { error: error.message }
			});
		});

		return { success: true };
	}

	/**
	 * Write input to the adapter (required)
	 * Called when client sends input
	 */
	async write(input) {
		if (!this.process) {
			throw new Error('Adapter not initialized');
		}

		await this.process.send(input);
		return { success: true };
	}

	/**
	 * Close the adapter (required)
	 * Called when session is closed
	 */
	async close() {
		console.log(`[MyAdapter] Closing session ${this.runId}`);

		if (this.process) {
			await this.process.terminate();
			this.process = null;
		}

		return { success: true };
	}

	/**
	 * Set the event emitter (required)
	 * RunSessionManager calls this to provide event emitter
	 */
	setEventEmitter(emitter) {
		this.eventEmitter = emitter;
	}

	/**
	 * Custom helper method (optional)
	 */
	async startCustomProcess(options) {
		// Your custom process initialization
		// Return whatever object your adapter needs
		return {
			send: async (data) => {
				/* ... */
			},
			terminate: async () => {
				/* ... */
			},
			on: (event, callback) => {
				/* ... */
			}
		};
	}
}
```

### Step 2: Register the Adapter (Server)

File: `src/lib/server/shared/index.js`

```javascript
import { RunSessionManager } from '../runtime/RunSessionManager.js';
import { PtyAdapter } from '../terminal/PtyAdapter.js';
import { ClaudeAdapter } from '../claude/ClaudeAdapter.js';
import { FileEditorAdapter } from '../file-editor/FileEditorAdapter.js';
import { MyAdapter } from '../my-feature/MyAdapter.js'; // Import your adapter

/**
 * Register all session adapters
 * Called during server initialization in hooks.server.js
 */
export function registerAdapters(runSessionManager) {
	// Existing adapters
	RunSessionManager.registerAdapter('pty', PtyAdapter);
	RunSessionManager.registerAdapter('claude', ClaudeAdapter);
	RunSessionManager.registerAdapter('file-editor', FileEditorAdapter);

	// Register your new adapter
	RunSessionManager.registerAdapter('my-feature', MyAdapter);

	console.log('[ADAPTERS] All session adapters registered');
}
```

### Step 3: Add Session Type Constant

File: `src/lib/shared/session-types.js`

```javascript
/**
 * Shared session type constants
 * Used by both client and server
 */

export const SESSION_TYPE = {
	PTY: 'pty',
	CLAUDE: 'claude',
	FILE_EDITOR: 'file-editor',
	MY_FEATURE: 'my-feature' // Add your session type
};
```

### Step 4: Create UI Component (Client)

File: `src/lib/client/my-feature/MyFeaturePane.svelte`

```svelte
<script>
	/**
	 * MyFeaturePane - UI component for my-feature sessions
	 * Receives events from server via Socket.IO
	 */

	let { sessionId, workspacePath } = $props();

	let output = $state([]);
	let input = $state('');

	// Listen for events from server
	function handleSessionEvent(event) {
		if (event.type === 'my-feature:output') {
			output = [...output, event.payload.data];
		} else if (event.type === 'my-feature:error') {
			output = [...output, `Error: ${event.payload.error}`];
		}
	}

	// Send input to server
	function sendInput() {
		// Use Socket.IO or API to send input
		socket.emit('run:input', {
			runId: sessionId,
			input: input
		});
		input = '';
	}
</script>

<div class="my-feature-pane">
	<div class="output">
		{#each output as line}
			<div class="line">{line}</div>
		{/each}
	</div>

	<input
		type="text"
		bind:value={input}
		onkeypress={(e) => e.key === 'Enter' && sendInput()}
		placeholder="Enter command..."
	/>
</div>

<style>
	.my-feature-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.output {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	input {
		padding: 0.5rem;
		border: 1px solid #ccc;
	}
</style>
```

### Step 5: Register UI Module (Client)

File: `src/lib/client/shared/session-modules/index.js`

```javascript
/**
 * Session module registry
 * Maps session types to their UI components
 */

import TerminalPane from '../../terminal/TerminalPane.svelte';
import ClaudePane from '../../claude/ClaudePane.svelte';
import FileEditorPane from '../../file-editor/FileEditorPane.svelte';
import MyFeaturePane from '../../my-feature/MyFeaturePane.svelte'; // Import your UI

import { SESSION_TYPE } from '../../../shared/session-types.js';

/**
 * Registry of session type to pane component mappings
 */
export const sessionModules = {
	[SESSION_TYPE.PTY]: {
		pane: TerminalPane,
		label: 'Terminal'
	},
	[SESSION_TYPE.CLAUDE]: {
		pane: ClaudePane,
		label: 'Claude'
	},
	[SESSION_TYPE.FILE_EDITOR]: {
		pane: FileEditorPane,
		label: 'File Editor'
	},
	[SESSION_TYPE.MY_FEATURE]: {
		pane: MyFeaturePane,
		label: 'My Feature'
	}
};

/**
 * Get pane component for session type
 */
export function getPaneForSession(sessionType) {
	return sessionModules[sessionType]?.pane || null;
}
```

## Registration Process

### Server Startup Sequence

1. `hooks.server.js` initializes services
2. Calls `registerAdapters(runSessionManager)`
3. Each adapter registers with `RunSessionManager.registerAdapter(kind, AdapterClass)`
4. RunSessionManager stores adapter constructors in registry
5. When session created, RunSessionManager instantiates appropriate adapter

### Adapter Lifecycle

```
1. Client requests session creation
   ↓
2. RunSessionManager.start(kind, options)
   ↓
3. Looks up adapter class for 'kind'
   ↓
4. new AdapterClass(runId, options)
   ↓
5. adapter.setEventEmitter(emitter)
   ↓
6. adapter.init()
   ↓
7. Adapter running, emits events
   ↓
8. Client sends input → adapter.write(input)
   ↓
9. Session closed → adapter.close()
```

## Testing Your Adapter

### Unit Test Example

File: `tests/server/my-adapter.test.js`

```javascript
import { describe, it, expect, vi } from 'vitest';
import { MyAdapter } from '../src/lib/server/my-feature/MyAdapter.js';

describe('MyAdapter', () => {
	it('should initialize successfully', async () => {
		const adapter = new MyAdapter('test-run-id', { cwd: '/tmp' });

		// Mock event emitter
		const mockEmitter = {
			emit: vi.fn()
		};
		adapter.setEventEmitter(mockEmitter);

		await adapter.init();

		expect(adapter.process).toBeTruthy();
	});

	it('should send input to process', async () => {
		const adapter = new MyAdapter('test-run-id', { cwd: '/tmp' });
		const mockEmitter = { emit: vi.fn() };
		adapter.setEventEmitter(mockEmitter);

		await adapter.init();
		await adapter.write('test command');

		// Verify process received input
		expect(adapter.process.send).toHaveBeenCalledWith('test command');
	});

	it('should close gracefully', async () => {
		const adapter = new MyAdapter('test-run-id', { cwd: '/tmp' });
		await adapter.init();

		await adapter.close();

		expect(adapter.process).toBeNull();
	});
});
```

## Common Patterns

### Pattern 1: Process-Based Adapters (like PtyAdapter)

Use when your adapter wraps an external process (child_process, spawn, etc.)

```javascript
class ProcessAdapter {
	async init() {
		this.process = spawn('my-command', args);
		this.process.stdout.on('data', (data) => {
			this.eventEmitter.emit('run:event', {
				channel: this.runId,
				type: 'output',
				payload: { data: data.toString() }
			});
		});
	}
}
```

### Pattern 2: API-Based Adapters (like ClaudeAdapter)

Use when your adapter communicates with an API/service

```javascript
class ApiAdapter {
	async init() {
		this.client = createApiClient(this.options.apiKey);
		this.session = await this.client.createSession();
	}

	async write(input) {
		const response = await this.client.sendMessage(this.session.id, input);
		this.eventEmitter.emit('run:event', {
			channel: this.runId,
			type: 'response',
			payload: response
		});
	}
}
```

### Pattern 3: Virtual Adapters (like FileEditorAdapter)

Use when your adapter doesn't spawn a process but manages state

```javascript
class VirtualAdapter {
	async init() {
		this.state = { files: [], currentFile: null };
		// No external process
	}

	async write(command) {
		// Handle command and update internal state
		if (command.action === 'open') {
			this.state.currentFile = command.file;
		}
		this.emitStateUpdate();
	}
}
```

## Troubleshooting

### Common Issues

**Problem**: Adapter not found when creating session
**Solution**: Ensure `registerAdapters()` is called in `hooks.server.js`

**Problem**: Events not reaching client
**Solution**: Verify `setEventEmitter()` is called before `init()`

**Problem**: Session closes immediately
**Solution**: Check `init()` returns `{ success: true }` and doesn't throw errors

**Problem**: Input not working
**Solution**: Ensure `write()` method is implemented and returns a promise

## Next Steps

1. Read existing adapters: `PtyAdapter.js`, `ClaudeAdapter.js`
2. Create your adapter following the minimal example
3. Register adapter in `src/lib/server/shared/index.js`
4. Create UI component and register in session modules
5. Test with manual session creation
6. Write unit tests
7. Submit PR with documentation

## Resources

- **PtyAdapter**: Reference implementation for process-based adapters
- **ClaudeAdapter**: Reference implementation for API-based adapters
- **RunSessionManager**: Core session management (see `runtime/RunSessionManager.js`)
- **Event Sourcing**: See architecture docs for event replay details

## Questions?

Check the existing adapters in `src/lib/server/{terminal,claude,file-editor}/` for real-world examples.
