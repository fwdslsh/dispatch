/**
 * ApiKeyStrategy.js
 *
 * Authentication strategy using API keys via Authorization header.
 * Handles programmatic access (CLI, scripts, API clients).
 *
 * Flow:
 * 1. Extract API key from Authorization header
 * 2. Validate API key with AuthService
 * 3. Return user data and API key metadata
 */

import { AuthStrategy } from './AuthStrategy.js';

export class ApiKeyStrategy extends AuthStrategy {
	constructor() {
		super('api_key');
	}

	/**
	 * Authenticate using API key
	 * @param {Object} event - SvelteKit request event
	 * @param {Object} services - Service container
	 * @returns {Promise<import('./AuthStrategy.js').AuthResult|null>}
	 */
	async authenticate(event, services) {
		const { pathname } = event.url;
		const authService = services.auth;

		// Extract API key from Authorization header
		const token = authService.getAuthKeyFromRequest(event.request);
		if (!token) {
			this.logFailure(pathname, 'No API key found in Authorization header');
			return null;
		}

		// Validate API key
		const authResult = await authService.validateAuth(token);
		if (!authResult.valid) {
			this.logFailure(pathname, 'Invalid API key');
			return null;
		}

		const result = {
			authenticated: true,
			provider: authResult.provider,
			userId: authResult.userId,
			apiKeyId: authResult.apiKeyId,
			label: authResult.label
		};

		this.logSuccess(pathname, result);

		return result;
	}
}
