/**
 * SocketRouter - Coordinates socket event handling across specialized handlers
 * 
 * This router replaces the monolithic socket-handler.js by delegating events
 * to focused, single-responsibility handlers while maintaining backward compatibility.
 * 
 * Now uses dependency injection for loose coupling and testability.
 */

import { createErrorResponse, ErrorHandler } from '../utils/error-handling.js';
import { AuthMiddleware } from './middleware/auth-middleware.js';
import { createAuthMiddleware } from './middleware/auth-decorators.js';
import { AuthConfig } from './config/auth-config.js';

/**
 * Router that delegates socket events to appropriate handlers
 */
export class SocketRouter {
  /**
   * @param {Object} dependencies Injected dependencies
   * @param {IAuthService} dependencies.authService Authentication service
   * @param {ILoggingService} dependencies.loggingService Logging service
   * @param {IErrorService} dependencies.errorService Error handling service
   * @param {IConfigService} dependencies.configService Configuration service
   */
  constructor(dependencies = {}) {
    // Inject dependencies (with fallbacks for backward compatibility)
    this.authService = dependencies.authService;
    this.loggingService = dependencies.loggingService || console;
    this.errorService = dependencies.errorService;
    this.configService = dependencies.configService;
    
    // Fallback to legacy initialization if no services injected
    if (!this.authService) {
      this.authConfig = dependencies.authConfig || AuthConfig.fromEnvironment();
      this.authMiddleware = dependencies.authMiddleware || new AuthMiddleware(this.authConfig.getAll());
      this.authHelper = createAuthMiddleware(this.authMiddleware);
    }
    
    this.handlers = new Map();
    this.middleware = [];
    
    // Backward compatibility properties
    if (this.authService) {
      this.authRequired = this.authService.isAuthRequired();
      this.terminalKey = this.configService?.get('terminalKey') || 'change-me';
    } else {
      this.authRequired = this.authConfig?.isAuthRequired();
      this.terminalKey = this.authConfig?.getAuthKey();
    }
  }

  /**
   * Register a handler for specific events
   * @param {string} name Handler name for debugging
   * @param {Object} handler Handler instance with event methods
   * @param {string[]} events Array of event names this handler manages
   */
  registerHandler(name, handler, events) {
    for (const event of events) {
      if (this.handlers.has(event)) {
        throw new Error(`Event '${event}' is already registered to another handler`);
      }
      this.handlers.set(event, { name, handler, method: event });
    }
  }

  /**
   * Add middleware function that runs before event handlers
   * @param {Function} middlewareFn Function that takes (socket, event, data, next)
   */
  addMiddleware(middlewareFn) {
    this.middleware.push(middlewareFn);
  }

  /**
   * Handle socket connection and set up event routing
   * @param {Socket} socket Socket.IO socket instance
   */
  handleConnection(socket) {
    this.loggingService.info('Socket connected:', socket.id);
    
    // Initialize authentication using injected service or fallback
    if (this.authService) {
      this.authService.initializeSocket(socket.id);
    } else {
      this.authHelper.initializeSocket(socket);
    }
    
    // Set up event routing
    this.setupEventRouting(socket);
  }

  /**
   * Set up event listeners that delegate to registered handlers
   * @private
   * @param {Socket} socket Socket.IO socket instance
   */
  setupEventRouting(socket) {
    // Handle authentication using injected service or fallback
    socket.on('auth', (key, callback) => {
      if (this.authService) {
        const result = this.authService.authenticate(socket.id, key);
        if (callback) callback(result);
      } else {
        this.authHelper.handleAuth(socket, key, callback);
      }
    });

    // Set up routing for all registered events
    for (const [event, { name, handler, method }] of this.handlers) {
      socket.on(event, async (...args) => {
        try {
          // Extract callback if present (usually the last argument)
          const callback = args.length > 0 && typeof args[args.length - 1] === 'function' 
            ? args.pop() 
            : null;
          
          // Get data (everything except callback)
          const data = args.length === 1 ? args[0] : args;
          
          // Run middleware chain
          await this.runMiddleware(socket, event, data);
          
          // Check authentication for protected events using injected service or fallback
          if (this.requiresAuth(event)) {
            let authError;
            if (this.authService) {
              authError = this.authService.requireAuth(socket.id, event);
            } else {
              authError = this.authMiddleware.requireAuth(socket.id, event);
            }
            
            if (authError) {
              if (callback) callback(authError);
              return;
            }
          }
          
          // Call handler method
          if (typeof handler[method] === 'function') {
            await handler[method](socket, data, callback);
          } else {
            this.loggingService.warn(`Handler ${name} does not have method ${method}`);
            const errorResponse = this.errorService 
              ? this.errorService.createErrorResponse(`Handler method not found: ${method}`)
              : createErrorResponse(`Handler method not found: ${method}`);
            if (callback) callback(errorResponse);
          }
          
        } catch (error) {
          this.loggingService.error(`Error in ${event} handler:`, error);
          
          let errorResponse;
          if (this.errorService) {
            errorResponse = this.errorService.handle(error.message, `socket.${event}`, false);
          } else {
            errorResponse = ErrorHandler.handle(error.message, `socket.${event}`, false);
          }
          
          // Find callback in args
          const callback = args.find(arg => typeof arg === 'function');
          if (callback) {
            const clientError = this.errorService 
              ? this.errorService.createErrorResponse(errorResponse.error)
              : createErrorResponse(errorResponse.error);
            callback(clientError);
          }
        }
      });
    }
  }


  /**
   * Run middleware chain
   * @private
   * @param {Socket} socket Socket.IO socket instance
   * @param {string} event Event name
   * @param {any} data Event data
   */
  async runMiddleware(socket, event, data) {
    for (const middleware of this.middleware) {
      await new Promise((resolve, reject) => {
        middleware(socket, event, data, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }

  /**
   * Check if event requires authentication
   * @private
   * @param {string} event Event name
   * @returns {boolean} True if event requires authentication
   */
  requiresAuth(event) {
    // Events that don't require authentication
    const publicEvents = ['list']; // list can work without auth in some cases
    return !publicEvents.includes(event);
  }

  /**
   * Check if socket is authenticated
   * @param {string} socketId Socket ID
   * @returns {boolean} True if authenticated
   */
  isAuthenticated(socketId) {
    if (this.authService) {
      return this.authService.isAuthenticated(socketId);
    }
    return this.authMiddleware.isAuthenticated(socketId);
  }

  /**
   * Get authentication status for a socket
   * @param {string} socketId Socket ID
   * @returns {Object} Authentication status
   */
  getAuthStatus(socketId) {
    if (this.authService) {
      return this.authService.getAuthStatus(socketId);
    }
    return this.authMiddleware.getAuthStatus(socketId);
  }

  /**
   * Get handler info for debugging
   * @returns {Array} Array of handler registrations
   */
  getHandlerInfo() {
    const info = [];
    for (const [event, { name, handler }] of this.handlers) {
      info.push({ event, handlerName: name, handlerClass: handler.constructor.name });
    }
    return info;
  }

  /**
   * Get authentication statistics
   * @returns {Object} Authentication statistics
   */
  getAuthStatistics() {
    if (this.authService) {
      return this.authService.getStatistics();
    }
    return this.authMiddleware.getStatistics();
  }

  /**
   * Create a configured router instance for the application (legacy factory)
   * @param {Object} config Configuration
   * @returns {SocketRouter} Configured router instance
   */
  static create(config = {}) {
    const authConfig = AuthConfig.fromEnvironment(config.authConfig);
    const authMiddleware = new AuthMiddleware(authConfig.getAll());
    
    return new SocketRouter({
      authConfig,
      authMiddleware,
      ...config
    });
  }

  /**
   * Create router with dependency injection
   * @param {Object} dependencies Injected service dependencies
   * @returns {SocketRouter} Router with injected dependencies
   */
  static createWithDependencies(dependencies) {
    return new SocketRouter(dependencies);
  }
}