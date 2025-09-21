/**
 * Standardized error handling utilities for server-side operations
 *
 * Provides consistent error handling patterns while reducing code duplication
 * following SOLID principles with configurable behavior.
 */

import { logger } from './logger.js';
import { hasMethod } from './method-utils.js';

/**
 * Create a standardized error handler for async operations
 * @param {string} component - Component name for logging
 * @param {object} [options={}] - Configuration options
 * @param {*} [options.fallback=null] - Default return value on error
 * @param {boolean} [options.throwOnError=false] - Whether to re-throw errors
 * @param {function} [options.callback=null] - Optional callback to call on error
 * @returns {function} Error handler function
 */
export function createErrorHandler(component, options = {}) {
	const { fallback = null, throwOnError = false, callback = null } = options;

	return (operation, context = '') =>
		async (...args) => {
			try {
				return await operation(...args);
			} catch (error) {
				const message = context ? `${context}: ${error.message || error}` : error.message || error;
				logger.error(component, message);

				if (callback) {
					try {
						callback({ success: false, error: error.message || 'Operation failed' });
					} catch (callbackError) {
						logger.warn(component, 'Callback execution failed:', callbackError);
					}
				}

				if (throwOnError) {
					throw error;
				}

				return fallback;
			}
		};
}

/**
 * Specialized error handler for database operations
 * @param {string} component - Component name for logging
 * @param {*} fallback - Default return value on error (default: null)
 * @returns {function} Database error handler
 */
export function createDbErrorHandler(component, fallback = null) {
	return createErrorHandler(component, { fallback, throwOnError: false, callback: null });
}

/**
 * Specialized error handler for socket operations with callback support
 * @param {string} component - Component name for logging
 * @returns {function} Socket error handler
 */
export function createSocketErrorHandler(component) {
	return (operation, context = '') =>
		async (data, callback) => {
			try {
				return await operation(data, callback);
			} catch (error) {
				const message = context ? `${context}: ${error.message || error}` : error.message || error;
				logger.error(component, message);

				if (callback) {
					try {
						callback({ success: false, error: error.message || 'Operation failed' });
					} catch (callbackError) {
						logger.warn(component, 'Callback execution failed:', callbackError);
					}
				}
			}
		};
}

/**
 * Safe wrapper for operations that should never throw
 * @param {function} operation - Async operation to execute
 * @param {string} component - Component name for logging
 * @param {string} context - Context description
 * @returns {Promise<void>}
 */
export async function safeExecute(operation, component, context) {
	try {
		await operation();
	} catch (error) {
		logger.warn(component, `${context}: ${error.message || error}`);
	}
}

/**
 * Create a service operation handler with consistent error patterns
 * @param {string} component - Component name for logging
 * @param {object} options - Configuration options
 * @returns {function} Service operation handler
 */
export function createServiceHandler(component, options = {}) {
	const { throwOnError = true } = options;

	return (operation, context = '') =>
		async (...args) => {
			try {
				return await operation(...args);
			} catch (error) {
				const message = context ? `${context}: ${error.message || error}` : error.message || error;
				logger.error(component, message);

				if (throwOnError) {
					throw error;
				}

				return null;
			}
		};
}

/**
 * Wrap a manager method with standardized error handling
 * @param {object} manager - Manager instance
 * @param {string} methodName - Method name to wrap
 * @param {string} component - Component name for logging
 * @param {object} options - Error handling options
 */
export function wrapManagerMethod(manager, methodName, component, options = {}) {
	if (!hasMethod(manager, methodName)) {
		throw new Error(`Method ${methodName} not found on manager`);
	}

	const originalMethod = manager[methodName];
	const errorHandler = createErrorHandler(component, options);
	manager[methodName] = errorHandler(originalMethod.bind(manager), methodName);
}
