// src/lib/server/socket-handler.js
import { TerminalManager } from './terminal.js';
import { addSession, switchSession, endSession, getSessions, updateSessionName } from './session-store.js';
import { getClaudeService } from './claude-auth-middleware.js';
import fs from 'node:fs';

const terminalManager = new TerminalManager();
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const PTY_ROOT = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
const TUNNEL_FILE = process.env.TUNNEL_FILE || `${PTY_ROOT}/tunnel-url.txt`;

// Check if auth key is required
const AUTH_REQUIRED = ENABLE_TUNNEL || TERMINAL_KEY !== 'change-me';

/** @type {Map<string, Set<string>>} */
const socketSessions = new Map();
/** @type {Map<string, Map<string, Function>>} */
const socketUnsubscribers = new Map();

export function handleConnection(socket) {
  console.log('Socket connected:', socket.id);
  
  let authenticated = !AUTH_REQUIRED; // Skip auth if not required

  // Authentication
  socket.on('auth', (key, callback) => {
    if (!AUTH_REQUIRED) {
      authenticated = true;
      if (callback) callback({ ok: true });
      console.log('Socket authenticated (no auth required):', socket.id);
    } else if (key === TERMINAL_KEY) {
      authenticated = true;
      if (callback) callback({ ok: true });
      console.log('Socket authenticated:', socket.id);
    } else {
      if (callback) callback({ ok: false, error: 'Invalid key' });
      console.log('Socket auth failed:', socket.id);
    }
  });

  // Create new session
  socket.on('create', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback({ ok: false, error: 'Not authenticated' });
      return;
    }

    try {
      const createOpts = {
        mode: opts.mode,
        cols: opts.cols,
        rows: opts.rows,
        name: opts.name, // Pass the optional name parameter
        parentSessionId: opts.parentSessionId // Pass parent session ID for shared directory
      };
      const { sessionId, pty, name } = terminalManager.createSession(createOpts);
      
      // Add session to this socket's session set
      if (!socketSessions.has(socket.id)) {
        socketSessions.set(socket.id, new Set());
      }
      socketSessions.get(socket.id).add(sessionId);

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

      // Note: Subscription to session data is handled in the 'attach' handler
      // This allows sessions to be created without immediately consuming output

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        
        // Clean up this specific session
        const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
        if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
          const unsubscribe = sessionUnsubscribers.get(sessionId);
          if (unsubscribe) {
            unsubscribe();
            sessionUnsubscribers.delete(sessionId);
          }
        }
        
        // Remove session from socket's session set
        const sessions = socketSessions.get(socket.id);
        if (sessions) {
          sessions.delete(sessionId);
        }
        
        // Note: We don't remove session metadata when PTY exits
        // Sessions persist and can be reconnected to with new PTY processes
      });

      if (callback) callback({ ok: true, sessionId, name });
    } catch (err) {
      if (callback) callback({ ok: false, error: err.message });
    }
  });

  // List sessions (auth required)
  socket.on('list', (callback) => {
    if (!authenticated) {
      if (callback) callback({ ok: false, error: 'Not authenticated' });
      return;
    }
    
    try {
      if (callback) callback({ ok: true, ...getSessions() });
    } catch (err) {
      if (callback) callback({ ok: false, error: err.message });
    }
  });

  // Attach to existing session
  socket.on('attach', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback({ ok: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId } = opts;
    let pty = terminalManager.getSession(sessionId);
    
    if (!pty) {
      // Check if session exists in persistent storage
      const sessions = getSessions();
      const persistentSession = sessions.sessions.find(s => s.id === sessionId);
      
      if (persistentSession) {
        // Session exists but PTY is dead, create a new PTY with existing session ID
        try {
          const result = terminalManager.createSessionWithId(sessionId, {
            mode: terminalManager.defaultMode, // Use default mode for resumed sessions
            cols: opts.cols || 80,
            rows: opts.rows || 24,
            name: persistentSession.name
          });
          pty = result.pty;
          console.log(`Resumed session: ${sessionId} (${persistentSession.name})`);
        } catch (err) {
          if (callback) callback({ ok: false, error: `Failed to resume session: ${err.message}` });
          return;
        }
      } else {
        if (callback) callback({ ok: false, error: 'Session not found' });
        return;
      }
    }

    // Add session to this socket's session set
    if (!socketSessions.has(socket.id)) {
      socketSessions.set(socket.id, new Set());
    }
    socketSessions.get(socket.id).add(sessionId);

    // Send buffered data first
    const bufferedData = terminalManager.getBufferedData(sessionId);
    if (bufferedData) {
      socket.emit('output', { sessionId, data: bufferedData });
    }

    // Resize if dimensions provided
    if (opts.cols && opts.rows) {
      terminalManager.resizeSession(sessionId, opts.cols, opts.rows);
    }

    // Subscribe to session data
    const unsubscribe = terminalManager.subscribeToSession(sessionId, (data) => {
      socket.emit('output', { sessionId, data });
    });
    
    // Store unsubscriber for this specific session
    if (!socketUnsubscribers.has(socket.id)) {
      socketUnsubscribers.set(socket.id, new Map());
    }
    socketUnsubscribers.get(socket.id).set(sessionId, unsubscribe);

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        
        // Clean up this specific session
        const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
        if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
          const unsubscribe = sessionUnsubscribers.get(sessionId);
          if (unsubscribe) {
            unsubscribe();
            sessionUnsubscribers.delete(sessionId);
          }
        }
        
        // Remove session from socket's session set
        const sessions = socketSessions.get(socket.id);
        if (sessions) {
          sessions.delete(sessionId);
        }
        
        // Note: We don't remove session metadata when PTY exits
        // Sessions persist and can be reconnected to with new PTY processes
    });

    if (callback) callback({ ok: true });
  });

  // Handle input from client
  socket.on('input', (data, sessionId) => {
    // Allow /login command even without authentication
    const isLoginCommand = data && typeof data === 'string' && 
      (data.trim() === '/login' || data.trim().startsWith('claude setup-token') || data.trim().startsWith('npx @anthropic-ai/claude setup-token'));
    
    if (!authenticated && !isLoginCommand) {
      return;
    }
    
    // Use provided sessionId, or fall back to first session in socket's session set
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0) {
        targetSessionId = sessions.values().next().value;
      }
    }
    
    if (targetSessionId) {
      // Handle /login command specially
      if (isLoginCommand && data.trim() === '/login') {
        // Convert /login to the actual claude setup-token command
        terminalManager.writeToSession(targetSessionId, 'npx @anthropic-ai/claude setup-token\r');
      } else {
        terminalManager.writeToSession(targetSessionId, data);
      }
    }
  });

  // Handle resize
  socket.on('resize', (dims) => {
    if (!authenticated) return;
    
    // Resize specific session or all sessions for this socket
    const targetSessionId = dims.sessionId;
    if (targetSessionId && dims.cols && dims.rows) {
      terminalManager.resizeSession(targetSessionId, dims.cols, dims.rows);
    } else {
      // Fall back to resizing first session if no specific session provided
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0 && dims.cols && dims.rows) {
        const firstSessionId = sessions.values().next().value;
        terminalManager.resizeSession(firstSessionId, dims.cols, dims.rows);
      }
    }
  });

  // End session
  socket.on('end', (sessionIdArg) => {
    if (!authenticated) return;

    // Use provided sessionId or default to first session in socket's set
    let sessionId = sessionIdArg;
    if (!sessionId) {
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0) {
        sessionId = sessions.values().next().value;
      }
    }
    
    if (sessionId) {
      terminalManager.endSession(sessionId);
      
      // Remove session from socket's session set
      const sessions = socketSessions.get(socket.id);
      if (sessions) {
        sessions.delete(sessionId);
      }
      
      // Clean up unsubscriber for this session
      const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
      if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
        const unsubscribe = sessionUnsubscribers.get(sessionId);
        if (unsubscribe) {
          unsubscribe();
          sessionUnsubscribers.delete(sessionId);
        }
      }
      
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
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId, newName } = opts;

    if (!sessionId || !newName) {
      if (callback) callback({ success: false, error: 'sessionId and newName are required' });
      return;
    }

    try {
      // Get current session metadata to return old name
      const sessionData = getSessions();
      const session = sessionData.sessions.find(s => s.id === sessionId);
      
      if (!session) {
        if (callback) callback({ success: false, error: 'Session not found' });
        return;
      }

      const oldName = session.name;

      // Rename in TerminalManager (handles validation and symlinks)
      const actualNewName = terminalManager.renameSession(sessionId, newName);
      
      // Update persistent session storage
      updateSessionName(sessionId, actualNewName);
      
      // Broadcast updated sessions list
      socket.server.emit('sessions-updated', getSessions());
      
      if (callback) callback({
        success: true,
        sessionId,
        oldName,
        newName: actualNewName
      });
      
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Get public URL (no auth required)
  socket.on('get-public-url', (callback) => {
    try {
      const url = fs.readFileSync(TUNNEL_FILE, 'utf-8').trim();
      if (callback) callback({ ok: true, url });
    } catch {
      if (callback) callback({ ok: true, url: null });
    }
  });

  // Detach from session (but don't end it)
  socket.on('detach', () => {
    // Clean up all sessions for this socket
    const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
    if (sessionUnsubscribers) {
      sessionUnsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
      socketUnsubscribers.delete(socket.id);
    }
    socketSessions.delete(socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    
    // Clean up all sessions for this socket
    const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
    if (sessionUnsubscribers) {
      sessionUnsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
      socketUnsubscribers.delete(socket.id);
    }
    socketSessions.delete(socket.id);
  });
}