/**
 * AuthStrategy.js
 *
 * Base class for authentication strategies.
 * Each strategy implements a single authentication method (session cookie, API key, OAuth, etc.)
 *
 * Strategy Pattern Benefits:
 * - Single Responsibility: Each strategy handles one auth method
 * - Open/Closed: New auth methods can be added without modifying existing code
 * - Testability: Each strategy can be tested in isolation
 * - No Duplication: Common patterns abstracted to base class
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * Base authentication strategy
 * Subclasses implement specific authentication methods
 */
export class AuthStrategy {
	constructor(name) {
		this.name = name;
	}

	/**
	 * Attempt to authenticate the request using this strategy
	 *
	 * @param {Object} event - SvelteKit request event
	 * @param {Object} services - Service container with auth services
	 * @returns {Promise<AuthResult|null>} Auth result if successful, null if this strategy doesn't apply
	 */
	async authenticate(event, services) {
		throw new Error('authenticate() must be implemented by subclass');
	}

	/**
	 * Log authentication result
	 * @param {string} pathname - Request pathname
	 * @param {AuthResult} result - Authentication result
	 * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
	 */
	logSuccess(pathname, result, level = 'debug') {
		logger[level]?.(
			'AUTH',
			`Authenticated ${pathname} via ${this.name} (provider: ${result.provider})`,
			{
				strategy: this.name,
				provider: result.provider,
				userId: result.userId
			}
		);
	}

	/**
	 * Log authentication failure
	 * @param {string} pathname - Request pathname
	 * @param {string} reason - Failure reason
	 */
	logFailure(pathname, reason) {
		logger.debug('AUTH', `${this.name} authentication failed for ${pathname}: ${reason}`);
	}
}

/**
 * @typedef {Object} AuthResult
 * @property {boolean} authenticated - Whether authentication succeeded
 * @property {string} [provider] - Auth provider ('session_cookie', 'api_key', 'oauth_github', etc.)
 * @property {string} [userId] - User ID
 * @property {Object} [session] - Session data (if using session cookies)
 * @property {Object} [user] - User data
 * @property {string} [apiKeyId] - API key ID (if using API key auth)
 * @property {string} [label] - API key label (if using API key auth)
 */
