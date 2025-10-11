# Socket.IO Event Protocol

Dispatch uses Socket.IO for real-time bidirectional communication between clients and the server. The unified event protocol supports all session types (terminal, Claude, file editor) with consistent patterns.

## Connection & Authentication

### Client → Server: `client:hello`

Initial client identification and authentication.

**Payload:**

```javascript
{
  clientId: 'client-abc123',      // Unique client identifier (from localStorage)
  terminalKey: 'your-key-here'    // Authentication key
}
```

**Response (via callback):**

```javascript
// Success
{
  success: true,
  message: 'Authenticated'
}

// Failure
{
  success: false,
  error: 'Missing terminalKey' | 'Invalid key'
}
```

**Example:**

```javascript
socket.emit(
	'client:hello',
	{
		clientId: localStorage.getItem('clientId'),
		terminalKey: 'my-terminal-key'
	},
	(response) => {
		if (response.success) {
			console.log('Authenticated successfully');
		}
	}
);
```

## Session Management

### Client → Server: `run:attach`

Attach to a session and receive event replay from a specific sequence number.

**Payload:**

```javascript
{
  runId: 'pty_abc123',            // Session identifier
  seq: 0,                         // Last seen sequence number (0 for full replay)
  clientId: 'client-abc123'       // Client identifier
}
```

**Response (via callback):**

```javascript
{
  success: true,
  runId: 'pty_abc123',
  kind: 'pty',                    // Session type: 'pty', 'claude', 'file-editor'
  status: 'running',              // 'starting', 'running', 'stopped', 'error'
  events: [                       // Event replay from seq onwards
    {
      runId: 'pty_abc123',
      seq: 1,
      channel: 'pty:stdout',
      type: 'chunk',
      payload: { data: '...' },
      ts: 1698765432100
    },
    // ... more events
  ]
}
```

**Server Behavior:**

1. Validates session exists
2. Joins socket to room `run:{runId}`
3. Queries database for events where `seq > requestedSeq`
4. Returns session metadata + event history
5. Future events automatically emit to room

**Example:**

```javascript
// Initial attach (full replay)
socket.emit(
	'run:attach',
	{
		runId: 'pty_abc123',
		seq: 0,
		clientId: myClientId
	},
	(response) => {
		if (response.success) {
			// Process historical events
			response.events.forEach((event) => processEvent(event));

			// Now subscribed to live events via 'run:event'
		}
	}
);

// Resume after disconnect (partial replay)
socket.emit(
	'run:attach',
	{
		runId: 'pty_abc123',
		seq: lastSeenSeq, // Only get events after this
		clientId: myClientId
	},
	(response) => {
		// Catch up on missed events
	}
);
```

### Client → Server: `run:input`

Send input to a session (terminal keystrokes, Claude messages, etc.).

**Payload:**

```javascript
{
  runId: 'pty_abc123',
  data: 'ls -la\n'                // String or Uint8Array
}
```

**No callback response.** Input is processed asynchronously. Results appear as `run:event` emissions.

**Example:**

```javascript
// Terminal input
socket.emit('run:input', {
	runId: terminalSessionId,
	data: 'echo "Hello"\n'
});

// Claude message
socket.emit('run:input', {
	runId: claudeSessionId,
	data: 'Explain this code'
});
```

### Client → Server: `run:resize`

Resize terminal dimensions (PTY sessions only).

**Payload:**

```javascript
{
  runId: 'pty_abc123',
  cols: 120,                      // Terminal columns
  rows: 30                        // Terminal rows
}
```

**Response (via callback):**

```javascript
{
	success: true;
}
```

**Example:**

```javascript
socket.emit(
	'run:resize',
	{
		runId: ptySessionId,
		cols: 120,
		rows: 30
	},
	(response) => {
		console.log('Terminal resized');
	}
);
```

### Client → Server: `run:close`

Terminate a session.

**Payload:**

```javascript
{
	runId: 'pty_abc123';
}
```

**Response (via callback):**

```javascript
{
	success: true;
}
```

**Example:**

```javascript
socket.emit(
	'run:close',
	{
		runId: sessionId
	},
	(response) => {
		if (response.success) {
			// Session closed, clean up UI
		}
	}
);
```

## Event Streaming

### Server → Client: `run:event`

Real-time event emission for attached sessions.

**Payload:**

```javascript
{
  runId: 'pty_abc123',
  sessionId: 'pty_abc123',        // Alias for runId
  seq: 42,                        // Monotonic sequence number
  channel: 'pty:stdout',          // Event channel
  type: 'chunk',                  // Event type
  payload: {                      // Event data (structure varies by channel)
    data: 'command output...'
  },
  ts: 1698765432100               // Unix timestamp (milliseconds)
}
```

**Channels by Session Type:**

**PTY (Terminal) Channels:**

- `pty:stdout` - Standard output
  - `type: 'chunk'`, `payload: { data: string }`
- `pty:stderr` - Standard error
  - `type: 'chunk'`, `payload: { data: string }`
- `system:status` - Session status changes
  - `type: 'json'`, `payload: { status: 'running'|'stopped'|'error' }`

**Claude Channels:**

- `claude:message` - Message events from Claude SDK
  - `type: 'event'`, `payload: { events: [...] }`
  - Events include: `startTurn`, `text`, `toolUse`, `endTurn`, etc.
- `claude:error` - Error events
  - `type: 'json'`, `payload: { error: string, details: {...} }`

**File Editor Channels:**

- `file-editor:content` - File content updates
  - `type: 'text'`, `payload: { content: string }`
- `file-editor:saved` - Save confirmation
  - `type: 'json'`, `payload: { path: string, size: number }`

**Example Event Processing:**

```javascript
socket.on('run:event', (event) => {
	// Track sequence for replay
	lastSeenSeq = event.seq;

	// Route by channel
	switch (event.channel) {
		case 'pty:stdout':
			terminal.write(event.payload.data);
			break;

		case 'claude:message':
			event.payload.events.forEach((claudeEvent) => {
				if (claudeEvent.type === 'text') {
					appendClaudeMessage(claudeEvent.text);
				}
			});
			break;

		case 'system:status':
			updateSessionStatus(event.payload.status);
			break;
	}
});
```

## Tunnel Management

### Client → Server: `tunnel:start`

Start LocalTunnel for public URL.

**Payload:**

```javascript
{
	terminalKey: 'your-key-here'; // Authentication required
}
```

**Response (via callback):**

```javascript
{
  success: true,
  url: 'https://xyz.loca.lt',
  status: 'running'
}
```

### Client → Server: `tunnel:stop`

Stop active tunnel.

**Payload:**

```javascript
{
	terminalKey: 'your-key-here';
}
```

**Response (via callback):**

```javascript
{
	success: true;
}
```

### Client → Server: `tunnel:status`

Get current tunnel status.

**Payload:** (empty object or omitted)

**Response (via callback):**

```javascript
{
  success: true,
  status: {
    active: true,
    url: 'https://xyz.loca.lt',
    startedAt: 1698765432100
  }
}
```

## VS Code Tunnel Management

### Client → Server: `vscode-tunnel:start`

Start VS Code tunnel.

**Payload:**

```javascript
{
	terminalKey: 'your-key-here';
}
```

**Response (via callback):**

```javascript
{
  success: true,
  url: 'https://vscode.dev/tunnel/...',
  status: 'running'
}
```

### Client → Server: `vscode-tunnel:stop`

Stop VS Code tunnel.

**Payload:**

```javascript
{
	terminalKey: 'your-key-here';
}
```

**Response (via callback):**

```javascript
{
	success: true;
}
```

### Client → Server: `vscode-tunnel:status`

Get VS Code tunnel status.

**Response (via callback):**

```javascript
{
  success: true,
  status: {
    active: false
  }
}
```

## Connection Lifecycle

### Server → Client: `disconnect`

Server-initiated disconnect (automatic from Socket.IO).

**Example:**

```javascript
socket.on('disconnect', (reason) => {
	console.log('Disconnected:', reason);
	// reason values: 'transport close', 'ping timeout', 'server namespace disconnect', etc.

	// Implement reconnection logic
	setTimeout(() => {
		socket.connect();
	}, 1000);
});
```

### Reconnection Pattern

**Client-side reconnection with state recovery:**

```javascript
let lastSeenSeq = {}; // Track per session

socket.on('connect', () => {
	console.log('Connected to server');

	// Reattach to active sessions
	activeSessions.forEach((sessionId) => {
		socket.emit(
			'run:attach',
			{
				runId: sessionId,
				seq: lastSeenSeq[sessionId] || 0,
				clientId: myClientId
			},
			(response) => {
				// Process missed events
				response.events.forEach((event) => {
					processEvent(event);
					lastSeenSeq[sessionId] = event.seq;
				});
			}
		);
	});
});

socket.on('run:event', (event) => {
	lastSeenSeq[event.runId] = event.seq;
	processEvent(event);
});
```

## Error Handling

### Server → Client: `error`

Generic error event (Socket.IO standard).

**Payload:**

```javascript
{
	message: 'Error description';
}
```

### Error Response Pattern

All callbacks use consistent error structure:

```javascript
{
  success: false,
  error: 'Error message here'
}
```

**Example Error Handling:**

```javascript
socket.emit('run:attach', { runId: 'invalid' }, (response) => {
	if (!response.success) {
		console.error('Attach failed:', response.error);
		// Common errors:
		// - 'Session not found'
		// - 'Invalid runId'
		// - 'Session already stopped'
	}
});
```

## Room-Based Broadcasting

**Server uses Socket.IO rooms for efficient event routing:**

```javascript
// Client joins room on attach
socket.join(`run:${runId}`);

// Server emits to all clients watching this session
io.to(`run:${runId}`).emit('run:event', eventData);
```

**Multi-client synchronization:**

- Multiple browser tabs can attach to same session
- All receive identical event stream
- Each tracks own `seq` for independent replay

## Admin Events

### Server → Client: `admin.event.logged`

Real-time admin console event logging.

**Payload:**

```javascript
{
  socketId: 'socket-123',
  type: 'run:attach',
  data: { /* event data */ },
  timestamp: 1698765432100
}
```

Used by `/console` admin interface for monitoring.

## Event Sourcing Pattern

**Core Principles:**

1. **All events are persisted** in `session_events` table
2. **Sequence numbers are monotonic** per session
3. **Clients can replay** from any sequence number
4. **Events are immutable** - never modified after creation

**Benefits:**

- Session state recovery after disconnection
- Multi-client synchronization
- Debugging and audit trails
- Time-travel debugging capabilities

**Implementation:**

```javascript
// Server-side event recording
await db.appendSessionEvent(runId, nextSeq, 'pty:stdout', 'chunk', { data: outputChunk });

// Emit to connected clients
io.to(`run:${runId}`).emit('run:event', {
	runId,
	seq: nextSeq,
	channel: 'pty:stdout',
	type: 'chunk',
	payload: { data: outputChunk },
	ts: Date.now()
});
```

## Best Practices

**Client Implementation:**

1. **Always track sequence numbers** - Enable replay on reconnect
2. **Use callbacks for critical operations** - Attach, close, resize
3. **Handle disconnections gracefully** - Implement reconnection logic
4. **Join specific rooms** - Only subscribe to needed sessions
5. **Clean up on unmount** - Leave rooms, clear listeners

**Error Recovery:**

```javascript
// Robust attach with retry
async function attachToSession(runId, maxRetries = 3) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			const response = await new Promise((resolve) => {
				socket.emit(
					'run:attach',
					{
						runId,
						seq: lastSeenSeq[runId] || 0,
						clientId: myClientId
					},
					resolve
				);
			});

			if (response.success) {
				return response;
			}

			await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
		} catch (error) {
			console.error('Attach attempt failed:', error);
		}
	}
	throw new Error('Failed to attach after retries');
}
```

**Performance Optimization:**

- Batch event processing for high-frequency channels (terminal output)
- Use binary payloads for large data transfers
- Implement client-side buffering for smooth rendering
- Debounce resize events

## Middleware Architecture

**Server uses SocketEventMediator for extensible event handling:**

```javascript
// Logging middleware
mediator.use((socket, event, data, next) => {
	logger.debug('SOCKET', `${socket.id} -> ${event}`, data);
	next();
});

// Error handling middleware
mediator.use((socket, event, data, next) => {
	try {
		next();
	} catch (error) {
		socket.emit('error', { message: error.message });
	}
});

// Register handlers
mediator.on('run:attach', async (socket, data, callback) => {
	// Handler implementation
});
```

**Middleware execution order:**

1. Packet logging (raw Socket.IO middleware)
2. Custom middleware (logging, error handling)
3. Event handler
4. Callback response

## Debugging

**Enable verbose logging:**

```javascript
// Client-side
localStorage.debug = 'socket.io-client:*';

// Server-side
DEBUG=SOCKET,SESSION npm run dev
```

**Monitor events in browser console:**

```javascript
socket.onAny((event, ...args) => {
	console.log('Socket event:', event, args);
});
```

**Admin console:** Visit `/console` for real-time event monitoring and socket inspection.
