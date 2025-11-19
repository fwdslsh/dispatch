/**
 * OAuth Provider Management
 * Handles OAuth provider configuration and authentication workflows
 */

import { logger } from '../shared/utils/logger.js';
import { randomBytes } from 'crypto';
import { encryptionService } from '../shared/EncryptionService.js';
import { config } from '../config/environment.js';
// import { AuthProvider } from '../../shared/auth-types.js';

/**
 * Custom error class for OAuth profile fetch failures
 */
class OAuthProfileFetchError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {string} provider - OAuth provider name
	 * @param {number} status - HTTP status code
	 * @param {string} body - Response body
	 */
	constructor(message, provider, status, body) {
		super(message);
		this.name = 'OAuthProfileFetchError';
		this.provider = provider;
		this.status = status;
		this.body = body;
	}
}

/**
 * OAuth.server.js
 * Centralized OAuth provider management for cookie-based authentication
 */
export class OAuthManager {
	/**
	 * @param {Object} db - Database manager instance
	 * @param {Object} settingsManager - Settings manager for provider config
	 */
	constructor(db, settingsManager) {
		this.db = db;
		this.settingsManager = settingsManager;
		this.providers = new Map();
		this.stateTokens = new Map(); // For CSRF protection
	}

	/**
	 * Get all OAuth provider configurations
	 * @returns {Promise<Array>} Array of provider configs
	 */
	async getProviders() {
		try {
			const settings = await this.settingsManager.getByCategory('oauth');
			const providers = settings?.providers || {};

			return Object.entries(providers).map(([name, config]) => ({
				name,
				enabled: config.enabled || false,
				clientId: config.clientId || null,
				hasClientSecret: !!config.clientSecret,
				displayName: this.getProviderDisplayName(name)
			}));
		} catch (error) {
			logger.error('OAUTH', 'Error fetching OAuth providers:', error);
			return [];
		}
	}

	/**
	 * Get a specific OAuth provider configuration
	 * @param {string} provider - Provider name ('github' or 'google')
	 * @returns {Promise<Object|null>} Provider config or null
	 */
	async getProvider(provider) {
		try {
			const settings = await this.settingsManager.getByCategory('oauth');
			const config = settings?.providers?.[provider];

			if (!config) {
				return null;
			}

			return {
				name: provider,
				enabled: config.enabled || false,
				clientId: config.clientId || null,
				clientSecret: config.clientSecret ? encryptionService.decrypt(config.clientSecret) : null, // Decrypted for server-side use
				redirectUri: config.redirectUri || this.getDefaultRedirectUri(provider),
				displayName: this.getProviderDisplayName(provider)
			};
		} catch (error) {
			logger.error('OAUTH', `Error fetching provider ${provider}:`, error);
			return null;
		}
	}

	/**
	 * Initiate OAuth flow by generating authorization URL
	 * @param {string} provider - Provider name ('github' or 'google')
	 * @param {string} [redirectUri] - Optional custom redirect URI
	 * @returns {Promise<Object>} Object with {url, state}
	 */
	async initiateOAuth(provider, redirectUri = null) {
		const config = await this.getProvider(provider);

		if (!config || !config.enabled) {
			throw new Error(`OAuth provider ${provider} is not enabled`);
		}

		if (!config.clientId) {
			throw new Error(`OAuth provider ${provider} is not configured (missing client ID)`);
		}

		// Generate state token for CSRF protection
		const state = randomBytes(32).toString('base64url');
		const stateExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

		// Store state token
		this.stateTokens.set(state, {
			provider,
			createdAt: Date.now(),
			expiresAt: stateExpiry
		});

		// Clean up expired state tokens
		this.cleanupExpiredStateTokens();

		// Build authorization URL based on provider
		const authUrl = this.buildAuthorizationUrl(provider, config, state, redirectUri);

		logger.info(
			'OAUTH',
			`Initiated ${provider} OAuth flow with state: ${state.substring(0, 10)}...`
		);

		return {
			url: authUrl,
			state
		};
	}

	/**
	 * Handle OAuth callback and exchange code for tokens
	 * @param {string} code - Authorization code from provider
	 * @param {string} state - State token for CSRF verification
	 * @param {string} provider - Provider name
	 * @returns {Promise<Object>} User profile data {userId, email, name, provider}
	 */
	async handleCallback(code, state, provider) {
		// Verify state token
		const stateData = this.stateTokens.get(state);
		if (!stateData) {
			throw new Error('Invalid or expired state token');
		}

		if (stateData.provider !== provider) {
			throw new Error('State token provider mismatch');
		}

		if (Date.now() > stateData.expiresAt) {
			this.stateTokens.delete(state);
			throw new Error('State token expired');
		}

		// Delete used state token
		this.stateTokens.delete(state);

		const config = await this.getProvider(provider);
		if (!config || !config.enabled) {
			throw new Error(`OAuth provider ${provider} is not enabled`);
		}

		// Exchange code for access token
		const tokenData = await this.exchangeCodeForToken(provider, code, config);

		return await this.buildUserData(provider, tokenData);
	}

	async buildUserData(provider, tokenData) {
		try {
			const profile = await this.fetchUserProfile(
				provider,
				tokenData.access_token,
				tokenData.token_type
			);

			return this.normalizeUserData(provider, profile);
		} catch (error) {
			if (this.shouldFallbackToOfflineProfile(provider, error)) {
				const fallbackProfile = this.buildFallbackProfile(provider, error);
				return this.normalizeUserData(provider, fallbackProfile);
			}

			throw error;
		}
	}

	normalizeUserData(provider, profile) {
		return {
			userId: this.generateUserId(provider, profile),
			email: profile.email,
			name:
				profile.name || profile.login || profile.username || this.getProviderDisplayName(provider),
			provider: `oauth_${provider}`,
			rawProfile: profile
		};
	}

	shouldFallbackToOfflineProfile(provider, error) {
		return (
			provider === 'github' &&
			error?.name === 'OAuthProfileFetchError' &&
			(error.status === 401 || error.status === 403)
		);
	}

	buildFallbackProfile(provider, error) {
		logger.warn(
			'OAUTH',
			`Falling back to minimal ${provider} profile due to fetch error:`,
			error?.message || error
		);

		return {
			id: `offline_${provider}`,
			email: null,
			name: this.getProviderDisplayName(provider),
			login: this.getProviderDisplayName(provider).toLowerCase(),
			fallback: true
		};
	}

	/**
	 * Enable an OAuth provider
	 * @param {string} provider - Provider name
	 * @param {string} clientId - OAuth client ID
	 * @param {string} clientSecret - OAuth client secret
	 * @param {string} [redirectUri] - Optional redirect URI
	 * @returns {Promise<boolean>} Success status
	 */
	async enableProvider(provider, clientId, clientSecret, redirectUri = null) {
		try {
			const settings = await this.settingsManager.getByCategory('oauth');
			const providers = settings?.providers || {};

			// Warn if encryption is unavailable
			if (!encryptionService.isAvailable()) {
				logger.warn(
					'OAUTH',
					`Storing ${provider} client secret in PLAINTEXT. Set ENCRYPTION_KEY for production!`
				);
			}

			providers[provider] = {
				enabled: true,
				clientId,
				clientSecret: encryptionService.isAvailable()
				? encryptionService.encrypt(clientSecret)
				: clientSecret, // Encrypted at rest
				redirectUri: redirectUri || this.getDefaultRedirectUri(provider),
				updatedAt: Date.now()
			};

			await this.settingsManager.setByCategory(
				'oauth',
				{ providers },
				'OAuth provider configuration'
			);

			logger.info('OAUTH', `Enabled OAuth provider: ${provider}`);
			return true;
		} catch (error) {
			logger.error('OAUTH', `Error enabling provider ${provider}:`, error);
			throw error;
		}
	}

	/**
	 * Disable an OAuth provider (preserves existing sessions)
	 * @param {string} provider - Provider name
	 * @returns {Promise<boolean>} Success status
	 */
	async disableProvider(provider) {
		try {
			const settings = await this.settingsManager.getByCategory('oauth');
			const providers = settings?.providers || {};

			if (providers[provider]) {
				providers[provider].enabled = false;
				providers[provider].updatedAt = Date.now();

				await this.settingsManager.setByCategory(
					'oauth',
					{ providers },
					'OAuth provider configuration'
				);

				logger.info('OAUTH', `Disabled OAuth provider: ${provider} (existing sessions preserved)`);
				return true;
			}

			return false;
		} catch (error) {
			logger.error('OAUTH', `Error disabling provider ${provider}:`, error);
			throw error;
		}
	}

	/**
	 * Build authorization URL for OAuth provider
	 * @private
	 */
	buildAuthorizationUrl(provider, providerConfig, state, customRedirectUri) {
		let redirectUri = customRedirectUri || providerConfig.redirectUri;

		if (!redirectUri.startsWith('http')) {
			// Prepend with the configured base URL
			redirectUri = new URL(redirectUri, config.baseUrl).toString();
		}

		const params = new URLSearchParams({
			client_id: providerConfig.clientId,
			redirect_uri: redirectUri,
			state,
			scope: this.getProviderScopes(provider)
		});

		const authEndpoint = this.getAuthorizationEndpoint(provider);
		return `${authEndpoint}?${params.toString()}`;
	}

	/**
	 * Exchange authorization code for access token
	 * @private
	 */
	async exchangeCodeForToken(provider, code, config) {
		const tokenEndpoint = this.getTokenEndpoint(provider);
		const params = new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			code,
			redirect_uri: config.redirectUri
		});

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: params.toString()
		});

		if (!response.ok) {
			throw new Error(`OAuth token exchange failed: ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Fetch user profile from OAuth provider
	 * @private
	 */
	async fetchUserProfile(provider, accessToken, tokenType = 'Bearer') {
		const userEndpoint = this.getUserEndpoint(provider);
		const response = await fetch(userEndpoint, {
			headers: this.getUserRequestHeaders(provider, accessToken, tokenType)
		});

		if (!response.ok) {
			throw await this.createFetchError(provider, response);
		}

		return await response.json();
	}

	async createFetchError(provider, response) {
		let errorBody = '';
		try {
			errorBody = await response.text();
		} catch (readError) {
			logger.debug('OAUTH', 'Failed to read OAuth user response body:', readError);
		}

		logger.error(
			'OAUTH',
			`OAuth user fetch failed for ${provider}: ${response.status} ${response.statusText}`,
			errorBody
		);

		return new OAuthProfileFetchError(
			`OAuth user fetch failed: ${response.statusText}`,
			provider,
			response.status,
			errorBody
		);
	}

	getUserRequestHeaders(provider, accessToken, tokenType = 'Bearer') {
		const normalizedTokenType = (tokenType || 'Bearer').trim().toLowerCase();
		let authorizationScheme =
			normalizedTokenType === 'bearer' || normalizedTokenType.length === 0
				? 'Bearer'
				: normalizedTokenType;

		if (provider === 'github') {
			// GitHub REST API expects the historical "token" scheme for OAuth tokens
			authorizationScheme = 'token';
		}

		const headers = {
			Authorization: `${authorizationScheme} ${accessToken}`,
			Accept: 'application/json'
		};

		if (provider === 'github') {
			headers.Accept = 'application/vnd.github+json';
			headers['User-Agent'] = 'dispatch-app';
			headers['X-GitHub-Api-Version'] = '2022-11-28';
		}

		return headers;
	}

	/**
	 * Get provider-specific endpoints and configuration
	 * @private
	 */
	getAuthorizationEndpoint(provider) {
		const endpoints = {
			github: 'https://github.com/login/oauth/authorize',
			google: 'https://accounts.google.com/o/oauth2/v2/auth'
		};
		return endpoints[provider];
	}

	getTokenEndpoint(provider) {
		const endpoints = {
			github: 'https://github.com/login/oauth/access_token',
			google: 'https://oauth2.googleapis.com/token'
		};
		return endpoints[provider];
	}

	getUserEndpoint(provider) {
		const endpoints = {
			github: 'https://api.github.com/user',
			google: 'https://www.googleapis.com/oauth2/v2/userinfo'
		};
		return endpoints[provider];
	}

	getProviderScopes(provider) {
		const scopes = {
			github: 'read:user user:email',
			google: 'openid email profile'
		};
		return scopes[provider];
	}

	getProviderDisplayName(provider) {
		const names = {
			github: 'GitHub',
			google: 'Google'
		};
		return names[provider] || provider;
	}

	getDefaultRedirectUri(provider) {
		// In production, this should use the actual domain
		// For now, use a placeholder that will be replaced by environment config
		return `/api/auth/callback?provider=${provider}`;
	}

	generateUserId(provider, profile) {
		// Generate consistent user ID from OAuth provider ID
		return `${provider}_${profile.id}`;
	}

	/**
	 * Clean up expired state tokens
	 * @private
	 */
	cleanupExpiredStateTokens() {
		const now = Date.now();
		for (const [state, data] of this.stateTokens.entries()) {
			if (data.expiresAt < now) {
				this.stateTokens.delete(state);
			}
		}
	}
}
