# Implementing Unified Session Pattern in Dispatch

## Executive Summary

This document provides implementation steps to apply the clear, minimal pattern from the guide to the Dispatch application. Since this is a POC application that is only partially functional, we can make breaking changes and implement the new architecture directly without complex migration strategies.

The proposed changes will:

1. **Replace** the current complex session management architecture with a unified pattern
2. Introduce event-sourced session history with append-only logging
3. Unify Socket.IO messaging around run sessions with typed channels
4. **Eliminate** backward compatibility concerns (POC allows breaking changes)
5. Dramatically reduce code complexity by removing multiple abstraction layers

## Current Architecture Analysis

### Existing Components (Complex)

- `SessionManager` - High-level session orchestration
- `SessionRouter` - Session routing and activity state tracking
- `TerminalManager` - PTY session management  
- `ClaudeSessionManager` - Claude Code session management
- `DatabaseManager` - SQLite storage with multiple session-related tables
- Multiple Socket.IO event handlers scattered across socket-setup.js

### Current Database Schema (Fragmented)

```sql
-- Multiple session-related tables
sessions (id, session_type, type_specific_id, title, working_directory, created_at, updated_at)
session_layout (session_id, tile_id, position, created_at, updated_at)  
terminal_history (id, terminal_id, data, timestamp)
claude_sessions (id, working_directory, session_id, app_session_id, resume_capable, created_at, updated_at)
socket_sessions (id, socket_id, metadata, created_at, updated_at, disconnected_at)
session_history (id, session_id, socket_id, event_type, direction, data, timestamp)
```

### Problems with Current Design

1. **Multiple session identifiers**: app session ID, type-specific ID, socket session ID
2. **Scattered session state**: spread across multiple tables and in-memory maps
3. **Complex routing**: SessionManager → SessionRouter → type-specific managers
4. **Inconsistent event handling**: different patterns for terminal vs Claude events
5. **History fragmentation**: separate storage for terminal history, Claude messages, socket events

## Proposed Unified Architecture

### New Session Model (Simplified)

Replace all existing session concepts with three clear types:

1. **Browser Session**: HTTP auth session (unchanged, handled by SvelteKit)
2. **Client Session**: Socket.IO connection with stable `clientId` (stored in localStorage)
3. **Run Session**: Long-lived server process with `runId` and event-sourced history

### New Database Schema (Minimal)

```sql
-- Single table for all run sessions
CREATE TABLE IF NOT EXISTS sessions (
  run_id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  kind TEXT NOT NULL,              -- 'pty' | 'claude'
  status TEXT NOT NULL,            -- 'starting'|'running'|'stopped'|'error'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  meta_json TEXT NOT NULL          -- JSON: {shell, env, model, etc.} - working directory managed by adapter
);

-- Append-only event log for all session activity
CREATE TABLE IF NOT EXISTS session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,            -- monotonic sequence per run_id
  channel TEXT NOT NULL,           -- 'pty:stdout', 'claude:delta', 'system:status'
  type TEXT NOT NULL,              -- 'chunk', 'text', 'json', 'open', 'close'
  payload BLOB NOT NULL,           -- JSON or binary data
  ts INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES sessions(run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_events_run_seq ON session_events(run_id, seq);
CREATE INDEX IF NOT EXISTS ix_events_run_ts ON session_events(run_id, ts);

-- Client-specific UI layout table (one layout per client device)
CREATE TABLE IF NOT EXISTS workspace_layout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,  
  client_id TEXT NOT NULL,           -- Device/browser-specific layout
  tile_id TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(run_id, client_id)          -- One layout per run per client
);
```

**Layout Management Notes:**

- Each client device (identified by `clientId`) can have its own layout configuration
- The same run session can appear in different tiles on different devices
- Allows users to customize layouts per device (desktop vs mobile vs tablet)
- Layout changes are scoped to the specific client making the change

### New Server Architecture (Unified)

Replace current SessionManager + SessionRouter + type managers with:

```javascript
// /src/lib/server/runtime/RunSessionManager.js
export class RunSessionManager {
  constructor(database, terminalAdapter, claudeAdapter) {
    this.db = database;
    this.adapters = new Map([
      ['pty', terminalAdapter],
      ['claude', claudeAdapter]
    ]);
    this.liveRuns = new Map(); // runId -> { adapter, nextSeq }
  }

  async createRunSession({ kind, meta }) {
    const runId = crypto.randomUUID();
    const created = Date.now();

    // Persist session
    await this.db.run(
      `INSERT INTO sessions(run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
       VALUES(?, NULL, ?, 'starting', ?, ?, ?)`,
      [runId, kind, created, created, JSON.stringify(meta)]
    );

    // Create process adapter
    const adapter = this.adapters.get(kind);
    const proc = await adapter.create({
      ...meta,
      onEvent: (ev) => this.recordAndEmit(runId, ev)
    });

    this.liveRuns.set(runId, { proc, nextSeq: await this.nextSeqFor(runId) });

    await this.db.run(
      `UPDATE sessions SET status='running', updated_at=? WHERE run_id=?`,
      [Date.now(), runId]
    );

    return { runId };
  }

  async recordAndEmit(runId, ev) {
    const row = await this.appendEvent(runId, ev.channel, ev.type, ev.payload);
    // Emit to all clients attached to this run
    io.to(`run:${runId}`).emit('run:event', row);
  }

  async appendEvent(runId, channel, type, payload) {
    const rec = this.liveRuns.get(runId) || { nextSeq: await this.nextSeqFor(runId) };
    const seq = rec.nextSeq++;
    const ts = Date.now();
    
    const buf = payload instanceof Uint8Array ? 
      payload : 
      new TextEncoder().encode(JSON.stringify(payload));

    await this.db.run(
      `INSERT INTO session_events(run_id, seq, channel, type, payload, ts) VALUES(?,?,?,?,?,?)`,
      [runId, seq, channel, type, buf, ts]
    );

    return { runId, seq, channel, type, payload, ts };
  }
}
```

Note: legacy socket events such as `terminal.start`, `terminal.write`, `claude.send`, and similar handlers have been removed in favor of the unified `run:*` event API. Update any client code or tests that rely on those legacy events.

### Process Adapters (Simplified)

Replace complex TerminalManager and ClaudeSessionManager with simple adapters:

```javascript
// /src/lib/server/adapters/PtyAdapter.js
export class PtyAdapter {
  async create({ cwd, options = {}, onEvent }) {
    const pty = await import('node-pty');
    
    // Prepare node-pty options with defaults
    const ptyOptions = {
      // Working directory
      cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
      
      // Environment variables  
      env: options.env ? { ...process.env, ...options.env } : process.env,
      
      // Terminal dimensions
      cols: options.cols || 80,
      rows: options.rows || 24,
      
      // Terminal name/type
      name: options.name || 'xterm-256color',
      
      // String encoding (utf8, null for binary)
      encoding: options.encoding !== undefined ? options.encoding : 'utf8',
      
      // Flow control options (experimental)
      handleFlowControl: options.handleFlowControl || false,
      flowControlPause: options.flowControlPause || '\x13', // XOFF
      flowControlResume: options.flowControlResume || '\x11', // XON
      
      // Unix-specific options
      uid: options.uid,
      gid: options.gid,
      
      // Windows-specific options
      useConpty: options.useConpty,
      useConptyDll: options.useConptyDll,
      conptyInheritCursor: options.conptyInheritCursor,
      
      // Allow any other node-pty options
      ...options
    };
    
    // Extract shell and args from options or use defaults
    const shell = options.shell || process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
    const args = options.args || [];

    const term = pty.spawn(shell, args, ptyOptions);

    term.onData(data => {
      onEvent({
        channel: 'pty:stdout',
        type: 'chunk', 
        payload: ptyOptions.encoding === null ? data : new TextEncoder().encode(data)
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

    return {
      kind: 'pty',
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
      clear() {
        if (term.clear) {
          term.clear();
        }
      },
      pause() {
        if (term.pause) {
          term.pause();
        }
      },
      resume() {
        if (term.resume) {
          term.resume();
        }
      },
      close() {
        term.kill();
      },
      // Expose pty properties
      get pid() { return term.pid; },
      get process() { return term.process; },
      get cols() { return term.cols; },
      get rows() { return term.rows; }
    };
  }
}

// /src/lib/server/adapters/ClaudeAdapter.js  
export class ClaudeAdapter {
  async create({ cwd, options = {}, onEvent }) {
    // Import Claude Code SDK
    const { query } = await import('@anthropic-ai/claude-code');
    
    // Prepare SDK options with defaults
    const claudeOptions = {
      cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
      model: options.model,
      permissionMode: options.permissionMode || 'default',
      maxTurns: options.maxTurns,
      env: options.env || {},
      additionalDirectories: options.additionalDirectories || [],
      allowedTools: options.allowedTools,
      disallowedTools: options.disallowedTools,
      customSystemPrompt: options.customSystemPrompt,
      appendSystemPrompt: options.appendSystemPrompt,
      mcpServers: options.mcpServers || {},
      hooks: options.hooks || {},
      ...options // Allow any other SDK options
    };

    let activeQuery = null;

    return {
      kind: 'claude',
      input: {
        async write(data) {
          const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
          
          // Create new query with the message
          activeQuery = query({
            prompt: message,
            options: claudeOptions
          });

          // Stream messages as events
          try {
            for await (const message of activeQuery) {
              if (message.type === 'assistant') {
                onEvent({
                  channel: 'claude:message',
                  type: 'assistant',
                  payload: { content: message.message.content }
                });
              } else if (message.type === 'result') {
                onEvent({
                  channel: 'claude:result',
                  type: message.subtype,
                  payload: {
                    result: message.subtype === 'success' ? message.result : null,
                    isError: message.is_error,
                    usage: message.usage,
                    totalCostUsd: message.total_cost_usd,
                    durationMs: message.duration_ms
                  }
                });
              } else if (message.type === 'stream_event') {
                // Handle streaming deltas if includePartialMessages is enabled
                onEvent({
                  channel: 'claude:delta',
                  type: 'stream',
                  payload: { event: message.event }
                });
              }
            }
          } catch (error) {
            onEvent({
              channel: 'claude:error',
              type: 'execution_error',
              payload: { error: error.message }
            });
          }
        }
      },
      close() {
        if (activeQuery && activeQuery.interrupt) {
          activeQuery.interrupt();
        }
      }
    };
  }
}
```

## Direct Implementation Plan (POC Refactoring)

Since this is a POC application, we can implement the new architecture directly without complex migration strategies. This allows for a much cleaner and faster implementation.

### Step 1: Replace Database Schema (Direct)

**Action**: Drop existing tables and create new unified schema

```sql
-- Drop all existing session-related tables
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS session_layout; 
DROP TABLE IF EXISTS terminal_history;
DROP TABLE IF EXISTS claude_sessions;
DROP TABLE IF EXISTS socket_sessions;
DROP TABLE IF EXISTS session_history;

-- Create new unified schema
CREATE TABLE sessions (
  run_id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  kind TEXT NOT NULL,              -- 'pty' | 'claude'
  status TEXT NOT NULL,            -- 'starting'|'running'|'stopped'|'error'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  meta_json TEXT NOT NULL          -- JSON: {workspacePath, shell, env, model, etc.}
);

CREATE TABLE session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,            -- monotonic sequence per run_id
  channel TEXT NOT NULL,           -- 'pty:stdout', 'claude:delta', 'system:status'
  type TEXT NOT NULL,              -- 'chunk', 'text', 'json', 'open', 'close'
  payload BLOB NOT NULL,           -- JSON or binary data
  ts INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES sessions(run_id)
);

CREATE UNIQUE INDEX ix_events_run_seq ON session_events(run_id, seq);
CREATE INDEX ix_events_run_ts ON session_events(run_id, ts);

-- Client-specific UI layout table (allows different layouts per device)
CREATE TABLE workspace_layout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  client_id TEXT NOT NULL,           -- Device/browser-specific layout  
  tile_id TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(run_id, client_id)          -- One layout per run per client
);
```

### Step 2: Replace Session Management (Direct)

**Action**: Delete existing managers and create new unified implementation

1. **Delete these files**:
   - `src/lib/server/core/SessionManager.js`
   - `src/lib/server/core/SessionRouter.js`
   - `src/lib/server/terminals/TerminalManager.js` (replace with adapter)
   - `src/lib/server/claude/ClaudeSessionManager.js` (replace with adapter)

2. **Create new files**:

```javascript
// src/lib/server/runtime/RunSessionManager.js
import { logger } from '../utils/logger.js';

export class RunSessionManager {
  constructor(database, io) {
    this.db = database;
    this.io = io;
    this.liveRuns = new Map(); // runId -> { proc, nextSeq }
    this.adapters = new Map();
  }

  registerAdapter(kind, adapter) {
    this.adapters.set(kind, adapter);
  }

  async createRunSession({ kind, meta }) {
    const runId = crypto.randomUUID();
    const created = Date.now();

    // Persist session
    await this.db.run(
      `INSERT INTO sessions(run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
       VALUES(?, NULL, ?, 'starting', ?, ?, ?)`,
      [runId, kind, created, created, JSON.stringify(meta)]
    );

    // Create process adapter
    const adapter = this.adapters.get(kind);
    if (!adapter) throw new Error(`No adapter for kind: ${kind}`);
    
    const proc = await adapter.create({
      ...meta,
      onEvent: (ev) => this.recordAndEmit(runId, ev)
    });

    this.liveRuns.set(runId, { proc, nextSeq: await this.nextSeqFor(runId) });

    await this.db.run(
      `UPDATE sessions SET status='running', updated_at=? WHERE run_id=?`,
      [Date.now(), runId]
    );

    return { runId };
  }

  async recordAndEmit(runId, ev) {
    const row = await this.appendEvent(runId, ev.channel, ev.type, ev.payload);
    this.io.to(`run:${runId}`).emit('run:event', row);
  }

  async appendEvent(runId, channel, type, payload) {
    const rec = this.liveRuns.get(runId) || { nextSeq: await this.nextSeqFor(runId) };
    const seq = rec.nextSeq++;
    const ts = Date.now();
    
    const buf = payload instanceof Uint8Array ? 
      payload : 
      new TextEncoder().encode(JSON.stringify(payload));

    await this.db.run(
      `INSERT INTO session_events(run_id, seq, channel, type, payload, ts) VALUES(?,?,?,?,?,?)`,
      [runId, seq, channel, type, buf, ts]
    );

    return { runId, seq, channel, type, payload, ts };
  }

  async nextSeqFor(runId) {
    const r = await this.db.get(`SELECT COALESCE(MAX(seq),0) as m FROM session_events WHERE run_id=?`, [runId]);
    return (r?.m ?? 0) + 1;
  }

  async getEventsSince(runId, afterSeq) {
    return await this.db.all(
      `SELECT run_id as runId, seq, channel, type, payload, ts
       FROM session_events WHERE run_id=? AND seq>? ORDER BY seq ASC`,
      [runId, afterSeq]
    );
  }

  getRunSession(runId) {
    return this.liveRuns.get(runId);
  }

  async closeRunSession(runId) {
    const live = this.liveRuns.get(runId);
    if (live) {
      live.proc.close();
      this.liveRuns.delete(runId);
      await this.db.run(
        `UPDATE sessions SET status='stopped', updated_at=? WHERE run_id=?`,
        [Date.now(), runId]
      );
    }
  }
}
```

3. **Create adapters**:

```javascript
// src/lib/server/adapters/PtyAdapter.js
import { logger } from '../utils/logger.js';

export class PtyAdapter {
  async create({ cwd, options = {}, onEvent }) {
    const pty = await import('node-pty');
    
    // Prepare node-pty options with defaults
    const ptyOptions = {
      // Working directory
      cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
      
      // Environment variables  
      env: options.env ? { ...process.env, ...options.env } : process.env,
      
      // Terminal dimensions
      cols: options.cols || 80,
      rows: options.rows || 24,
      
      // Terminal name/type
      name: options.name || 'xterm-256color',
      
      // String encoding (utf8, null for binary)
      encoding: options.encoding !== undefined ? options.encoding : 'utf8',
      
      // Flow control options (experimental)
      handleFlowControl: options.handleFlowControl || false,
      flowControlPause: options.flowControlPause || '\x13', // XOFF
      flowControlResume: options.flowControlResume || '\x11', // XON
      
      // Unix-specific options
      uid: options.uid,
      gid: options.gid,
      
      // Windows-specific options
      useConpty: options.useConpty,
      useConptyDll: options.useConptyDll,
      conptyInheritCursor: options.conptyInheritCursor,
      
      // Allow any other node-pty options
      ...options
    };
    
    // Extract shell and args from options or use defaults
    const shell = options.shell || process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
    const args = options.args || [];

    logger.info('PTY', `Spawning ${shell} with args:`, args, 'options:', ptyOptions);
    const term = pty.spawn(shell, args, ptyOptions);

    term.onData(data => {
      onEvent({
        channel: 'pty:stdout',
        type: 'chunk', 
        payload: ptyOptions.encoding === null ? data : new TextEncoder().encode(data)
      });
    });

    term.onExit((exitInfo) => {
      logger.info('PTY', `Process exited with code ${exitInfo.exitCode}, signal ${exitInfo.signal}`);
      onEvent({
        channel: 'system:status',
        type: 'closed',
        payload: { 
          exitCode: exitInfo.exitCode,
          signal: exitInfo.signal
        }
      });
    });

    return {
      kind: 'pty',
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
      clear() {
        if (term.clear) {
          term.clear();
        }
      },
      pause() {
        if (term.pause) {
          term.pause();
        }
      },
      resume() {
        if (term.resume) {
          term.resume();
        }
      },
      close() {
        term.kill();
      },
      // Expose pty properties
      get pid() { return term.pid; },
      get process() { return term.process; },
      get cols() { return term.cols; },
      get rows() { return term.rows; }
    };
  }
}

// src/lib/server/adapters/ClaudeAdapter.js  
export class ClaudeAdapter {
  async create({ workspacePath, options, onEvent }) {
    // Import Claude Code
    const { createClaudeCodeSession } = await import('../claude/ClaudeCodeSession.js');
    
    const session = await createClaudeCodeSession({
      workingDirectory: workspacePath || '/tmp',
      ...options
    });

    // Handle Claude message deltas
    session.onMessage((delta) => {
      onEvent({
        channel: 'claude:delta',
        type: 'text',
        payload: { content: delta }
      });
    });

    session.onComplete(() => {
      onEvent({
        channel: 'claude:message',
        type: 'complete',
        payload: {}
      });
    });

    return {
      kind: 'claude',
      input: {
        write(data) {
          const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
          session.send(message);
        }
      },
      close() {
        session.end();
      }
    };
  }
}
```

### Step 3: Replace Socket.IO Setup (Direct)

**Action**: Replace `src/lib/server/socket-setup.js` with new unified handlers

```javascript
// src/lib/server/socket-setup.js (new implementation)
import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { logger } from './utils/logger.js';

let activeIO = null;

export function getActiveSocketIO() {
  return activeIO;
}

export function setupSocketIO(httpServer, services) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  activeIO = io;

  const { runSessionManager } = services;

  io.on('connection', (socket) => {
    logger.info('SOCKET', `Client connected: ${socket.id}`);
    socket.data = { authenticated: false };

    // Authentication
    socket.on('auth', (key, callback) => {
      if (!validateKey(key)) {
        callback?.({ success: false, error: 'Invalid key' });
        return;
      }
      socket.data.authenticated = true;
      callback?.({ success: true });
    });

    // Client identification
    socket.on('client:hello', ({ clientId }) => {
      socket.data.clientId = clientId;
      logger.info('SOCKET', `Client identified: ${clientId}`);
    });

    // Attach to run session
    socket.on('run:attach', async ({ runId, afterSeq }, ack) => {
      if (!socket.data.authenticated) {
        ack?.({ error: 'Not authenticated' });
        return;
      }
      
      socket.join(`run:${runId}`);
      try {
        const backlog = await runSessionManager.getEventsSince(runId, afterSeq || 0);
        ack?.(backlog);
        logger.info('SOCKET', `Client attached to run:${runId}, sent ${backlog.length} events`);
      } catch (error) {
        logger.error('SOCKET', `Failed to attach to run:${runId}`, error);
        ack?.({ error: 'Failed to attach' });
      }
    });

    // Send input to run session
    socket.on('run:input', ({ runId, channel, type, data }) => {
      if (!socket.data.authenticated) return;
      
      const live = runSessionManager.getRunSession(runId);
      if (!live) {
        logger.warn('SOCKET', `Run session not found: ${runId}`);
        return;
      }
      
      try {
        live.proc.input.write(data);
        // Optionally log input events
        runSessionManager.recordAndEmit(runId, { channel, type, payload: data });
      } catch (error) {
        logger.error('SOCKET', `Failed to send input to run:${runId}`, error);
      }
    });

    // Resize terminal (PTY-specific operation)
    socket.on('run:resize', ({ runId, cols, rows }) => {
      if (!socket.data.authenticated) return;
      
      const live = runSessionManager.getRunSession(runId);
      if (live?.proc.resize) {
        live.proc.resize(cols, rows);
      }
    });

    // Close run session
    socket.on('run:close', async ({ runId }) => {
      if (!socket.data.authenticated) return;
      
      try {
        await runSessionManager.closeRunSession(runId);
        socket.leave(`run:${runId}`);
        logger.info('SOCKET', `Run session closed: ${runId}`);
      } catch (error) {
        logger.error('SOCKET', `Failed to close run:${runId}`, error);
      }
    });

    socket.on('disconnect', () => {
      logger.info('SOCKET', `Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
```

### Step 4: Update Service Initialization (Direct)

**Action**: Replace service setup in `src/app.js`

```javascript
// Update src/app.js to use new services
import { RunSessionManager } from './lib/server/runtime/RunSessionManager.js';
import { PtyAdapter } from './lib/server/adapters/PtyAdapter.js';
import { ClaudeAdapter } from './lib/server/adapters/ClaudeAdapter.js';
import { DatabaseManager } from './lib/server/db/DatabaseManager.js';

// Initialize services
const database = new DatabaseManager();
await database.init();

const io = setupSocketIO(httpServer, { database });

const runSessionManager = new RunSessionManager(database, io);
runSessionManager.registerAdapter('pty', new PtyAdapter());
runSessionManager.registerAdapter('claude', new ClaudeAdapter());

// Update services object
const services = {
  database,
  runSessionManager
};
```

### Step 5: Update API Routes (Direct)

**Action**: Simplify `src/routes/api/sessions/+server.js`

```javascript
// Simplified session API
export async function POST({ request, locals }) {
  const { kind, cwd, options = {} } = await request.json();
  
  try {
    const { runId } = await locals.services.runSessionManager.createRunSession({
      kind,
      meta: {
        cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,  // Working directory set by client
        options                     // Pass through all Claude/PTY options
      }
    });
    
    return new Response(JSON.stringify({ runId }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
```

**Claude Code SDK Options Support:**

When creating Claude runs, clients can pass any options from the [Claude Code SDK](https://docs.claude.com/en/docs/claude-code/sdk/sdk-typescript#query):

```javascript
// Example Claude run creation with SDK options
const claudeRun = await fetch('/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'claude',
    cwd: '/path/to/project',
    options: {
      permissionMode: 'acceptEdits',        // 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
      maxTurns: 10,
      customSystemPrompt: 'You are a helpful coding assistant...',
      additionalDirectories: ['/additional/access'],
      allowedTools: ['Edit', 'Read', 'Bash'],
      env: { NODE_ENV: 'development' },
      mcpServers: {
        'my-server': {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      },
      hooks: {
        PreToolUse: [{
          hooks: [(input, toolUseId, { signal }) => {
            console.log('About to use tool:', input.tool_name);
            return Promise.resolve({ continue: true });
          }]
        }]
      },
      includePartialMessages: true  // Enable streaming deltas
    }
  })
});
```

**Available Claude Code SDK Options:**

- `model`: Claude model to use
- `permissionMode`: Permission handling mode
- `maxTurns`: Maximum conversation turns
- `customSystemPrompt`: Custom system prompt
- `appendSystemPrompt`: Text to append to system prompt  
- `additionalDirectories`: Extra directories Claude can access
- `allowedTools`/`disallowedTools`: Tool access control
- `env`: Environment variables
- `mcpServers`: MCP server configurations
- `hooks`: Event hooks for tool usage, sessions, etc.
- `includePartialMessages`: Enable streaming message deltas
- And all other options from the SDK `Options` type

export async function DELETE({ url, locals }) {
  const runId = url.searchParams.get('runId');
  
  if (!runId) {
    return new Response('Missing runId', { status: 400 });
  }
  
  try {
    await locals.services.runSessionManager.closeRunSession(runId);
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Layout management API  
export async function PUT({ request, locals }) {
  const { runId, clientId, tileId, position } = await request.json();
  
  try {
    // Update or create layout for this client
    await locals.services.database.run(`
INSERT OR REPLACE INTO workspace_layout
      (run_id, client_id, tile_id, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [runId, clientId, tileId, position || 0, Date.now(), Date.now()]);

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

```

### Step 6: Update Client Components (Direct)

**Action**: Replace existing client session management

```javascript
// src/lib/client/RunSessionClient.js (new)
import { io } from 'socket.io-client';

export function ensureClientId() {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('clientId', id);
  }
  return id;
}

export function attachToRunSession(runId, lastSeq, onEvent) {
  const socket = io({ path: '/socket' });
  
  socket.emit('client:hello', { clientId: ensureClientId() });
  
  socket.emit('run:attach', { runId, afterSeq: lastSeq || 0 }, (backlog) => {
    if (Array.isArray(backlog)) {
      backlog.forEach(onEvent);
    }
  });
  
  socket.on('run:event', onEvent);
  
  return {
    send(channel, type, data) {
      socket.emit('run:input', { runId, channel, type, data });
    },
    resize(cols, rows) {
      socket.emit('run:resize', { runId, cols, rows });
    },
    disconnect() {
      socket.close();
    }
  };
}
```

```svelte
<!-- Updated TerminalPane.svelte -->
<script>
  import { attachToRunSession } from '$lib/client/RunSessionClient.js';
  
  export let runId;
  
  let events = [];
  let cursor = 0;
  let connection;
  
  onMount(() => {
    connection = attachToRunSession(runId, cursor, (ev) => {
      cursor = Math.max(cursor, ev.seq);
      
      // Handle different event types
      if (ev.channel === 'pty:stdout' && ev.type === 'chunk') {
        // Decode payload and add to terminal
        const text = new TextDecoder().decode(ev.payload);
        terminal.write(text);
      }
      
      events = [...events, ev];
    });
    
  });

  onDestroy(() => connection?.disconnect());
  
  function sendInput(text) {
    connection?.send('pty:stdin', 'chunk', text);
  }
  
  function handleResize(cols, rows) {
    connection?.resize(cols, rows);
  }
</script>
```

## Simplification Opportunities

### 1. **Eliminate Session ID Complexity**

- **Before**: appSessionId, typeSpecificId, socketId
- **After**: Single runId for everything

### 2. **Unify Event Handling**

- **Before**: Different patterns for terminal data vs Claude messages
- **After**: All events flow through typed channels (pty:stdout, claude:delta)

### 3. **Consolidate Storage**

- **Before**: 6 session-related tables
- **After**: 2 tables (sessions + session_events)

### 4. **Simplify Socket.IO**

- **Before**: 20+ different event types scattered across socket-setup.js
- **After**: 4 core events (client:hello, run:attach, run:input, run:close)

### 5. **Remove Abstraction Layers**

- **Before**: SessionManager → SessionRouter → TerminalManager/ClaudeSessionManager
- **After**: RunSessionManager → Adapters (direct delegation)

## PTY Options Support

The `PtyAdapter` supports all node-pty options from the TypeScript definitions. Clients can pass a comprehensive `options` object when creating PTY sessions:

**Basic Options:**

- `shell`: The shell to use (default: system shell)
- `args`: Arguments to pass to the shell
- `cols`: Terminal columns (default: 80)
- `rows`: Terminal rows (default: 24)  
- `cwd`: Working directory (default: process.cwd())
- `env`: Environment variables (merged with process.env)
- `name`: Terminal name/type (default: 'xterm-256color')
- `encoding`: String encoding ('utf8' or null for binary, default: 'utf8')

**Flow Control Options (Experimental):**

- `handleFlowControl`: Enable flow control (default: false)
- `flowControlPause`: Pause character (default: '\x13' - XOFF)
- `flowControlResume`: Resume character (default: '\x11' - XON)

**Unix-Specific Options:**

- `uid`: User ID for the spawned process
- `gid`: Group ID for the spawned process

**Windows-Specific Options:**

- `useConpty`: Use Windows ConPTY (default: true on Windows 10+)  
- `useConptyDll`: Use conpty DLL directly
- `conptyInheritCursor`: Inherit cursor position

**Client Usage Examples:**

```javascript
// Basic PTY session
socket.emit('run:attach', {
  runId: 'terminal-123',
  kind: 'pty',
  cwd: '/home/user/project'
});

// PTY with custom shell and environment
socket.emit('run:attach', {
  runId: 'terminal-124', 
  kind: 'pty',
  cwd: '/home/user/project',
  options: {
    shell: '/bin/zsh',
    args: ['--login'],
    env: {
      TERM: 'screen-256color',
      NODE_ENV: 'development'
    }
  }
});

// PTY with custom dimensions and encoding
socket.emit('run:attach', {
  runId: 'terminal-125',
  kind: 'pty', 
  cwd: '/tmp',
  options: {
    cols: 120,
    rows: 40,
    encoding: null, // Binary mode
    name: 'xterm-256color'
  }
});

// PTY with flow control (experimental)
socket.emit('run:attach', {
  runId: 'terminal-126',
  kind: 'pty',
  cwd: '/opt/app',
  options: {
    handleFlowControl: true,
    flowControlPause: '\x13', // XOFF
    flowControlResume: '\x11' // XON
  }
});

// Unix: PTY with specific user/group
socket.emit('run:attach', {
  runId: 'terminal-127',
  kind: 'pty',
  cwd: '/var/app',
  options: {
    uid: 1000,
    gid: 1000,
    shell: '/bin/bash'
  }
});

// Windows: PTY with ConPTY options
socket.emit('run:attach', {
  runId: 'terminal-128',
  kind: 'pty',
  cwd: 'C:\\Projects',
  options: {
    shell: 'powershell.exe',
    useConpty: true,
    conptyInheritCursor: true
  }
});
```

## Benefits of New Architecture

### 1. **Stateless UI Recovery**

All UI state can be rebuilt from (runId, seq) cursor in the event log.

### 2. **Multi-Client Support**  

Multiple browser tabs can attach to the same runId and receive synchronized events.

### 3. **Reliable Resume**

After disconnect/reload, clients request events since last seen sequence number.

### 4. **Extensible Event Types**

Easy to add new channels (ssh:output, jupyter:result) without changing core architecture.

### 5. **Simplified Testing**

Event-driven architecture with clear input/output makes unit testing straightforward.

### 6. **Better Observability**

All session activity is logged in a queryable event stream.

## Conclusion

This implementation plan applies the suggested minimal pattern to Dispatch with a **direct refactoring approach** suitable for a POC:

- **Replace** rather than migrate - clean implementation without compatibility concerns
- **Dramatic simplification** - from 6 tables to 2, from 3 manager layers to 1
- **Fast implementation** - ~13 hours of focused development vs weeks of gradual migration  
- **Clean architecture** - event-sourced sessions with typed channels from day one
- **No technical debt** - fresh start without legacy compatibility layers

The new architecture provides:

- Single `runId` for all session operations
- Event-sourced history with reliable resume
- Multi-client support out of the box
- Extensible adapter pattern for new session types
- Unified Socket.IO interface with 4 core events

This approach takes full advantage of the POC status to implement the pattern correctly from the start, rather than compromising with migration complexity.
