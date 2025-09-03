/**
 * AuthHandler - Manages authentication-related socket events
 * 
 * Delegates authentication logic to the centralized AuthMiddleware
 * while maintaining the socket handler interface for backward compatibility
 */

import { createSuccessResponse, createErrorResponse, ErrorHandler } from '../../utils/error-handling.js';
import { AuthMiddleware } from '../middleware/auth-middleware.js';
import { createAuthMiddleware } from '../middleware/auth-decorators.js';
import { AuthConfig } from '../config/auth-config.js';

/**
 * Authentication handler for socket events
 */
export class AuthHandler {
  /**
   * @param {Object} dependencies Injected dependencies
   * @param {AuthMiddleware} dependencies.authMiddleware Authentication middleware instance
   * @param {AuthConfig} dependencies.authConfig Authentication configuration
   */
  constructor({ authMiddleware, authConfig }) {
    this.authConfig = authConfig || AuthConfig.fromEnvironment();
    this.authMiddleware = authMiddleware || new AuthMiddleware(this.authConfig.getAll());
    this.authHelper = createAuthMiddleware(this.authMiddleware);
    
    // Backward compatibility properties
    this.terminalKey = this.authConfig.getAuthKey();
    this.authRequired = this.authConfig.isAuthRequired();
  }

  /**
   * Handle authentication requests
   * Delegates to centralized AuthMiddleware for consistent behavior
   * @param {Socket} socket Socket.IO socket
   * @param {string} key Authentication key
   * @param {Function} callback Response callback
   */
  async auth(socket, key, callback) {
    this.authHelper.handleAuth(socket, key, callback);
  }

  /**
   * Middleware to check authentication for protected routes
   * Delegates to centralized AuthMiddleware
   * @param {Socket} socket Socket.IO socket
   * @param {string} event Event name
   * @param {any} data Event data
   * @param {Function} next Continue to next middleware/handler
   */
  requireAuth(socket, event, data, next) {
    const authMiddleware = this.authMiddleware.createMiddleware(event);
    authMiddleware(socket.id, data, next);
  }

  /**
   * Create middleware function for authentication checking
   * @returns {Function} Middleware function using centralized auth
   */
  createAuthMiddleware() {
    return (socket, event, data, next) => {
      // Skip auth check for public events
      const publicEvents = ['auth', 'list'];
      if (publicEvents.includes(event)) {
        return next();
      }

      // Use centralized authentication check
      const authError = this.authMiddleware.requireAuth(socket.id, event);
      if (authError) {
        return next(new Error(authError.error || 'Not authenticated'));
      }

      next();
    };
  }

  /**
   * Validate authentication key format
   * Delegates to centralized configuration
   * @param {string} key Authentication key
   * @returns {boolean} True if key format is valid
   */
  validateKeyFormat(key) {
    return this.authConfig.isValidKey(key);
  }

  /**
   * Get authentication configuration
   * @returns {Object} Auth config
   */
  getConfig() {
    return this.authConfig.getSummary();
  }

  /**
   * Get authentication status for socket
   * @param {string} socketId Socket ID
   * @returns {Object} Authentication status
   */
  getAuthStatus(socketId) {
    return this.authMiddleware.getAuthStatus(socketId);
  }

  /**
   * Initialize authentication for socket
   * @param {string} socketId Socket ID
   */
  initializeSocket(socketId) {
    this.authMiddleware.initializeSocket(socketId);
  }

  /**
   * Cleanup authentication for socket
   * @param {string} socketId Socket ID
   */
  cleanup(socketId) {
    this.authMiddleware.cleanup(socketId);
  }

  /**
   * Get authentication statistics
   * @returns {Object} Authentication statistics
   */
  getStatistics() {
    return this.authMiddleware.getStatistics();
  }

  /**
   * Create AuthHandler instance with environment configuration
   * @returns {AuthHandler} Configured AuthHandler
   */
  static create() {
    const authConfig = AuthConfig.fromEnvironment();
    const authMiddleware = new AuthMiddleware(authConfig.getAll());
    
    return new AuthHandler({
      authConfig,
      authMiddleware
    });
  }
}