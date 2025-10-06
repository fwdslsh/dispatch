import { logger } from './utils/logger';

/**
 * @typedef {import('./auth/oauth.js').MultiAuthManager} MultiAuthManager
 */

/**
 * AuthService - Singleton authentication service
 * Manages terminal key caching and validation
 */
export class AuthService {
	/**
	 * Create AuthService instance
	 */
	constructor() {
		this.cachedTerminalKey = null;
		this.multiAuthManager = null;
		this.instanceId = Date.now().toString(36) + Math.random().toString(36).slice(2);
	}

	/**
	 * Initialize the terminal key cache with proper settings hierarchy
	 * Should be called during application startup
	 *
	 * @param {Object} settingsRepository - SettingsRepository instance for settings lookup
	 * @returns {Promise<string>} The resolved terminal key
	 */
	async initialize(settingsRepository) {
		let terminalKey;

		// Try to get from database first (using new unified settings table)
		if (settingsRepository) {
			try {
				const authSettings = await settingsRepository.getByCategory('authentication');
				if (authSettings && authSettings.terminal_key) {
					terminalKey = authSettings.terminal_key;
					this.cachedTerminalKey = terminalKey;
					logger.info('AUTH', 'Terminal key loaded from database settings', {
						instanceId: this.instanceId
					});
					return terminalKey;
				}
			} catch (error) {
				// Fall through to environment variable if database lookup fails
				logger.warn('AUTH', 'Failed to get terminal_key from settings database:', error.message, {
					instanceId: this.instanceId
				});
			}
		}

		// Fall back to environment variable
		if (process.env.TERMINAL_KEY) {
			terminalKey = process.env.TERMINAL_KEY;
			this.cachedTerminalKey = terminalKey;
			logger.info('AUTH', 'Terminal key loaded from environment variable', {
				instanceId: this.instanceId
			});
			return terminalKey;
		}

		// Final fallback to default
		terminalKey = 'change-me-to-a-strong-password';
		this.cachedTerminalKey = terminalKey;
		logger.warn('AUTH', 'Terminal key using default value', { instanceId: this.instanceId });
		return terminalKey;
	}

	/**
	 * Update the cached terminal key
	 * Should be called when settings are changed via the settings API
	 *
	 * @param {string} newKey - New terminal key value
	 */
	updateCachedKey(newKey) {
		this.cachedTerminalKey = newKey;
		logger.info('AUTH', 'Terminal key cache updated', { instanceId: this.instanceId });
	}

	/**
	 * Get the current cached terminal key
	 * Falls back to environment variable if not initialized
	 *
	 * @returns {string} The cached terminal key
	 */
	getCachedKey() {
		if (this.cachedTerminalKey !== null) {
			return this.cachedTerminalKey;
		}

		// If not initialized, fall back to environment variable
		logger.warn(
			'AUTH',
			'Terminal key cache not initialized, falling back to environment variable',
			{ instanceId: this.instanceId }
		);
		return process.env.TERMINAL_KEY || 'change-me-to-a-strong-password';
	}

	/**
	 * Validate a key against the configured terminal key
	 * Uses cached value from settings hierarchy (database > env > default)
	 *
	 * @param {string} key - Key to validate
	 * @returns {boolean} True if valid
	 */
	validateKey(key) {
		const terminalKey = this.getCachedKey();
		return terminalKey && key === terminalKey;
	}

	/**
	 * Require authentication, throwing error if invalid
	 * Uses cached terminal key from settings hierarchy
	 *
	 * @param {string} key - Key to validate
	 * @throws {Error} If authentication key is invalid
	 */
	requireAuth(key) {
		if (!this.validateKey(key)) {
			throw new Error('Invalid authentication key');
		}
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
	 * Supports both terminal key (sync) and OAuth session (async)
	 *
	 * Strategy order:
	 * 1. Terminal key validation (sync, fast path)
	 * 2. OAuth session validation (async, DB lookup)
	 *
	 * @param {string} token - Authentication token (terminal key or session ID)
	 * @returns {Promise<{valid: boolean, provider?: string, userId?: string}>}
	 */
	async validateAuth(token) {
		if (!token) {
			return { valid: false };
		}

		// Strategy 1: Terminal key validation (sync, fast path)
		if (this.validateKey(token)) {
			return { valid: true, provider: 'terminal_key' };
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
				logger.warn('AUTH', 'OAuth session validation failed:', error.message);
			}
		}

		return { valid: false };
	}
}

// Backwards compatibility exports - deprecated, will be removed in future version
let deprecatedInstance = null;

export async function initializeTerminalKey(settingsRepository = null) {
	if (!deprecatedInstance) {
		deprecatedInstance = new AuthService();
	}
	return await deprecatedInstance.initialize(settingsRepository);
}

export function updateCachedTerminalKey(newKey) {
	if (!deprecatedInstance) {
		deprecatedInstance = new AuthService();
	}
	return deprecatedInstance.updateCachedKey(newKey);
}

export function getCachedTerminalKey() {
	if (!deprecatedInstance) {
		deprecatedInstance = new AuthService();
	}
	return deprecatedInstance.getCachedKey();
}

export function validateKey(key) {
	if (!deprecatedInstance) {
		deprecatedInstance = new AuthService();
	}
	return deprecatedInstance.validateKey(key);
}

export function requireAuth(key) {
	if (!deprecatedInstance) {
		deprecatedInstance = new AuthService();
	}
	return deprecatedInstance.requireAuth(key);
}

export function getAuthKeyFromRequest(request) {
	if (!deprecatedInstance) {
		deprecatedInstance = new AuthService();
	}
	return deprecatedInstance.getAuthKeyFromRequest(request);
}
