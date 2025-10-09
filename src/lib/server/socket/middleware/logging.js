/**
 * Logging Middleware Factory
 * @file Creates Socket.IO logging middleware
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * Create logging middleware
 * @param {Object} [options={}] - Logging options
 * @param {boolean} [options.verbose=false] - Enable verbose logging
 * @returns {Function} Socket.IO middleware function
 */
export function createLoggingMiddleware(options = {}) {
	const { verbose = false } = options;

	return ([event, ...args], next) => {
		if (verbose) {
			logger.debug('SOCKET', `Event: ${event}`, { args });
		} else {
			logger.debug('SOCKET', `Event: ${event}`);
		}

		next();
	};
}
