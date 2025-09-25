import { OAuthManager } from '../OAuthManager.js';
import { logger } from '../../utils/logger.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

/**
 * OAuth Authentication Adapter
 * Handles OAuth 2.0 authentication flows using Passport.js
 * Supports Google and GitHub providers with dynamic redirect URLs
 */
export class OAuthAdapter {
	constructor(databaseManager, authManager) {
		this.name = 'oauth';
		this.displayName = 'OAuth Provider';
		this.icon = '🌐';

		this.db = databaseManager;
		this.authManager = authManager;
		this.oauthManager = new OAuthManager(databaseManager);

		// Active OAuth sessions (state -> session data)
		this.activeSessions = new Map();
		this.sessionTimeout = 10 * 60 * 1000; // 10 minutes

		// Initialize Passport strategies
		this.initializePassportStrategies();

		// Start session cleanup
		this.startSessionCleanup();
	}

	/**
	 * Initialize Passport.js OAuth strategies
	 */
	initializePassportStrategies() {
		// Configure passport to not use sessions (we handle our own)
		passport.serializeUser((user, done) => done(null, user));
		passport.deserializeUser((user, done) => done(null, user));

		// Initialize strategies (will be configured dynamically)
		this.configurePassportStrategies();
	}

	/**
	 * Configure Passport strategies with current OAuth settings
	 */
	async configurePassportStrategies() {
		try {
			const config = await this.oauthManager.getOAuthConfig();

			// Configure Google Strategy
			if (config.google && config.google.enabled && config.google.clientId) {
				passport.use(
					'google',
					new GoogleStrategy(
						{
							clientID: config.google.clientId,
							clientSecret: config.google.clientSecret,
							callbackURL: this.oauthManager.getCallbackUrl('google'),
							scope: ['profile', 'email']
						},
						this.handleOAuthProfile.bind(this, 'google')
					)
				);
			}

			// Configure GitHub Strategy
			if (config.github && config.github.enabled && config.github.clientId) {
				passport.use(
					'github',
					new GitHubStrategy(
						{
							clientID: config.github.clientId,
							clientSecret: config.github.clientSecret,
							callbackURL: this.oauthManager.getCallbackUrl('github'),
							scope: ['user:email']
						},
						this.handleOAuthProfile.bind(this, 'github')
					)
				);
			}
		} catch (error) {
			logger.error('OAUTH', `Failed to configure Passport strategies: ${error.message}`);
		}
	}

	/**
	 * Handle OAuth profile from Passport strategy
	 */
	async handleOAuthProfile(provider, accessToken, refreshToken, profile, done) {
		try {
			const oauthProfile = {
				provider,
				id: profile.id,
				username: profile.username,
				displayName: profile.displayName,
				name: profile.name,
				emails: profile.emails,
				email: profile.email
			};

			const result = await this.oauthManager.handleOAuthCallback(
				oauthProfile,
				accessToken,
				refreshToken
			);

			done(null, { ...result, accessToken, refreshToken });
		} catch (error) {
			logger.error('OAUTH', `OAuth profile handling error: ${error.message}`);
			done(error, null);
		}
	}

	/**
	 * Update base URL for tunnel scenarios
	 */
	updateBaseUrl(newBaseUrl) {
		this.oauthManager.updateBaseUrl(newBaseUrl);
		// Reconfigure strategies with new callback URLs
		this.configurePassportStrategies();
	}

	/**
	 * Get adapter information
	 */
	getInfo() {
		return {
			name: this.name,
			displayName: this.displayName,
			icon: this.icon,
			requiresHttps: false, // OAuth can work over HTTP for localhost
			supportsRegistration: false, // OAuth handles registration automatically
			supportsAuthentication: true,
			description: 'Authenticate using OAuth providers (Google, GitHub)',
			methods: this.getSupportedMethods()
		};
	}

	/**
	 * Get supported authentication methods
	 */
	getSupportedMethods() {
		return ['oauth-google', 'oauth-github'];
	}

	/**
	 * Check if OAuth is available
	 */
	async isAvailable(request) {
		try {
			const enabledProviders = await this.oauthManager.getEnabledProviders();
			return enabledProviders.length > 0;
		} catch (error) {
			logger.error('OAUTH', `OAuth availability check failed: ${error.message}`);
			return false;
		}
	}

	/**
	 * Begin OAuth authentication
	 */
	async beginAuthentication(request, method, options = {}) {
		try {
			// Parse provider from method (oauth-google, oauth-github)
			const provider = method.replace('oauth-', '');
			const supportedProviders = ['google', 'github'];

			if (!supportedProviders.includes(provider)) {
				throw new Error(`Unsupported OAuth method: ${method}`);
			}

			// Check if provider is enabled
			const config = await this.oauthManager.getOAuthConfig();
			if (!config[provider] || !config[provider].enabled) {
				throw new Error(
					`${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not enabled`
				);
			}

			// Update base URL from request
			const baseUrl = `${request.protocol}://${request.headers.host}`;
			this.updateBaseUrl(baseUrl);

			// Reconfigure strategies with updated base URL
			await this.configurePassportStrategies();

			// Generate session ID and state
			const sessionId = this.generateSessionId();
			const state = this.oauthManager.generateState();

			// Store session data
			this.activeSessions.set(sessionId, {
				method,
				provider,
				state,
				returnTo: options.returnTo || '/',
				timestamp: Date.now()
			});

			// Store state in OAuth manager
			this.oauthManager.storeState(state, {
				provider,
				sessionId,
				returnTo: options.returnTo || '/'
			});

			// Generate OAuth authorization URL
			const authorizationUrl = this.generateAuthorizationUrl(provider, state);

			return {
				sessionId,
				method,
				redirectUrl: authorizationUrl,
				requiresUserInteraction: true,
				state
			};
		} catch (error) {
			logger.error('OAUTH', `OAuth begin authentication error: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Generate OAuth authorization URL
	 */
	generateAuthorizationUrl(provider, state) {
		const baseUrls = {
			google: 'https://accounts.google.com/o/oauth2/v2/auth',
			github: 'https://github.com/login/oauth/authorize'
		};

		const callbackUrl = this.oauthManager.getCallbackUrl(provider);

		// Get client ID from config (synchronously from cache would be better)
		// For now, we'll construct the URL with placeholders and let the API route handle it
		return `${baseUrls[provider]}?response_type=code&client_id=CLIENT_ID&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=${this.getProviderScope(provider)}`;
	}

	/**
	 * Get OAuth scope for provider
	 */
	getProviderScope(provider) {
		const scopes = {
			google: 'openid email profile',
			github: 'user:email'
		};
		return encodeURIComponent(scopes[provider] || '');
	}

	/**
	 * Complete OAuth authentication
	 */
	async completeAuthentication(sessionId, request, data) {
		try {
			// Validate session
			const session = this.activeSessions.get(sessionId);
			if (!session) {
				throw new Error('Invalid or expired OAuth session');
			}

			// Remove session (one-time use)
			this.activeSessions.delete(sessionId);

			// Process OAuth result
			const { oauthResult } = data;
			if (!oauthResult || !oauthResult.success) {
				throw new Error(oauthResult?.error || 'OAuth authentication failed');
			}

			// Return authentication result
			return {
				success: true,
				method: session.method,
				user: oauthResult.user,
				authMethod: 'oauth',
				provider: session.provider,
				isNewUser: oauthResult.isNewUser || false,
				returnTo: session.returnTo
			};
		} catch (error) {
			logger.error('OAUTH', `OAuth complete authentication error: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Traditional authenticate method (not used for OAuth)
	 */
	async authenticate(credentials) {
		throw new Error('OAuth requires begin/complete authentication flow');
	}

	/**
	 * Validate OAuth credentials
	 */
	validateCredentials(credentials) {
		// OAuth credentials are validated by the providers
		return { valid: true };
	}

	/**
	 * Validate OAuth state parameter
	 */
	validateOAuthState(state) {
		if (!state || !state.startsWith('oauth_')) {
			return { valid: false, error: 'Invalid state format' };
		}
		return { valid: true };
	}

	/**
	 * Get provider redirect URL based on request
	 */
	getProviderRedirectUrl(provider, request) {
		const baseUrl = `${request.protocol}://${request.headers.host}`;
		return `${baseUrl}/api/auth/${provider}/callback`;
	}

	/**
	 * Generate unique session ID
	 */
	generateSessionId() {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 15);
		return `oauth_${timestamp}_${random}`;
	}

	/**
	 * Start periodic cleanup of expired sessions
	 */
	startSessionCleanup() {
		setInterval(() => {
			this.cleanupExpiredSessions();
		}, 60000); // Cleanup every minute
	}

	/**
	 * Clean up expired OAuth sessions
	 */
	cleanupExpiredSessions() {
		const now = Date.now();
		const expiredSessions = [];

		for (const [sessionId, session] of this.activeSessions.entries()) {
			if (now - session.timestamp > this.sessionTimeout) {
				expiredSessions.push(sessionId);
			}
		}

		expiredSessions.forEach((sessionId) => {
			this.activeSessions.delete(sessionId);
		});

		if (expiredSessions.length > 0) {
			logger.debug('OAUTH', `Cleaned up ${expiredSessions.length} expired OAuth sessions`);
		}
	}

	/**
	 * Get user's OAuth accounts
	 */
	async getUserOAuthAccounts(userId) {
		try {
			return await this.oauthManager.daos.oauthAccounts.getByUserId(userId);
		} catch (error) {
			logger.error('OAUTH', `Failed to get user OAuth accounts: ${error.message}`);
			return [];
		}
	}

	/**
	 * Unlink OAuth account
	 */
	async unlinkOAuthAccount(accountId, userId) {
		try {
			return await this.oauthManager.unlinkAccount(accountId, userId);
		} catch (error) {
			logger.error('OAUTH', `Failed to unlink OAuth account: ${error.message}`);
			return { success: false, error: 'Failed to unlink OAuth account' };
		}
	}

	/**
	 * Refresh OAuth tokens
	 */
	async refreshOAuthTokens(accountId) {
		try {
			// This would typically involve calling the OAuth provider's token refresh endpoint
			// For now, this is a placeholder for the token refresh logic
			logger.info('OAUTH', `Token refresh requested for account ${accountId}`);
			return { success: true, message: 'Token refresh functionality to be implemented' };
		} catch (error) {
			logger.error('OAUTH', `Failed to refresh OAuth tokens: ${error.message}`);
			return { success: false, error: 'Failed to refresh OAuth tokens' };
		}
	}

	/**
	 * Get OAuth configuration for client
	 */
	async getOAuthConfigForClient() {
		try {
			const config = await this.oauthManager.getOAuthConfig();
			const enabledProviders = await this.oauthManager.getEnabledProviders();

			// Return sanitized config for client (no secrets)
			const clientConfig = {};
			enabledProviders.forEach((provider) => {
				clientConfig[provider] = {
					enabled: true,
					name: provider.charAt(0).toUpperCase() + provider.slice(1),
					icon: this.getProviderIcon(provider)
				};
			});

			return clientConfig;
		} catch (error) {
			logger.error('OAUTH', `Failed to get OAuth config for client: ${error.message}`);
			return {};
		}
	}

	/**
	 * Get provider icon
	 */
	getProviderIcon(provider) {
		const icons = {
			google: '🔍',
			github: '🐙'
		};
		return icons[provider] || '🌐';
	}
}
