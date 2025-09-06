/**
 * Authentication Socket Handler
 *
 * Handles authentication-related socket events in isolation.
 * Provides clean separation of authentication concerns from other handlers.
 */

const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const AUTH_REQUIRED = TERMINAL_KEY.length >= 8;

/**
 * Create authentication socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Set} authenticatedSockets - Shared authenticated sockets set
 * @returns {Object} Auth handler functions
 */
export function createAuthSocketHandlers(io, socket, authenticatedSockets) {
	// Authentication handler
	const authHandler = (key, callback) => {
		const success = !AUTH_REQUIRED || key === TERMINAL_KEY;

		if (success) {
			authenticatedSockets.add(socket.id);
			console.log(`[AUTH] Socket ${socket.id} authenticated`);
		} else {
			console.log(`[AUTH] Socket ${socket.id} authentication failed`);
		}

		if (callback && typeof callback === 'function') {
			callback({ success, ok: success });
		}
	};

	// Authentication check utility
	const requireAuth = () => {
		return !AUTH_REQUIRED || authenticatedSockets.has(socket.id);
	};

	// Cleanup on disconnect
	const disconnectHandler = () => {
		authenticatedSockets.delete(socket.id);
		console.log(`[AUTH] Socket ${socket.id} removed from authenticated set`);
	};

	return {
		// Handler functions
		auth: authHandler,
		disconnect: disconnectHandler,

		// Utility functions
		requireAuth,
		isAuthenticated: () => authenticatedSockets.has(socket.id),

		// Auth configuration
		authRequired: AUTH_REQUIRED,
		terminalKey: TERMINAL_KEY
	};
}

/**
 * Authentication middleware for protecting socket handlers
 * @param {Function} handler - Handler function to protect
 * @param {Function} requireAuth - Auth check function
 * @returns {Function} Protected handler function
 */
export function withAuth(handler, requireAuth) {
	return (...args) => {
		if (!requireAuth()) {
			// Find callback in args (usually the last function argument)
			const callback = args.find((arg) => typeof arg === 'function');
			if (callback) {
				callback({ success: false, error: 'Authentication required' });
			}
			return;
		}

		return handler(...args);
	};
}

/**
 * Create auth decorator for multiple handlers
 * @param {Object} handlers - Object of handler functions
 * @param {Function} requireAuth - Auth check function
 * @returns {Object} Object of protected handler functions
 */
export function decorateHandlersWithAuth(handlers, requireAuth) {
	const decoratedHandlers = {};

	for (const [name, handler] of Object.entries(handlers)) {
		if (typeof handler === 'function') {
			decoratedHandlers[name] = withAuth(handler, requireAuth);
		} else {
			decoratedHandlers[name] = handler;
		}
	}

	return decoratedHandlers;
}

/**
 * Get authentication status for a socket
 * @param {string} socketId - Socket ID to check
 * @param {Set} authenticatedSockets - Authenticated sockets set
 * @returns {boolean} True if socket is authenticated
 */
export function isSocketAuthenticated(socketId, authenticatedSockets) {
	return !AUTH_REQUIRED || authenticatedSockets.has(socketId);
}

/**
 * Authentication configuration
 */
export const AUTH_CONFIG = {
	required: AUTH_REQUIRED,
	key: TERMINAL_KEY,
	keyLength: TERMINAL_KEY.length
};
