/**
 * Authentication Decorators
 *
 * Provides decorators and utilities for consistent authentication checking
 * across socket operations and handlers
 */

import { createErrorResponse } from '../../utils/error-handling.js';

/**
 * Create authentication decorator for socket methods
 * @param {AuthMiddleware} authMiddleware Authentication middleware instance
 * @returns {Function} Decorator function
 */
export function requireAuth(authMiddleware) {
	return function authDecorator(target, propertyName, descriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = function decoratedMethod(socketId, data, callback) {
			// Check authentication
			const authError = authMiddleware.requireAuth(socketId, propertyName);
			if (authError) {
				if (typeof callback === 'function') {
					callback(authError);
					return;
				}
				// If no callback, emit error to socket
				if (this.io && this.io.to) {
					this.io.to(socketId).emit('error', authError);
				}
				return;
			}

			// Call original method if authenticated
			return originalMethod.call(this, socketId, data, callback);
		};

		return descriptor;
	};
}

/**
 * Create authentication wrapper for socket event handlers
 * @param {AuthMiddleware} authMiddleware Authentication middleware instance
 * @param {string} operation Operation name for logging
 * @returns {Function} Wrapper function
 */
export function withAuth(authMiddleware, operation = 'unknown') {
	return function (handler) {
		return function authenticatedHandler(socket, data, callback) {
			const socketId = socket.id;

			// Check authentication
			const authError = authMiddleware.requireAuth(socketId, operation);
			if (authError) {
				if (typeof callback === 'function') {
					callback(authError);
				} else {
					socket.emit('error', authError);
				}
				return;
			}

			// Call original handler if authenticated
			return handler.call(this, socket, data, callback);
		};
	};
}

/**
 * Authentication middleware factory for socket handlers
 * @param {AuthMiddleware} authMiddleware Authentication middleware instance
 * @returns {Object} Middleware functions
 */
export function createAuthMiddleware(authMiddleware) {
	return {
		/**
		 * Middleware function for socket operations requiring authentication
		 * @param {string} operation Operation name
		 * @returns {Function} Middleware function
		 */
		requireAuth: (operation) => authMiddleware.createMiddleware(operation),

		/**
		 * Initialize authentication for new socket connections
		 * @param {Object} socket Socket.IO socket instance
		 */
		initializeSocket: (socket) => {
			authMiddleware.initializeSocket(socket.id);

			// Set up cleanup on disconnect
			socket.on('disconnect', () => {
				authMiddleware.cleanup(socket.id);
			});
		},

		/**
		 * Handle authentication attempts
		 * @param {Object} socket Socket.IO socket instance
		 * @param {string} key Authentication key
		 * @param {Function} callback Response callback
		 */
		handleAuth: (socket, key, callback) => {
			const result = authMiddleware.authenticate(socket.id, key);

			if (typeof callback === 'function') {
				callback(result);
			} else {
				socket.emit('auth-result', result);
			}
		},

		/**
		 * Get authentication status for socket
		 * @param {Object} socket Socket.IO socket instance
		 * @param {Function} callback Response callback
		 */
		getAuthStatus: (socket, callback) => {
			const status = authMiddleware.getAuthStatus(socket.id);

			if (typeof callback === 'function') {
				callback(status);
			} else {
				socket.emit('auth-status', status);
			}
		}
	};
}

/**
 * Class decorator for automatically protecting all methods
 * @param {AuthMiddleware} authMiddleware Authentication middleware instance
 * @param {Array<string>} excludeMethods Methods to exclude from auth checking
 */
export function protectClass(authMiddleware, excludeMethods = []) {
	return function classDecorator(target) {
		const prototype = target.prototype;
		const methodNames = Object.getOwnPropertyNames(prototype).filter(
			(name) =>
				name !== 'constructor' &&
				typeof prototype[name] === 'function' &&
				!excludeMethods.includes(name)
		);

		methodNames.forEach((methodName) => {
			const originalMethod = prototype[methodName];

			prototype[methodName] = function protectedMethod(socketId, data, callback) {
				// Check authentication
				const authError = authMiddleware.requireAuth(socketId, methodName);
				if (authError) {
					if (typeof callback === 'function') {
						callback(authError);
						return;
					}
					// If no callback, emit error to socket
					if (this.io && this.io.to) {
						this.io.to(socketId).emit('error', authError);
					}
					return;
				}

				// Call original method if authenticated
				return originalMethod.call(this, socketId, data, callback);
			};
		});

		return target;
	};
}

/**
 * Helper function to create authenticated socket handler
 * @param {AuthMiddleware} authMiddleware Authentication middleware instance
 * @param {Object} handlers Object containing handler methods
 * @param {Array<string>} publicMethods Methods that don't require authentication
 * @returns {Object} Enhanced handlers with authentication
 */
export function createAuthenticatedHandlers(
	authMiddleware,
	handlers,
	publicMethods = ['list', 'listProjects']
) {
	const enhancedHandlers = {};

	Object.keys(handlers).forEach((methodName) => {
		const originalHandler = handlers[methodName];

		if (publicMethods.includes(methodName)) {
			// Public methods don't require authentication
			enhancedHandlers[methodName] = originalHandler;
		} else {
			// Protected methods require authentication
			enhancedHandlers[methodName] = function authenticatedHandler(socketId, data, callback) {
				const authError = authMiddleware.requireAuth(socketId, methodName);
				if (authError) {
					if (typeof callback === 'function') {
						callback(authError);
						return;
					}
					return;
				}

				return originalHandler.call(this, socketId, data, callback);
			};
		}
	});

	return enhancedHandlers;
}

/**
 * Utility to wrap existing socket handlers with authentication
 * @param {AuthMiddleware} authMiddleware Authentication middleware instance
 * @param {Object} socketHandler Existing socket handler object
 * @param {Object} config Configuration options
 * @returns {Object} Wrapped handler with authentication
 */
export function wrapSocketHandler(authMiddleware, socketHandler, config = {}) {
	const {
		publicMethods = ['list', 'listProjects'],
		initMethod = 'handleConnection',
		cleanupMethod = 'handleDisconnection'
	} = config;

	const wrappedHandler = Object.create(socketHandler);

	// Wrap all methods with authentication checking
	Object.getOwnPropertyNames(Object.getPrototypeOf(socketHandler))
		.filter((name) => typeof socketHandler[name] === 'function')
		.forEach((methodName) => {
			const originalMethod = socketHandler[methodName];

			if (methodName === initMethod) {
				// Special handling for connection initialization
				wrappedHandler[methodName] = function (socket, ...args) {
					authMiddleware.initializeSocket(socket.id);
					return originalMethod.call(socketHandler, socket, ...args);
				};
			} else if (methodName === cleanupMethod) {
				// Special handling for disconnection cleanup
				wrappedHandler[methodName] = function (socketId, ...args) {
					authMiddleware.cleanup(socketId);
					return originalMethod.call(socketHandler, socketId, ...args);
				};
			} else if (publicMethods.includes(methodName)) {
				// Public methods don't require authentication
				wrappedHandler[methodName] = originalMethod.bind(socketHandler);
			} else {
				// Protected methods require authentication
				wrappedHandler[methodName] = function (socketId, data, callback) {
					const authError = authMiddleware.requireAuth(socketId, methodName);
					if (authError) {
						if (typeof callback === 'function') {
							callback(authError);
							return;
						}
						return;
					}

					return originalMethod.call(socketHandler, socketId, data, callback);
				};
			}
		});

	return wrappedHandler;
}

export default {
	requireAuth,
	withAuth,
	createAuthMiddleware,
	protectClass,
	createAuthenticatedHandlers,
	wrapSocketHandler
};
