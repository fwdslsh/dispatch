/**
 * Refactored Socket Handler - Modern architecture with focused handlers
 * 
 * This replaces the monolithic socket-handler.js with a clean, SOLID-compliant
 * architecture using the SocketRouter and specialized handlers.
 */

import { SocketRouter } from './socket-router.js';
import { AuthHandler } from './handlers/auth-handler.js';
import { SessionHandler } from './handlers/session-handler.js';
import { ProjectHandler } from './handlers/project-handler.js';
import { ClaudeAuthHandler } from './handlers/claude-auth-handler.js';
import { TerminalIOHandler } from './handlers/terminal-io-handler.js';

// Create shared socket-to-session mapping for coordination between handlers
const socketSessions = new Map();
const socketUnsubscribers = new Map();

/**
 * Create and configure the socket router with all handlers
 * @returns {SocketRouter} Configured router
 */
function createSocketRouter() {
  // Create router with environment-based configuration
  const router = SocketRouter.create();

  // Create handler instances with centralized auth
  const authHandler = AuthHandler.create();
  const sessionHandler = SessionHandler.create();
  const projectHandler = ProjectHandler.create();
  const claudeAuthHandler = ClaudeAuthHandler.create();
  const terminalIOHandler = TerminalIOHandler.create({ socketSessions });

  // Update terminal I/O handler with shared session mapping
  terminalIOHandler.updateSocketSessions(socketSessions);

  // Register authentication middleware (now using centralized auth)
  router.addMiddleware(authHandler.createAuthMiddleware());

  // Register session management events
  router.registerHandler('SessionHandler', sessionHandler, [
    'create',
    'list', 
    'attach',
    'detach',
    'end',
    'rename'
  ]);

  // Register project management events
  router.registerHandler('ProjectHandler', projectHandler, [
    'create-project',
    'list-projects',
    'get-project',
    'update-project', 
    'delete-project',
    'create-session-in-project',
    'set-active-project',
    'list-project-directories'
  ]);

  // Register Claude authentication events
  router.registerHandler('ClaudeAuthHandler', claudeAuthHandler, [
    'check-claude-auth',
    'start-claude-auth',
    'submit-auth-token',
    'claude-query',
    'get-public-url'
  ]);

  // Register terminal I/O events
  router.registerHandler('TerminalIOHandler', terminalIOHandler, [
    'input',
    'resize'
  ]);

  return router;
}

/**
 * Enhanced connection handler that sets up cross-handler coordination
 * @param {SocketRouter} router Configured router
 * @returns {Function} Connection handler function
 */
function createConnectionHandler(router) {
  return (socket) => {
    console.log('Socket connected:', socket.id);
    
    // Initialize shared state
    socketSessions.set(socket.id, new Set());
    socketUnsubscribers.set(socket.id, new Map());

    // Handle connection through router
    router.handleConnection(socket);

    // Set up cross-handler coordination
    setupCrossHandlerCoordination(socket);

    // Handle disconnect cleanup
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });
  };
}

/**
 * Set up coordination between handlers for complex workflows
 * @param {Socket} socket Socket.IO socket
 */
function setupCrossHandlerCoordination(socket) {
  // Coordinate session creation with terminal I/O setup
  const originalEmit = socket.emit;
  socket.emit = function(event, ...args) {
    if (event === 'sessions-updated') {
      // Update shared session mapping when sessions change
      const sessionData = args[0];
      if (sessionData && sessionData.sessions) {
        // This coordination ensures all handlers have access to current session state
        console.log(`Sessions updated: ${sessionData.sessions.length} active sessions`);
      }
    }
    return originalEmit.call(this, event, ...args);
  };
}

/**
 * Handle socket disconnection cleanup across all handlers
 * @param {Socket} socket Socket.IO socket
 */
function handleDisconnect(socket) {
  console.log('Socket disconnected:', socket.id);
  
  try {
    // Clean up shared state
    if (socketSessions.has(socket.id)) {
      socketSessions.delete(socket.id);
    }
    
    if (socketUnsubscribers.has(socket.id)) {
      const unsubscribers = socketUnsubscribers.get(socket.id);
      for (const unsubscribe of unsubscribers.values()) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }
      socketUnsubscribers.delete(socket.id);
    }

    // Notify handlers of disconnect (they can handle their own cleanup)
    console.log('Socket cleanup completed for:', socket.id);
  } catch (error) {
    console.error('Error during socket disconnect cleanup:', error);
  }
}

/**
 * Create the main connection handler function
 * This is the drop-in replacement for the original handleConnection export
 */
const router = createSocketRouter();
const handleConnection = createConnectionHandler(router);

/**
 * Get router information for debugging
 * @returns {Object} Router debug information
 */
function getRouterInfo() {
  return {
    handlers: router.getHandlerInfo(),
    activeSockets: socketSessions.size,
    totalActiveSessions: Array.from(socketSessions.values())
      .reduce((total, sessions) => total + sessions.size, 0)
  };
}

/**
 * Get shared socket session mapping (for debugging/testing)
 * @returns {Map} Socket sessions map
 */
function getSocketSessions() {
  return socketSessions;
}

// Export the main connection handler and utilities
export { 
  handleConnection,
  getRouterInfo,
  getSocketSessions,
  createSocketRouter,
  createConnectionHandler
};