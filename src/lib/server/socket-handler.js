// src/lib/server/socket-handler.js
import { TerminalManager } from './terminal.js';

const terminalManager = new TerminalManager();
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';

/** @type {Map<string, string>} */
const socketSessions = new Map();

export function handleConnection(socket) {
  console.log('Socket connected:', socket.id);
  
  let authenticated = false;

  // Authentication
  socket.on('auth', (key, callback) => {
    if (key === TERMINAL_KEY) {
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
      const { sessionId, pty } = terminalManager.createSession(opts);
      socketSessions.set(socket.id, sessionId);

      // Forward PTY output to socket
      pty.onData((data) => {
        socket.emit('output', data);
      });

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        socketSessions.delete(socket.id);
      });

      callback({ ok: true, sessionId });
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

    // Resize if dimensions provided
    if (opts.cols && opts.rows) {
      terminalManager.resizeSession(sessionId, opts.cols, opts.rows);
    }

    // Forward PTY output to socket
    pty.onData((data) => {
      socket.emit('output', data);
    });

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
      socket.emit('ended', { exitCode, signal });
      socketSessions.delete(socket.id);
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
      terminalManager.resizeSession(sessionId, dims.cols, dims.rows);
    }
  });

  // End session
  socket.on('end', () => {
    if (!authenticated) return;
    
    const sessionId = socketSessions.get(socket.id);
    if (sessionId) {
      terminalManager.endSession(sessionId);
      socketSessions.delete(socket.id);
      socket.emit('ended');
    }
  });

  // Detach from session (but don't end it)
  socket.on('detach', () => {
    socketSessions.delete(socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    socketSessions.delete(socket.id);
  });
}