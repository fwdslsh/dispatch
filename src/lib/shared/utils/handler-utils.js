/**
 * Handler Utilities
 *
 * Common utilities for creating and managing Socket.IO handlers.
 * Provides authentication, error handling, and event emission utilities.
 */

/**
 * Create authenticated handler wrapper
 * @param {Function} requireAuth - Auth check function
 * @param {Function} handler - Handler function to wrap
 * @param {string} errorMessage - Error message for auth failure
 * @returns {Function} Wrapped handler
 */
export function createAuthHandler(requireAuth, handler, errorMessage = 'Authentication required') {
	return async (...args) => {
		try {
			if (!requireAuth()) {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback({ success: false, error: errorMessage });
				}
				return;
			}

			return await handler(...args);
		} catch (error) {
			console.error('Handler error:', error);
			const callback = args[args.length - 1];
			if (typeof callback === 'function') {
				callback({ success: false, error: error.message });
			}
		}
	};
}

/**
 * Create callback handler with error handling
 * @param {Function} handler - Handler function
 * @param {string} operation - Operation name for logging
 * @returns {Function} Wrapped handler
 */
export function createCallbackHandler(handler, operation) {
	return async (...args) => {
		const callback = args[args.length - 1];

		try {
			const result = await handler(...args);

			if (typeof callback === 'function') {
				if (result && typeof result === 'object') {
					callback(result);
				} else {
					callback({ success: true, result });
				}
			}

			return result;
		} catch (error) {
			console.error(`${operation} error:`, error);
			if (typeof callback === 'function') {
				callback({ success: false, error: error.message });
			}
		}
	};
}

/**
 * Create input handler (no callback, just error handling)
 * @param {Function} requireAuth - Auth check function
 * @param {Function} handler - Handler function
 * @param {string} warningMessage - Warning message for auth failure
 * @returns {Function} Wrapped handler
 */
export function createInputHandler(
	requireAuth,
	handler,
	warningMessage = 'Unauthorized input attempt'
) {
	return (data) => {
		try {
			if (!requireAuth()) {
				console.warn(warningMessage);
				return;
			}

			return handler(data);
		} catch (error) {
			console.error('Input handler error:', error);
		}
	};
}

/**
 * Emit session event with error handling
 * @param {Object} io - Socket.IO instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function emitSessionEvent(io, event, data) {
	try {
		io.emit(event, data);
	} catch (error) {
		console.error(`Failed to emit ${event}:`, error);
	}
}

/**
 * Create standard success response
 * @param {Object} data - Response data
 * @returns {Object} Success response
 */
export function createSuccessResponse(data = {}) {
	return {
		success: true,
		...data
	};
}

/**
 * Create standard error response
 * @param {string} error - Error message
 * @param {string} code - Error code (optional)
 * @returns {Object} Error response
 */
export function createErrorResponse(error, code = null) {
	const response = {
		success: false,
		error
	};

	if (code) {
		response.code = code;
	}

	return response;
}

/**
 * Safe callback execution with error handling
 * @param {Function} callback - Callback function
 * @param {Object} response - Response data
 */
export function safeCallback(callback, response) {
	if (typeof callback === 'function') {
		try {
			callback(response);
		} catch (error) {
			console.error('Callback execution error:', error);
		}
	}
}
