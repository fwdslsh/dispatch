/**
 * Simple Server Session Type Configuration
 * 
 * Static server-side configuration without complex factories.
 * Maps session types to their server handlers directly.
 */

// Import server handler functions (not classes or complex factories)
import { createShellHandlers } from './shell/server/shell-handlers.js';
import { createClaudeHandlers } from './claude/server/claude-handlers.js';

/**
 * Simple mapping of session types to their handler creators
 * No complex registry - just direct function mapping
 */
export const SESSION_HANDLERS = {
  shell: createShellHandlers,
  claude: createClaudeHandlers
};

/**
 * Simple mapping of session types to their namespaces
 */
export const SESSION_NAMESPACES = {
  shell: '/shell',
  claude: '/claude'
};

/**
 * Get handler creator for a session type
 * @param {string} typeId - Session type ID
 * @returns {Function|null} Handler creator function or null
 */
export function getHandlerCreator(typeId) {
  return SESSION_HANDLERS[typeId] || null;
}

/**
 * Get namespace for a session type
 * @param {string} typeId - Session type ID
 * @returns {string|null} Namespace or null
 */
export function getNamespace(typeId) {
  return SESSION_NAMESPACES[typeId] || null;
}

/**
 * Get all available session type IDs
 * @returns {Array<string>} Array of session type IDs
 */
export function getAvailableTypes() {
  return Object.keys(SESSION_HANDLERS);
}

/**
 * Check if session type has server handlers
 * @param {string} typeId - Session type ID
 * @returns {boolean} True if handlers exist
 */
export function hasHandlers(typeId) {
  return typeId in SESSION_HANDLERS;
}

/**
 * Simple handler factory (replaces complex session type registration)
 * @param {string} typeId - Session type ID
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Auth check function
 * @returns {Object} Handler functions
 */
export function createHandlersForType(typeId, io, socket, requireAuth) {
  const handlerCreator = getHandlerCreator(typeId);
  
  if (!handlerCreator) {
    console.error(`No handlers found for session type: ${typeId}`);
    return {};
  }

  try {
    // Call the handler creator with simple parameters
    return handlerCreator(io, socket, requireAuth);
  } catch (error) {
    console.error(`Failed to create handlers for ${typeId}:`, error);
    return {};
  }
}

/**
 * Register session type handlers with a namespace
 * Simple function that replaces complex registry setup
 * @param {Object} io - Socket.IO instance
 * @param {string} typeId - Session type ID
 * @param {Function} requireAuth - Auth check function
 */
export function setupSessionTypeNamespace(io, typeId, requireAuth) {
  const namespace = getNamespace(typeId);
  
  if (!namespace) {
    console.error(`No namespace defined for session type: ${typeId}`);
    return;
  }

  try {
    const socketNamespace = io.of(namespace);
    
    socketNamespace.on('connection', (socket) => {
      console.log(`Socket connected to ${namespace}: ${socket.id}`);
      
      // Create and register handlers for this socket
      const handlers = createHandlersForType(typeId, io, socket, requireAuth);
      
      // Register all handlers
      Object.entries(handlers).forEach(([eventName, handler]) => {
        socket.on(eventName, (...args) => {
          try {
            handler(...args);
          } catch (error) {
            console.error(`Handler error for ${eventName} in ${namespace}:`, error);
          }
        });
      });
      
      console.log(`Registered ${Object.keys(handlers).length} handlers for ${namespace}`);
    });

    console.log(`Setup namespace ${namespace} for session type: ${typeId}`);
  } catch (error) {
    console.error(`Failed to setup namespace for ${typeId}:`, error);
  }
}