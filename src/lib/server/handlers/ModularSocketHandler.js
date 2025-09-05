/**
 * Modular Socket Handler
 * 
 * Clean, modular socket handler that uses feature-specific handlers.
 * Replaces the monolithic socket-handler.js with proper separation of concerns.
 */

import { createAuthSocketHandlers } from '../../shared/server/AuthSocketHandler.js';
import { createAndRegisterProjectHandlers } from '../../projects/server/ProjectSocketHandler.js';
import { createAndRegisterSessionHandlers } from '../../sessions/server/SessionSocketHandler.js';
import { createAndRegisterUtilityHandlers } from '../../shared/server/UtilitySocketHandler.js';

// Global state tracking (shared across all socket connections)
const authenticatedSockets = new Set();
const socketSessions = new Map(); // socketId -> sessionId

/**
 * Create modular socket handler
 * @param {Object} io - Socket.IO instance
 * @returns {Function} Socket connection handler
 */
export function createModularSocketHandler(io) {
  return (socket) => {
    console.log(`[MODULAR] Socket connected: ${socket.id}`);

    // Create authentication handlers
    const authHandlers = createAuthSocketHandlers(io, socket, authenticatedSockets);
    
    // Register authentication events
    socket.on('auth', authHandlers.auth);
    socket.on('disconnect', () => {
      authHandlers.disconnect();
      handleSocketDisconnect(socket);
    });

    // Get auth utility function
    const requireAuth = authHandlers.requireAuth;

    // Create and register feature-specific handlers
    const projectHandlers = createAndRegisterProjectHandlers(io, socket, requireAuth);
    const sessionHandlers = createAndRegisterSessionHandlers(io, socket, requireAuth, socketSessions);
    const utilityHandlers = createAndRegisterUtilityHandlers(io, socket, requireAuth);

    // Log successful handler registration
    const totalHandlers = Object.keys(projectHandlers).length + 
                         Object.keys(sessionHandlers).length + 
                         Object.keys(utilityHandlers).length + 2; // +2 for auth and disconnect

    console.log(`[MODULAR] Socket ${socket.id} initialized with ${totalHandlers} handlers across 4 modules`);
    console.log(`[MODULAR] Auth required: ${authHandlers.authRequired}`);

    // Store handler references for potential cleanup or debugging
    socket.handlerModules = {
      auth: authHandlers,
      projects: projectHandlers,
      sessions: sessionHandlers,
      utilities: utilityHandlers
    };

    // Emit ready event to client
    socket.emit('server-ready', {
      socketId: socket.id,
      authRequired: authHandlers.authRequired,
      modules: ['auth', 'projects', 'sessions', 'utilities'],
      timestamp: new Date().toISOString()
    });
  };
}

/**
 * Handle socket disconnection cleanup
 * @param {Object} socket - Socket instance
 */
function handleSocketDisconnect(socket) {
  console.log(`[MODULAR] Socket disconnected: ${socket.id}`);
  
  // Clean up authentication
  authenticatedSockets.delete(socket.id);
  
  // Clean up session mapping
  const sessionId = socketSessions.get(socket.id);
  if (sessionId) {
    console.log(`[MODULAR] Cleaning up session ${sessionId} for disconnected socket ${socket.id}`);
    socketSessions.delete(socket.id);
  }

  // Additional cleanup can be added here for other modules
  
  console.log(`[MODULAR] Socket ${socket.id} cleanup completed`);
}

/**
 * Get current connection statistics
 * @param {Object} io - Socket.IO instance
 * @returns {Object} Connection statistics
 */
export function getConnectionStats(io) {
  const stats = {
    totalSockets: io.engine.clientsCount || 0,
    authenticatedSockets: authenticatedSockets.size,
    activeSessions: socketSessions.size,
    socketSessions: Array.from(socketSessions.entries()),
    timestamp: new Date().toISOString()
  };

  return stats;
}

/**
 * Get authenticated socket list
 * @returns {Array} Array of authenticated socket IDs
 */
export function getAuthenticatedSockets() {
  return Array.from(authenticatedSockets);
}

/**
 * Get active sessions mapping
 * @returns {Object} Object mapping socket IDs to session IDs
 */
export function getActiveSessionsMapping() {
  return Object.fromEntries(socketSessions.entries());
}

/**
 * Broadcast message to all authenticated sockets
 * @param {Object} io - Socket.IO instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function broadcastToAuthenticated(io, event, data) {
  const message = {
    event,
    data,
    timestamp: new Date().toISOString()
  };

  authenticatedSockets.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  });

  console.log(`[MODULAR] Broadcasted ${event} to ${authenticatedSockets.size} authenticated sockets`);
}

/**
 * Force disconnect a socket by ID
 * @param {Object} io - Socket.IO instance
 * @param {string} socketId - Socket ID to disconnect
 * @returns {boolean} True if socket was found and disconnected
 */
export function forceDisconnectSocket(io, socketId) {
  const socket = io.sockets.sockets.get(socketId);
  if (socket && socket.connected) {
    console.log(`[MODULAR] Force disconnecting socket ${socketId}`);
    socket.disconnect(true);
    return true;
  }
  return false;
}

/**
 * Health check for the modular socket handler
 * @param {Object} io - Socket.IO instance
 * @returns {Object} Health check results
 */
export function healthCheck(io) {
  const stats = getConnectionStats(io);
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    modules: {
      auth: { loaded: true, authenticatedCount: stats.authenticatedSockets },
      projects: { loaded: true },
      sessions: { loaded: true, activeCount: stats.activeSessions },
      utilities: { loaded: true }
    },
    connections: stats,
    issues: []
  };

  // Check for potential issues
  if (stats.totalSockets > 0 && stats.authenticatedSockets === 0) {
    health.issues.push('Connected sockets but none authenticated');
  }

  if (stats.activeSessions > stats.authenticatedSockets) {
    health.issues.push('More active sessions than authenticated sockets');
  }

  if (health.issues.length > 0) {
    health.status = 'warning';
  }

  return health;
}

// Export the main handler function as default
export default createModularSocketHandler;