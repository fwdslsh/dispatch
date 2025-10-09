/**
 * Error Handling Middleware Factory
 * @file Creates Socket.IO error handling middleware
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * Create error handling middleware
 * @returns {Function} Socket.IO middleware function
 */
export function createErrorHandlingMiddleware() {
	return ([event, ...args], next) => {
		try {
			// Pass through to next middleware
			next();
		} catch (err) {
			logger.error('SOCKET', `Error handling event ${event}:`, err);

			// Send error response via callback if available
			const callback = args[args.length - 1];
			if (typeof callback === 'function') {
				callback({
					success: false,
					error: err.message
				});
			}

			// Don't propagate error to prevent socket disconnect
		}
	};
}
