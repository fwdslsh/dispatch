/**
 * Namespaced Socket Handler - Enhanced socket handler with session type isolation
 * 
 * Extends the existing socket handler to support session type namespaces
 * while maintaining backward compatibility with the main namespace.
 */

import { TerminalManager } from '../../session-types/shell/server/terminal.server.js';
import { createSocketHandler } from './socket-handler.js';
import { getAllSessionTypes, SESSION_HANDLERS } from '../../session-types/index.js';

const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const AUTH_REQUIRED = TERMINAL_KEY.length >= 8;

// Initialize services
const terminalManager = new TerminalManager();

/**
 * Create namespaced socket handlers with session type isolation
 * @param {Server} io - Socket.IO server instance
 */
export function createNamespacedSocketHandler(io) {
  console.log('🚀 Initializing namespaced socket handler...');
  
  // Setup main namespace handler (existing functionality)
  const mainHandler = createSocketHandler(io);
  io.on('connection', mainHandler);
  console.log('✓ Main namespace handler registered');
  
  console.log('🔧 Setting up session type namespaces...');
  
  // Create isolated namespaces for each registered session type
  const registeredTypes = getAllSessionTypes();
  
  if (registeredTypes.length === 0) {
    console.warn('⚠️  No session types registered - only main namespace will be available');
    return;
  }
  
  for (const sessionType of registeredTypes) {
    try {
      const namespace = io.of(sessionType.namespace);
      const namespaceHandler = createSessionTypeHandler(sessionType, namespace);
      namespace.on('connection', namespaceHandler);
      
      console.log(`✓ Created namespace ${sessionType.namespace} for ${sessionType.name} (${sessionType.id})`);
    } catch (error) {
      console.error(`❌ Failed to create namespace for ${sessionType.id}:`, error);
      handleNamespaceError(null, sessionType, error, { 
        operation: 'namespace_creation',
        sessionTypeId: sessionType.id 
      });
    }
  }
  
  console.log(`🎯 Session type namespaces initialized: ${registeredTypes.length} types`);
}

/**
 * Create handler for a specific session type namespace
 * @param {BaseSessionType} sessionType - The session type
 * @param {Namespace} namespace - Socket.IO namespace
 * @returns {Function} Connection handler function
 */
export function createSessionTypeHandler(sessionType, namespace) {
  return (socket) => {
    console.log(`🔌 Socket connected to ${sessionType.namespace}: ${socket.id} (${sessionType.name})`);
    
    // Track connection metrics
    const connectionTime = new Date().toISOString();
    socket.sessionTypeId = sessionType.id;
    socket.connectedAt = connectionTime;
    
    // Authentication state for this namespace
    let isAuthenticated = !AUTH_REQUIRED;
    
    /**
     * Authentication handler
     */
    socket.on('auth', (key, callback) => {
      try {
        if (!AUTH_REQUIRED) {
          isAuthenticated = true;
          callback({ success: true, message: 'Authentication not required' });
          return;
        }
        
        if (key === TERMINAL_KEY) {
          isAuthenticated = true;
          socket.authenticated = true;
          console.log(`🔐 Socket authenticated in ${sessionType.namespace}: ${socket.id}`);
          callback({ success: true, message: 'Authentication successful' });
        } else {
          callback({ success: false, error: 'Invalid terminal key' });
        }
      } catch (error) {
        console.error(`Authentication error in ${sessionType.namespace}:`, error);
        callback({ success: false, error: 'Authentication failed' });
      }
    });
    
    /**
     * Load and register session type-specific handlers
     */
    try {
      const createHandlers = SESSION_HANDLERS[sessionType.id];
      
      if (!createHandlers) {
        console.error(`No handler factory found for session type: ${sessionType.id}`);
        socket.emit('error', {
          message: `Session type ${sessionType.id} not properly configured`,
          code: 'HANDLER_NOT_FOUND'
        });
        socket.disconnect();
        return;
      }
      
      // Create handlers for this session type
      const handlers = createHandlers(sessionType, namespace, socket);
      
      // Register all handlers with authentication check
      for (const [eventName, handler] of Object.entries(handlers)) {
        socket.on(eventName, (...args) => {
          // Check authentication for protected operations
          if (AUTH_REQUIRED && !isAuthenticated) {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
              });
            } else {
              socket.emit('error', {
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
              });
            }
            return;
          }
          
          // Execute handler with error boundary
          try {
            handler(...args);
          } catch (error) {
            console.error(`❌ Handler error for ${eventName} in ${sessionType.namespace}:`, error);
            
            // Enhanced error handling with context
            handleNamespaceError(namespace, sessionType, error, {
              operation: 'event_handler',
              event: eventName,
              socketId: socket.id,
              args: args.length
            });
            
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: error.message,
                code: 'HANDLER_ERROR',
                recoverable: isRecoverableError(error)
              });
            } else {
              socket.emit('error', {
                message: error.message,
                code: 'HANDLER_ERROR',
                event: eventName,
                recoverable: isRecoverableError(error)
              });
            }
          }
        });
      }
      
      console.log(`📡 Registered ${Object.keys(handlers).length} handlers for ${sessionType.namespace}`);
      
    } catch (error) {
      console.error(`❌ Failed to setup handlers for ${sessionType.id}:`, error);
      
      // Enhanced error handling
      handleNamespaceError(namespace, sessionType, error, {
        operation: 'handler_setup',
        socketId: socket.id,
        sessionTypeId: sessionType.id
      });
      
      socket.emit('error', {
        message: 'Failed to initialize session type handlers',
        code: 'HANDLER_SETUP_ERROR',
        recoverable: isRecoverableError(error)
      });
      socket.disconnect();
      return;
    }
    
    /**
     * Common namespace events
     */
    
    // Get session type information
    socket.on('get-session-type-info', (callback) => {
      try {
        const typeInfo = {
          id: sessionType.id,
          name: sessionType.name,
          description: sessionType.description,
          category: sessionType.category,
          namespace: sessionType.namespace,
          capabilities: [
            ...(sessionType.supportsCapability ? 
              ['create', 'destroy', ...(sessionType.supportsAttachment ? ['attach'] : [])] :
              ['create', 'destroy']
            )
          ]
        };
        
        callback({ success: true, sessionType: typeInfo });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });
    
    // Ping/pong for connection health
    socket.on('ping', (callback) => {
      if (callback) callback({ 
        success: true, 
        timestamp: new Date().toISOString(),
        sessionType: sessionType.id
      });
    });
    
    /**
     * Connection cleanup and logging
     */
    socket.on('disconnect', (reason) => {
      const disconnectionTime = new Date().toISOString();
      const connectionDuration = new Date(disconnectionTime) - new Date(connectionTime);
      
      console.log(`🔌 Socket disconnected from ${sessionType.namespace}: ${socket.id}`);
      console.log(`  📍 Session Type: ${sessionType.name} (${sessionType.id})`);
      console.log(`  📤 Reason: ${reason}`);
      console.log(`  ⏱️  Duration: ${Math.round(connectionDuration / 1000)}s`);
      
      // Emit disconnection event to namespace for any cleanup
      namespace.emit('socket-disconnected', {
        socketId: socket.id,
        sessionType: sessionType.id,
        reason,
        connectionDuration,
        sessionId: socket.sessionId
      });
      
      // Session type specific cleanup
      if (socket.sessionId) {
        sessionType.onDestroy(socket.sessionId).catch(err => {
          console.error(`Cleanup error for ${sessionType.id} session ${socket.sessionId}:`, err);
        });
      }
    });
    
    // Connection established - send ready event
    socket.emit('namespace-ready', {
      sessionType: sessionType.id,
      namespace: sessionType.namespace,
      authRequired: AUTH_REQUIRED,
      serverTime: connectionTime
    });
  };
}

/**
 * Enhanced error handling for namespace operations
 */
export function handleNamespaceError(namespace, sessionType, error, context = {}) {
  const errorInfo = {
    sessionType: sessionType?.id || 'unknown',
    namespace: sessionType?.namespace || 'unknown',
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
    recoverable: isRecoverableError(error)
  };
  
  console.error(`❌ Namespace error in ${sessionType?.namespace || 'unknown'}:`, errorInfo);
  
  // Emit error to all clients in namespace (if namespace exists)
  if (namespace) {
    namespace.emit('namespace-error', {
      message: error.message,
      code: context.code || 'NAMESPACE_ERROR',
      sessionType: sessionType?.id,
      recoverable: errorInfo.recoverable,
      timestamp: errorInfo.timestamp
    });
  }
  
  // Log critical errors for monitoring
  if (!errorInfo.recoverable) {
    console.error(`🚨 CRITICAL: Non-recoverable namespace error in ${sessionType?.id}`, {
      error: error.message,
      operation: context.operation,
      stack: error.stack
    });
  }
}

/**
 * Check if error is recoverable
 */
function isRecoverableError(error) {
  const recoverablePatterns = [
    'ECONNRESET',
    'ENOTFOUND', 
    'ETIMEDOUT',
    'timeout',
    'network',
    'connection',
    'socket hang up',
    'ECONNREFUSED'
  ];
  
  // Check for temporary failures
  const temporaryFailurePatterns = [
    'Session not found',
    'Already attached',
    'No active session',
    'Authentication required'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  
  const isNetworkRecoverable = recoverablePatterns.some(pattern => 
    errorMessage.includes(pattern.toLowerCase())
  );
  
  const isBusinessRecoverable = temporaryFailurePatterns.some(pattern =>
    errorMessage.includes(pattern.toLowerCase())
  );
  
  return isNetworkRecoverable || isBusinessRecoverable;
}

/**
 * Get namespace connection statistics
 */
export function getNamespaceStats(io) {
  const stats = {
    totalNamespaces: 0,
    totalConnections: 0,
    sessionTypes: [],
    mainNamespaceConnections: io.engine.clientsCount || 0
  };
  
  for (const sessionType of getAllSessionTypes()) {
    const namespace = io.of(sessionType.namespace);
    const connections = namespace.sockets.size;
    
    stats.totalNamespaces++;
    stats.totalConnections += connections;
    stats.sessionTypes.push({
      id: sessionType.id,
      name: sessionType.name,
      namespace: sessionType.namespace,
      connections
    });
  }
  
  return stats;
}

/**
 * Validate session type registration for namespace creation
 */
export function validateSessionTypeRegistration() {
  const errors = [];
  const types = getAllSessionTypes();
  
  // Check for duplicate namespaces
  const namespaces = new Set();
  for (const type of types) {
    if (namespaces.has(type.namespace)) {
      errors.push(`Duplicate namespace: ${type.namespace}`);
    }
    namespaces.add(type.namespace);
  }
  
  // Check that all types have handlers
  for (const type of types) {
    if (!SESSION_HANDLERS[type.id]) {
      errors.push(`No handler registered for session type: ${type.id}`);
    }
  }
  
  // Check for reserved namespaces
  const reserved = ['/', '/admin', '/api', '/health'];
  for (const type of types) {
    if (reserved.includes(type.namespace)) {
      errors.push(`Reserved namespace not allowed: ${type.namespace}`);
    }
  }
  
  if (errors.length > 0) {
    console.error('Session type registration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Session type validation failed: ${errors.join(', ')}`);
  }
  
  console.log('✓ Session type registration validation passed');
  return true;
}

