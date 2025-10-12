/**
 * OAuth Provider Management
 * Handles OAuth provider configuration and authentication workflows
 */

import { logger } from '../shared/utils/logger.js';
import { randomBytes } from 'crypto';
// import { AuthProvider } from '../../shared/auth-types.js';

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
				clientSecret: config.clientSecret || null, // Only used server-side
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

		// Fetch user profile
		const userProfile = await this.fetchUserProfile(provider, tokenData.access_token);

		// Return standardized user data
		return {
			userId: this.generateUserId(provider, userProfile),
			email: userProfile.email,
			name: userProfile.name || userProfile.login || userProfile.username,
			provider: `oauth_${provider}`,
			rawProfile: userProfile
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

			providers[provider] = {
				enabled: true,
				clientId,
				clientSecret, // TODO: Encrypt in production
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
	buildAuthorizationUrl(provider, config, state, customRedirectUri) {
		const redirectUri = customRedirectUri || config.redirectUri;
		const params = new URLSearchParams({
			client_id: config.clientId,
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
	async fetchUserProfile(provider, accessToken) {
		const userEndpoint = this.getUserEndpoint(provider);
		const response = await fetch(userEndpoint, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`OAuth user fetch failed: ${response.statusText}`);
		}

		return await response.json();
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
