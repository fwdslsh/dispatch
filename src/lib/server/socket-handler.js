// src/lib/server/socket-handler.js
import { TerminalManager } from './terminal.js';
import { addSession, switchSession, endSession, getSessions, updateSessionName } from './session-store.js';
import fs from 'node:fs';

const terminalManager = new TerminalManager();
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const PTY_ROOT = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
const TUNNEL_FILE = process.env.TUNNEL_FILE || `${PTY_ROOT}/tunnel-url.txt`;

// Check if auth key is required
const AUTH_REQUIRED = ENABLE_TUNNEL || TERMINAL_KEY !== 'change-me';

/** @type {Map<string, string>} */
const socketSessions = new Map();
/** @type {Map<string, Function>} */
const socketUnsubscribers = new Map();

export function handleConnection(socket) {
  console.log('Socket connected:', socket.id);
  
  let authenticated = !AUTH_REQUIRED; // Skip auth if not required

  // Authentication
  socket.on('auth', (key, callback) => {
    if (!AUTH_REQUIRED) {
      authenticated = true;
      callback({ ok: true });
      console.log('Socket authenticated (no auth required):', socket.id);
    } else if (key === TERMINAL_KEY) {
      authenticated = true;
      callback({ ok: true });
      console.log('Socket authenticated:', socket.id);
    } else {
      callback({ ok: false, error: 'Invalid key' });
      console.log('Socket auth failed:', socket.id);
    }
  });

  // Create new session
  socket.on('create', (opts, callback) => {
    if (!authenticated) {
      callback({ ok: false, error: 'Not authenticated' });
      return;
    }

    try {
      const createOpts = {
        mode: opts.mode,
        cols: opts.cols,
        rows: opts.rows,
        name: opts.name // Pass the optional name parameter
      };
      const { sessionId, pty, name } = terminalManager.createSession(createOpts);
      socketSessions.set(socket.id, sessionId);

      // Store session metadata (minimal if not provided)
      try {
        const sessionMeta = opts && opts.meta ? 
          { id: sessionId, name, ...opts.meta } :
          { id: sessionId, name, host: 'local', port: '0', username: 'user' };
        
        addSession(sessionMeta);
        // Broadcast updated sessions list
        socket.server.emit('sessions-updated', getSessions());
      } catch (err) {
        console.warn('Failed to persist session metadata:', err.message);
      }

      // Subscribe to session data
      const unsubscribe = terminalManager.subscribeToSession(sessionId, (data) => {
        socket.emit('output', data);
      });
      socketUnsubscribers.set(socket.id, unsubscribe);

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        const unsubscribe = socketUnsubscribers.get(socket.id);
        if (unsubscribe) {
          unsubscribe();
          socketUnsubscribers.delete(socket.id);
        }
        socketSessions.delete(socket.id);
      });

      callback({ ok: true, sessionId, name });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  // List sessions (auth required)
  socket.on('list', (callback) => {
    if (!authenticated) {
      callback({ ok: false, error: 'Not authenticated' });
      return;
    }
    
    try {
      callback({ ok: true, ...getSessions() });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  // Attach to existing session
  socket.on('attach', (opts, callback) => {
    if (!authenticated) {
      callback({ ok: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId } = opts;
    const pty = terminalManager.getSession(sessionId);
    
    if (!pty) {
      callback({ ok: false, error: 'Session not found' });
      return;
    }

    socketSessions.set(socket.id, sessionId);

    // Send buffered data first
    const bufferedData = terminalManager.getBufferedData(sessionId);
    if (bufferedData) {
      socket.emit('output', bufferedData);
    }

    // Resize if dimensions provided
    if (opts.cols && opts.rows) {
      terminalManager.resizeSession(sessionId, opts.cols, opts.rows);
    }

    // Subscribe to session data
    const unsubscribe = terminalManager.subscribeToSession(sessionId, (data) => {
      socket.emit('output', data);
    });
    socketUnsubscribers.set(socket.id, unsubscribe);

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        const unsubscribe = socketUnsubscribers.get(socket.id);
        if (unsubscribe) {
          unsubscribe();
          socketUnsubscribers.delete(socket.id);
        }
        socketSessions.delete(socket.id);
        try {
          // Clean up persistent metadata when PTY exits
          endSession(sessionId);
          socket.server.emit('sessions-updated', getSessions());
        } catch (err) {
          console.warn('Failed to clean up session metadata on exit:', err.message);
        }
    });

    callback({ ok: true });
  });

  // Handle input from client
  socket.on('input', (data) => {
    if (!authenticated) return;
    
    const sessionId = socketSessions.get(socket.id);
    if (sessionId) {
      terminalManager.writeToSession(sessionId, data);
    }
  });

  // Handle resize
  socket.on('resize', (dims) => {
    if (!authenticated) return;
    
    const sessionId = socketSessions.get(socket.id);
    if (sessionId && dims.cols && dims.rows) {
      terminalManager.resizeSession(sessionId, dims.cols,100);
    }
  });

  // End session
  socket.on('end', (sessionIdArg) => {
    if (!authenticated) return;

    const sessionId = sessionIdArg || socketSessions.get(socket.id);
    if (sessionId) {
      terminalManager.endSession(sessionId);
      socketSessions.delete(socket.id);
      try {
        endSession(sessionId);
      } catch (err) {
        console.warn('Failed to remove session metadata on end:', err.message);
      }
      // Broadcast update
      socket.server.emit('sessions-updated', getSessions());
      socket.emit('ended');
    }
  });

  // Rename session
  socket.on('rename', (opts, callback) => {
    if (!authenticated) {
      callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId, newName } = opts;

    if (!sessionId || !newName) {
      callback({ success: false, error: 'sessionId and newName are required' });
      return;
    }

    try {
      // Get current session metadata to return old name
      const sessionData = getSessions();
      const session = sessionData.sessions.find(s => s.id === sessionId);
      
      if (!session) {
        callback({ success: false, error: 'Session not found' });
        return;
      }

      const oldName = session.name;

      // Rename in TerminalManager (handles validation and symlinks)
      const actualNewName = terminalManager.renameSession(sessionId, newName);
      
      // Update persistent session storage
      updateSessionName(sessionId, actualNewName);
      
      // Broadcast updated sessions list
      socket.server.emit('sessions-updated', getSessions());
      
      callback({
        success: true,
        sessionId,
        oldName,
        newName: actualNewName
      });
      
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Get public URL (no auth required)
  socket.on('get-public-url', (callback) => {
    try {
      const url = fs.readFileSync(TUNNEL_FILE, 'utf-8').trim();
      callback({ ok: true, url });
    } catch {
      callback({ ok: true, url: null });
    }
  });

  // Detach from session (but don't end it)
  socket.on('detach', () => {
    const unsubscribe = socketUnsubscribers.get(socket.id);
    if (unsubscribe) {
      unsubscribe();
      socketUnsubscribers.delete(socket.id);
    }
    socketSessions.delete(socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    const unsubscribe = socketUnsubscribers.get(socket.id);
    if (unsubscribe) {
      unsubscribe();
      socketUnsubscribers.delete(socket.id);
    }
    socketSessions.delete(socket.id);
  });
}