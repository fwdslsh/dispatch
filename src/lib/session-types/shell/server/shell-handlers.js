/**
 * Simple Shell Session Handlers
 * 
 * Straightforward handler functions without complex abstractions.
 * These replace complex session type registration with direct handler exports.
 */

import { TerminalManager } from './terminal.server.js';
import { 
  createAuthHandler,
  createCallbackHandler,
  createInputHandler,
  validateRequiredFields,
  generateSessionId,
  logSessionOperation,
  emitSessionEvent
} from '../../../shared/factories/BaseHandlerFactory.js';

// Initialize terminal manager (could be shared or per-handler)
let terminalManager = null;

/**
 * Create shell session handlers
 * Simple function that returns handler object - no complex factory patterns
 * 
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @returns {Object} Handler functions
 */
export function createShellHandlers(io, socket, requireAuth) {
  // Initialize terminal manager if not already done
  if (!terminalManager) {
    terminalManager = new TerminalManager();
  }

  return {
    // Create new shell session
    'create': createAuthHandler(requireAuth, async (options, callback) => {
      logSessionOperation('Creating shell session', socket.id);

      const sessionOptions = {
        name: options.name || 'Shell Session',
        mode: 'shell',
        cols: Math.max(10, Math.min(500, parseInt(options.cols) || 80)),
        rows: Math.max(5, Math.min(200, parseInt(options.rows) || 24)),
        socket
      };

      const result = await terminalManager.create(sessionOptions);

      if (result && result.sessionId) {
        logSessionOperation('Shell session created', result.sessionId);
        callback({ success: true, sessionId: result.sessionId, session: result });
        
        // Broadcast session creation
        emitSessionEvent(io, 'session-created', { sessionId: result.sessionId, type: 'shell' });
      } else {
        throw new Error('Failed to create shell session');
      }
    }),

    // Attach to existing shell session
    'attach': createAuthHandler(requireAuth, async (options, callback) => {
      if (!validateRequiredFields(options, ['sessionId'], callback)) return;

      const { sessionId } = options;
      const cols = Math.max(10, Math.min(500, parseInt(options.cols) || 80));
      const rows = Math.max(5, Math.min(200, parseInt(options.rows) || 24));

      const success = await terminalManager.attach(sessionId, socket, { cols, rows });

      if (success) {
        logSessionOperation('Attached to shell session', sessionId);
        const sessionInfo = terminalManager.getSession(sessionId);
        callback({ success: true, sessionId, session: sessionInfo });
      } else {
        callback({ success: false, error: 'Failed to attach to session' });
      }
    }),

    // List shell sessions
    'list': createAuthHandler(requireAuth, (callback) => {
      const sessions = terminalManager.getAllSessions();
      const shellSessions = sessions.filter(s => s.mode === 'shell');
      
      logSessionOperation(`Listing ${shellSessions.length} shell sessions`, 'all');
      callback({ success: true, sessions: shellSessions });
    }),

    // End shell session
    'end': createAuthHandler(requireAuth, async (sessionId, callback) => {
      const success = await terminalManager.destroy(sessionId);
      
      if (success) {
        logSessionOperation('Shell session ended', sessionId);
        callback({ success: true });
        
        // Broadcast session ended
        emitSessionEvent(io, 'session-ended', { sessionId, type: 'shell', exitCode: 0 });
      } else {
        callback({ success: false, error: 'Failed to end session' });
      }
    }),

    // Send input to shell session
    'input': createInputHandler(requireAuth, (data) => {
      // Find the session for this socket
      const sessions = terminalManager.getAllSessions();
      const session = sessions.find(s => s.socket === socket);
      
      if (session && session.sessionId) {
        terminalManager.write(session.sessionId, data);
      } else {
        console.warn('No active shell session for input');
      }
    }),

    // Resize shell session
    'resize': createInputHandler(requireAuth, (dimensions) => {
      const { cols, rows } = dimensions;
      if (!cols || !rows) {
        console.warn('Invalid resize dimensions');
        return;
      }

      // Find the session for this socket
      const sessions = terminalManager.getAllSessions();
      const session = sessions.find(s => s.socket === socket);
      
      if (session && session.sessionId) {
        const safeCols = Math.max(10, Math.min(500, parseInt(cols)));
        const safeRows = Math.max(5, Math.min(200, parseInt(rows)));
        
        terminalManager.resize(session.sessionId, { cols: safeCols, rows: safeRows });
        logSessionOperation('Shell session resized', session.sessionId, { cols: safeCols, rows: safeRows });
      } else {
        console.warn('No active shell session for resize');
      }
    })
  };
}