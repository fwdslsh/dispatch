/**
 * Session Socket Handler
 * 
 * Handles session-related socket events in isolation.
 * Provides clean separation of session management from other handlers.
 */

import { TerminalManager } from '../../session-types/shell/server/terminal.server.js';
import DirectoryManager from '../../server/services/directory-manager.js';
import fs from 'fs';

/**
 * Create session socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @param {Map} socketSessions - Shared socket sessions map
 * @returns {Object} Session handler functions
 */
export function createSessionSocketHandlers(io, socket, requireAuth, socketSessions) {
  // Initialize services
  const terminalManager = new TerminalManager();
  const directoryManager = new DirectoryManager();

  /**
   * Create a new session
   */
  const createSessionHandler = async (options, callback) => {
    try {
      console.log(`[SESSION] Creating session for socket ${socket.id}:`, options);

      // Validate options
      if (!options || typeof options !== 'object') {
        if (callback) callback({ success: false, error: 'Invalid session options' });
        return;
      }

      const sessionOptions = {
        name: options.name || 'Terminal Session',
        mode: options.mode || 'shell',
        cols: Math.max(10, Math.min(500, parseInt(options.cols) || 80)),
        rows: Math.max(5, Math.min(200, parseInt(options.rows) || 24)),
        projectId: options.projectId || options.project?.id,
        customOptions: options.customOptions || {}
      };

      // Create directory context if project specified
      let workingDirectory;
      if (sessionOptions.projectId) {
        workingDirectory = await directoryManager.getProjectDirectory(sessionOptions.projectId);
      }

      // Create terminal session
      const result = await terminalManager.create({
        ...sessionOptions,
        workingDirectory,
        socket
      });

      if (result && result.sessionId) {
        socketSessions.set(socket.id, result.sessionId);
        
        console.log(`[SESSION] Created session ${result.sessionId} for socket ${socket.id}`);
        
        // Broadcast session creation
        io.emit('session-created', {
          sessionId: result.sessionId,
          session: result,
          socketId: socket.id
        });

        if (callback) {
          callback({
            success: true,
            sessionId: result.sessionId,
            session: result
          });
        }
      } else {
        throw new Error('Failed to create terminal session');
      }
    } catch (error) {
      console.error('[SESSION] Error creating session:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Attach to an existing session
   */
  const attachSessionHandler = async (options, callback) => {
    try {
      console.log(`[SESSION] Attaching socket ${socket.id} to session:`, options);

      if (!options.sessionId) {
        if (callback) callback({ success: false, error: 'Session ID is required' });
        return;
      }

      const sessionId = options.sessionId;
      const cols = Math.max(10, Math.min(500, parseInt(options.cols) || 80));
      const rows = Math.max(5, Math.min(200, parseInt(options.rows) || 24));

      const success = await terminalManager.attach(sessionId, socket, { cols, rows });

      if (success) {
        socketSessions.set(socket.id, sessionId);
        console.log(`[SESSION] Socket ${socket.id} attached to session ${sessionId}`);
        
        const sessionInfo = terminalManager.getSession(sessionId);
        if (callback) {
          callback({
            success: true,
            sessionId,
            session: sessionInfo
          });
        }
      } else {
        if (callback) callback({ success: false, error: 'Failed to attach to session' });
      }
    } catch (error) {
      console.error('[SESSION] Error attaching to session:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * List all sessions
   */
  const listSessionsHandler = (callback) => {
    try {
      const sessions = terminalManager.getAllSessions();
      console.log(`[SESSION] Listing ${sessions.length} sessions for socket ${socket.id}`);

      if (callback) {
        callback({ success: true, sessions });
      }

      // Also emit sessions-updated event
      socket.emit('sessions-updated', { sessions });
    } catch (error) {
      console.error('[SESSION] Error listing sessions:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * End a session
   */
  const endSessionHandler = async (sessionId, callback) => {
    try {
      // If no sessionId provided, use the current socket's session
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        targetSessionId = socketSessions.get(socket.id);
      }

      if (!targetSessionId) {
        if (callback) callback({ success: false, error: 'No session to end' });
        return;
      }

      console.log(`[SESSION] Ending session ${targetSessionId} for socket ${socket.id}`);

      const success = await terminalManager.destroy(targetSessionId);

      if (success) {
        // Remove from socket mapping if it was the current session
        if (socketSessions.get(socket.id) === targetSessionId) {
          socketSessions.delete(socket.id);
        }

        // Broadcast session ended
        io.emit('session-ended', {
          sessionId: targetSessionId,
          socketId: socket.id,
          exitCode: 0
        });

        console.log(`[SESSION] Session ${targetSessionId} ended successfully`);
        
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, error: 'Failed to end session' });
      }
    } catch (error) {
      console.error('[SESSION] Error ending session:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * Detach from current session
   */
  const detachSessionHandler = (callback) => {
    try {
      const sessionId = socketSessions.get(socket.id);
      
      if (!sessionId) {
        if (callback) callback({ success: false, error: 'No session to detach from' });
        return;
      }

      console.log(`[SESSION] Detaching socket ${socket.id} from session ${sessionId}`);

      const success = terminalManager.detach(sessionId, socket);

      if (success) {
        socketSessions.delete(socket.id);
        console.log(`[SESSION] Socket ${socket.id} detached from session ${sessionId}`);
        
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, error: 'Failed to detach from session' });
      }
    } catch (error) {
      console.error('[SESSION] Error detaching from session:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * Send input to current session
   */
  const inputHandler = (data) => {
    try {
      const sessionId = socketSessions.get(socket.id);
      
      if (!sessionId) {
        console.warn(`[SESSION] No session for input from socket ${socket.id}`);
        return;
      }

      if (typeof data !== 'string') {
        console.warn(`[SESSION] Invalid input data type from socket ${socket.id}:`, typeof data);
        return;
      }

      console.log(`[SESSION] Sending input to session ${sessionId} from socket ${socket.id}`);
      terminalManager.write(sessionId, data);
    } catch (error) {
      console.error('[SESSION] Error sending input:', error);
    }
  };

  /**
   * Resize current session
   */
  const resizeHandler = (dims) => {
    try {
      const sessionId = socketSessions.get(socket.id);
      
      if (!sessionId) {
        console.warn(`[SESSION] No session to resize for socket ${socket.id}`);
        return;
      }

      if (!dims || !dims.cols || !dims.rows) {
        console.warn(`[SESSION] Invalid resize dimensions from socket ${socket.id}:`, dims);
        return;
      }

      const cols = Math.max(10, Math.min(500, parseInt(dims.cols)));
      const rows = Math.max(5, Math.min(200, parseInt(dims.rows)));

      console.log(`[SESSION] Resizing session ${sessionId} to ${cols}x${rows} from socket ${socket.id}`);
      terminalManager.resize(sessionId, { cols, rows });
    } catch (error) {
      console.error('[SESSION] Error resizing session:', error);
    }
  };

  /**
   * Handle socket disconnect
   */
  const disconnectHandler = () => {
    const sessionId = socketSessions.get(socket.id);
    if (sessionId) {
      console.log(`[SESSION] Socket ${socket.id} disconnected, cleaning up session ${sessionId}`);
      
      // Detach from session but don't end it (in case of reconnection)
      try {
        terminalManager.detach(sessionId, socket);
      } catch (error) {
        console.error('[SESSION] Error during disconnect cleanup:', error);
      }
      
      socketSessions.delete(socket.id);
    }
  };

  return {
    // Session lifecycle handlers
    'create': createSessionHandler,
    'attach': attachSessionHandler,
    'list': listSessionsHandler,
    'end': endSessionHandler,
    'detach': detachSessionHandler,
    
    // Session interaction handlers
    'input': inputHandler,
    'resize': resizeHandler,
    
    // Connection handlers
    'disconnect': disconnectHandler
  };
}

/**
 * Register session socket handlers with authentication
 * @param {Object} socket - Socket instance
 * @param {Object} handlers - Session handlers object
 * @param {Function} requireAuth - Authentication check function
 */
export function registerSessionHandlers(socket, handlers, requireAuth) {
  // Protected handlers that require authentication
  const protectedEvents = ['create', 'attach', 'list', 'end', 'detach', 'input', 'resize'];
  
  for (const [eventName, handler] of Object.entries(handlers)) {
    if (protectedEvents.includes(eventName)) {
      socket.on(eventName, (...args) => {
        if (!requireAuth()) {
          const callback = args.find(arg => typeof arg === 'function');
          if (callback) {
            callback({ success: false, error: 'Authentication required' });
          }
          return;
        }
        handler(...args);
      });
    } else {
      // Unprotected handlers (like disconnect)
      socket.on(eventName, handler);
    }
  }
}

/**
 * Session handler factory for easy integration
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @param {Map} socketSessions - Shared socket sessions map
 * @returns {Object} Configured and registered session handlers
 */
export function createAndRegisterSessionHandlers(io, socket, requireAuth, socketSessions) {
  const handlers = createSessionSocketHandlers(io, socket, requireAuth, socketSessions);
  registerSessionHandlers(socket, handlers, requireAuth);
  
  console.log(`[SESSION] Registered ${Object.keys(handlers).length} session handlers for socket ${socket.id}`);
  
  return handlers;
}