/**
 * Standardized error handling utilities for Dispatch
 * Provides consistent error response formats and handling patterns
 */

import { ERROR_CODES } from '../config/constants.js';

/**
 * Creates a standardized error response object
 * @param {string} message - Human-readable error message
 * @param {string} code - Error code from ERROR_CODES
 * @param {*} details - Additional error details (optional)
 * @returns {object} Standardized error response
 */
export const createErrorResponse = (message, code = ERROR_CODES.UNKNOWN_ERROR, details = null) => {
  const response = {
    success: false,
    error: message,
    code
  };
  
  if (details !== null) {
    response.details = details;
  }
  
  return response;
};

/**
 * Creates a standardized success response object
 * @param {object} data - Response data
 * @returns {object} Standardized success response
 */
export const createSuccessResponse = (data = {}) => ({
  success: true,
  ...data
});

/**
 * Error handler class for consistent error logging and user feedback
 */
export class ErrorHandler {
  /**
   * Handle an error with consistent logging and optional user notification
   * @param {Error|string} error - The error to handle
   * @param {string} context - Context where error occurred
   * @param {boolean} showUser - Whether to show error to user
   * @param {object} metadata - Additional metadata for logging
   */
  static handle(error, context = 'unknown', showUser = true, metadata = {}) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Always log to console with context
    const logData = {
      context,
      message: errorMessage,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    if (errorStack) {
      logData.stack = errorStack;
    }
    
    console.error(`[ERROR:${context}]`, logData);
    
    if (showUser) {
      // For now, console warn for user-visible errors
      // This can be replaced with a proper notification system later
      console.warn(`User notification: ${errorMessage}`);
      
      // Could integrate with a toast/notification system here:
      // notificationService?.error?.(errorMessage);
    }
    
    return createErrorResponse(errorMessage, this.getErrorCode(error, context));
  }
  
  /**
   * Get appropriate error code based on error type and context
   * @param {Error|string} error - The error
   * @param {string} context - Error context
   * @returns {string} Appropriate error code
   */
  static getErrorCode(error, context) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();
    
    // Authentication errors
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized')) {
      return ERROR_CODES.AUTH_FAILED;
    }
    
    // Session errors
    if (context.includes('session') || lowerMessage.includes('session')) {
      if (lowerMessage.includes('not found')) return ERROR_CODES.SESSION_NOT_FOUND;
      if (lowerMessage.includes('ended')) return ERROR_CODES.SESSION_ENDED;
      return ERROR_CODES.SESSION_NOT_FOUND;
    }
    
    // Terminal errors
    if (context.includes('terminal') || lowerMessage.includes('terminal')) {
      if (lowerMessage.includes('create')) return ERROR_CODES.TERMINAL_CREATE_FAILED;
      if (lowerMessage.includes('attach')) return ERROR_CODES.TERMINAL_ATTACH_FAILED;
      if (lowerMessage.includes('input')) return ERROR_CODES.TERMINAL_INPUT_INVALID;
    }
    
    // Validation errors
    if (context.includes('validation') || lowerMessage.includes('invalid')) {
      return ERROR_CODES.VALIDATION_FAILED;
    }
    
    // Storage errors
    if (lowerMessage.includes('storage') || lowerMessage.includes('quota')) {
      return ERROR_CODES.STORAGE_FULL;
    }
    
    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return ERROR_CODES.NETWORK_ERROR;
    }
    
    return ERROR_CODES.UNKNOWN_ERROR;
  }
  
  /**
   * Handle async operations with automatic error handling
   * @param {Function} asyncFn - Async function to execute
   * @param {string} context - Context for error handling
   * @param {boolean} showUser - Show errors to user
   * @returns {Promise} Promise that resolves to success/error response
   */
  static async handleAsync(asyncFn, context, showUser = true) {
    try {
      const result = await asyncFn();
      return createSuccessResponse(typeof result === 'object' ? result : { result });
    } catch (error) {
      return this.handle(error, context, showUser);
    }
  }
}

/**
 * Wrapper for localStorage operations with error handling
 */
export class SafeStorage {
  /**
   * Safely get item from localStorage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found or error
   * @returns {*} Stored value or default
   */
  static getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      ErrorHandler.handle(error, 'SafeStorage.getItem', false, { key });
      return defaultValue;
    }
  }
  
  /**
   * Safely set item in localStorage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  static setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      ErrorHandler.handle(error, 'SafeStorage.setItem', true, { key });
      return false;
    }
  }
  
  /**
   * Safely remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  static removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      ErrorHandler.handle(error, 'SafeStorage.removeItem', false, { key });
      return false;
    }
  }
  
  /**
   * Check available storage space
   * @returns {object} Storage info
   */
  static getStorageInfo() {
    try {
      const test = 'storage-test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      
      // Estimate used space
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      return {
        available: true,
        estimatedUsed: used,
        isNearLimit: used > 8 * 1024 * 1024 // 8MB warning threshold
      };
    } catch (error) {
      return {
        available: false,
        estimatedUsed: 0,
        isNearLimit: false,
        error: error.message
      };
    }
  }
}

/**
 * Legacy compatibility - maintain existing response format during migration
 * @deprecated Use createErrorResponse instead
 */
export const createLegacyErrorResponse = (message) => ({
  ok: false,
  error: message
});

/**
 * Legacy compatibility - maintain existing response format during migration
 * @deprecated Use createSuccessResponse instead
 */
export const createLegacySuccessResponse = (data = {}) => ({
  ok: true,
  ...data
});