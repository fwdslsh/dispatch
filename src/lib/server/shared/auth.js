import { logger } from './utils/logger';

/**
 * @typedef {import('./auth/oauth.js').MultiAuthManager} MultiAuthManager
 * @typedef {import('../auth/ApiKeyManager.server.js').ApiKeyManager} ApiKeyManager
 */

/**
 * AuthService - Authentication service with API key and OAuth support
 * Replaces legacy terminal key authentication with managed API keys
 */
export class AuthService {
	/**
	 * Create AuthService instance
	 * @param {ApiKeyManager} apiKeyManager - API key manager instance
	 */
	constructor(apiKeyManager) {
		this.apiKeyManager = apiKeyManager;
		this.multiAuthManager = null;
		this.instanceId = Date.now().toString(36) + Math.random().toString(36).slice(2);
		logger.info('AUTH', 'AuthService initialized with API key authentication', {
			instanceId: this.instanceId
		});
	}

	/**
	 * Get authentication key from request using standardized pattern
	 * Tries Authorization header first (preferred)
	 *
	 * @param {Request} request - SvelteKit request object
	 * @returns {string|null} Authentication key or null if not found
	 */
	getAuthKeyFromRequest(request) {
		// Try Authorization header first (preferred, industry standard)
		const authHeader = request.headers.get('Authorization');
		if (authHeader) {
			// Support both "Bearer <token>" and plain token
			return authHeader.replace(/^Bearer\s+/i, '');
		}

		return null;
	}

	/**
	 * Set MultiAuthManager instance for OAuth session validation
	 * Should be called during application startup
	 *
	 * @param {MultiAuthManager} multiAuthManager - MultiAuthManager instance
	 */
	setMultiAuthManager(multiAuthManager) {
		this.multiAuthManager = multiAuthManager;
		logger.info('AUTH', 'MultiAuthManager wired to AuthService', { instanceId: this.instanceId });
	}

	/**
	 * Validate authentication using multi-strategy approach
	 * Supports both API key and OAuth session authentication
	 *
	 * Strategy order:
	 * 1. API key validation (bcrypt, ~100ms)
	 * 2. OAuth session validation (async, DB lookup)
	 *
	 * @param {string} token - Authentication token (API key or session ID)
	 * @returns {Promise<{valid: boolean, provider?: string, userId?: string, apiKeyId?: string, label?: string}>}
	 */
	async validateAuth(token) {
		if (!token) {
			return { valid: false };
		}

		// Strategy 1: API key validation (bcrypt constant-time comparison)
		try {
			const apiKeyData = await this.apiKeyManager.verify(token);
			if (apiKeyData) {
				return {
					valid: true,
					provider: 'api_key',
					userId: apiKeyData.userId,
					apiKeyId: apiKeyData.id,
					label: apiKeyData.label
				};
			}
		} catch (error) {
			logger.debug('AUTH', 'API key validation failed:', error.message);
		}

		// Strategy 2: OAuth session validation (async, DB lookup)
		if (this.multiAuthManager) {
			try {
				const session = await this.multiAuthManager.validateSession(token);
				if (session) {
					// validateSession() already checks expiration
					return {
						valid: true,
						provider: session.provider,
						userId: session.userId
					};
				}
			} catch (error) {
				logger.debug('AUTH', 'OAuth session validation failed:', error.message);
			}
		}

		return { valid: false };
	}
}
