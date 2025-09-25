import { createDAOs } from '../db/models/index.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * OAuth Manager for handling OAuth 2.0 authentication flows
 * Manages providers, accounts, tokens, and authentication flows
 */
export class OAuthManager {
	constructor(databaseManager, baseUrl = 'http://localhost:3000') {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		this.baseUrl = baseUrl;
		this.pendingStates = new Map(); // Store OAuth state parameters
		this.stateCleanupInterval = 5 * 60 * 1000; // 5 minutes

		// Start periodic cleanup of expired states
		this.startStateCleanup();
	}

	/**
	 * Update base URL for dynamic tunnel scenarios
	 */
	updateBaseUrl(newBaseUrl) {
		this.baseUrl = newBaseUrl;
		logger.info('OAUTH', `Updated base URL to: ${newBaseUrl}`);
	}

	/**
	 * Get OAuth configuration from database
	 */
	async getOAuthConfig() {
		try {
			const settings = await this.db.getSettingsByCategory('auth');
			return settings.oauth_providers || {
				google: { enabled: false },
				github: { enabled: false }
			};
		} catch (error) {
			logger.error('OAUTH', `Failed to get OAuth config: ${error.message}`);
			return {
				google: { enabled: false },
				github: { enabled: false }
			};
		}
	}

	/**
	 * Update OAuth configuration
	 */
	async updateOAuthConfig(config) {
		try {
			// Validate provider configurations
			const validProviders = ['google', 'github'];
			const sanitizedConfig = {};

			Object.keys(config).forEach(provider => {
				if (validProviders.includes(provider)) {
					sanitizedConfig[provider] = {
						enabled: Boolean(config[provider].enabled),
						clientId: config[provider].clientId || null,
						clientSecret: config[provider].clientSecret || null
					};
				}
			});

			// Update settings
			const currentSettings = await this.db.getSettingsByCategory('auth');
			const newSettings = { ...currentSettings, oauth_providers: sanitizedConfig };

			await this.db.setSettingsForCategory('auth', newSettings, 'OAuth configuration');
			logger.info('OAUTH', 'Updated OAuth configuration');

			return sanitizedConfig;
		} catch (error) {
			logger.error('OAUTH', `Failed to update OAuth config: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get list of enabled OAuth providers
	 */
	async getEnabledProviders() {
		const config = await this.getOAuthConfig();
		const enabledProviders = [];

		Object.keys(config).forEach(provider => {
			if (config[provider].enabled && config[provider].clientId && config[provider].clientSecret) {
				enabledProviders.push(provider);
			}
		});

		return enabledProviders;
	}

	/**
	 * Get provider configuration for OAuth setup
	 */
	async getProviderConfig(provider) {
		const validProviders = ['google', 'github'];
		if (!validProviders.includes(provider)) {
			throw new Error(`Unsupported OAuth provider: ${provider}`);
		}

		const config = await this.getOAuthConfig();
		const providerConfig = config[provider];

		if (!providerConfig || !providerConfig.enabled) {
			throw new Error(`${provider} OAuth is not enabled`);
		}

		return {
			clientId: providerConfig.clientId,
			clientSecret: providerConfig.clientSecret,
			callbackUrl: this.getCallbackUrl(provider)
		};
	}

	/**
	 * Generate callback URL for a provider
	 */
	getCallbackUrl(provider) {
		return `${this.baseUrl}/api/auth/${provider}/callback`;
	}

	/**
	 * Find user by OAuth account
	 */
	async findUserByOAuthAccount(provider, providerAccountId) {
		try {
			const account = await this.daos.oauthAccounts.getByProvider(provider, providerAccountId);
			if (!account) {
				return null;
			}

			const user = await this.daos.users.getById(account.userId);
			return user;
		} catch (error) {
			logger.error('OAUTH', `Failed to find user by OAuth account: ${error.message}`);
			return null;
		}
	}

	/**
	 * Link OAuth account to existing user
	 */
	async linkAccount(userId, oauthProfile, accessToken, refreshToken = null) {
		try {
			// Check if this OAuth account is already linked to another user
			const existingAccount = await this.daos.oauthAccounts.getByProvider(
				oauthProfile.provider,
				oauthProfile.id
			);

			if (existingAccount && existingAccount.userId !== userId) {
				return {
					success: false,
					error: 'OAuth account is already linked to another user'
				};
			}

			// Create or update OAuth account
			const accountData = {
				userId,
				provider: oauthProfile.provider,
				providerAccountId: oauthProfile.id,
				providerEmail: this.extractEmail(oauthProfile),
				providerName: oauthProfile.displayName || oauthProfile.name,
				accessToken,
				refreshToken,
				tokenExpiresAt: null // Will be set if provider returns expiry
			};

			const account = await this.daos.oauthAccounts.createOrUpdate(accountData);

			return {
				success: true,
				account
			};
		} catch (error) {
			logger.error('OAUTH', `Failed to link OAuth account: ${error.message}`);
			return {
				success: false,
				error: 'Failed to link OAuth account'
			};
		}
	}

	/**
	 * Create new user from OAuth profile
	 */
	async createUserFromOAuth(oauthProfile, accessToken, refreshToken = null) {
		try {
			// Validate required OAuth profile fields
			if (!oauthProfile.provider || !oauthProfile.id) {
				return {
					success: false,
					error: 'Invalid OAuth profile: missing provider or id'
				};
			}

			// Extract user information from OAuth profile
			const email = this.extractEmail(oauthProfile);
			const username = this.generateUsername(oauthProfile);
			const displayName = oauthProfile.displayName || oauthProfile.name || username;

			// Check if user with same email already exists
			if (email) {
				const existingUser = await this.daos.users.getByEmail(email);
				if (existingUser) {
					// Link OAuth account to existing user
					const linkResult = await this.linkAccount(existingUser.id, oauthProfile, accessToken, refreshToken);
					if (linkResult.success) {
						return {
							success: true,
							user: existingUser,
							account: linkResult.account,
							isNewUser: false
						};
					}
				}
			}

			// Create new user
			const userData = {
				username,
				displayName,
				email,
				passwordHash: null, // OAuth users don't need password
				isAdmin: false
			};

			const user = await this.daos.users.create(userData);

			// Create OAuth account
			const linkResult = await this.linkAccount(user.id, oauthProfile, accessToken, refreshToken);
			if (!linkResult.success) {
				// Clean up created user if OAuth linking failed
				await this.daos.users.delete(user.id);
				return {
					success: false,
					error: linkResult.error
				};
			}

			return {
				success: true,
				user,
				account: linkResult.account,
				isNewUser: true
			};
		} catch (error) {
			logger.error('OAUTH', `Failed to create user from OAuth: ${error.message}`);
			return {
				success: false,
				error: 'Failed to create user from OAuth profile'
			};
		}
	}

	/**
	 * Handle OAuth callback and return authentication result
	 */
	async handleOAuthCallback(oauthProfile, accessToken, refreshToken = null) {
		try {
			// Try to find existing user by OAuth account
			let user = await this.findUserByOAuthAccount(oauthProfile.provider, oauthProfile.id);
			let account = null;
			let isNewUser = false;

			if (user) {
				// Update existing OAuth account with new tokens
				const linkResult = await this.linkAccount(user.id, oauthProfile, accessToken, refreshToken);
				if (linkResult.success) {
					account = linkResult.account;
				}
			} else {
				// Create new user from OAuth profile
				const createResult = await this.createUserFromOAuth(oauthProfile, accessToken, refreshToken);
				if (createResult.success) {
					user = createResult.user;
					account = createResult.account;
					isNewUser = createResult.isNewUser;
				} else {
					return {
						success: false,
						error: createResult.error
					};
				}
			}

			return {
				success: true,
				user,
				account,
				authMethod: 'oauth',
				isNewUser
			};
		} catch (error) {
			logger.error('OAUTH', `OAuth callback error: ${error.message}`);
			return {
				success: false,
				error: 'OAuth authentication failed'
			};
		}
	}

	/**
	 * Refresh OAuth token
	 */
	async refreshToken(accountId, newTokens) {
		try {
			await this.daos.oauthAccounts.updateTokens(accountId, newTokens);
			return { success: true };
		} catch (error) {
			logger.error('OAUTH', `Failed to refresh token: ${error.message}`);
			return {
				success: false,
				error: 'Failed to refresh OAuth token'
			};
		}
	}

	/**
	 * Get accounts with expired tokens
	 */
	async getExpiredTokens() {
		try {
			return await this.daos.oauthAccounts.getAccountsWithExpiredTokens();
		} catch (error) {
			logger.error('OAUTH', `Failed to get expired tokens: ${error.message}`);
			return [];
		}
	}

	/**
	 * Unlink OAuth account from user
	 */
	async unlinkAccount(accountId, userId) {
		try {
			// Verify account belongs to user
			const account = await this.daos.oauthAccounts.getById(accountId);
			if (!account || account.userId !== userId) {
				return {
					success: false,
					error: 'OAuth account does not belong to user'
				};
			}

			await this.daos.oauthAccounts.delete(accountId);

			// Log unlink event
			await this.daos.authEvents.logEvent(userId, null, null, null, 'oauth_unlinked', {
				provider: account.provider,
				providerAccountId: account.providerAccountId
			});

			return { success: true };
		} catch (error) {
			logger.error('OAUTH', `Failed to unlink OAuth account: ${error.message}`);
			return {
				success: false,
				error: 'Failed to unlink OAuth account'
			};
		}
	}

	/**
	 * Generate OAuth state parameter
	 */
	generateState() {
		const timestamp = Date.now().toString();
		const random = crypto.randomBytes(8).toString('hex');
		return `oauth_${timestamp.slice(-8)}_${random}`;
	}

	/**
	 * Store OAuth state with metadata
	 */
	storeState(state, metadata) {
		this.pendingStates.set(state, {
			...metadata,
			timestamp: Date.now()
		});
	}

	/**
	 * Validate and consume OAuth state
	 */
	validateState(state) {
		if (!this.pendingStates.has(state)) {
			return false;
		}

		const stateData = this.pendingStates.get(state);
		this.pendingStates.delete(state); // One-time use

		// Check if state is not expired (5 minutes max)
		const maxAge = 5 * 60 * 1000;
		if (Date.now() - stateData.timestamp > maxAge) {
			return false;
		}

		return stateData;
	}

	/**
	 * Extract email from OAuth profile
	 */
	extractEmail(oauthProfile) {
		if (oauthProfile.emails && Array.isArray(oauthProfile.emails) && oauthProfile.emails.length > 0) {
			return oauthProfile.emails[0].value || oauthProfile.emails[0];
		}
		return oauthProfile.email || null;
	}

	/**
	 * Generate username from OAuth profile
	 */
	generateUsername(oauthProfile) {
		// Try username from profile
		if (oauthProfile.username) {
			return oauthProfile.username;
		}

		// Try to create from email
		const email = this.extractEmail(oauthProfile);
		if (email) {
			const emailPrefix = email.split('@')[0];
			return emailPrefix.replace(/[^a-zA-Z0-9_]/g, '');
		}

		// Try to create from display name
		if (oauthProfile.displayName) {
			return oauthProfile.displayName
				.toLowerCase()
				.replace(/[^a-zA-Z0-9]/g, '')
				.substring(0, 20);
		}

		// Fallback: use provider and part of ID
		return `${oauthProfile.provider}${oauthProfile.id.toString().slice(-6)}`;
	}

	/**
	 * Start periodic cleanup of expired OAuth states
	 */
	startStateCleanup() {
		setInterval(() => {
			this.cleanupExpiredStates();
		}, this.stateCleanupInterval);
	}

	/**
	 * Clean up expired OAuth states
	 */
	cleanupExpiredStates() {
		const now = Date.now();
		const maxAge = 5 * 60 * 1000; // 5 minutes

		for (const [state, data] of this.pendingStates.entries()) {
			if (now - data.timestamp > maxAge) {
				this.pendingStates.delete(state);
			}
		}
	}

	/**
	 * Get OAuth statistics for admin dashboard
	 */
	async getOAuthStats() {
		try {
			return await this.daos.oauthAccounts.getStats();
		} catch (error) {
			logger.error('OAUTH', `Failed to get OAuth stats: ${error.message}`);
			return {
				total: 0,
				byProvider: [],
				recentlyUpdated: 0,
				expiringSoon: 0
			};
		}
	}

	/**
	 * Cleanup old OAuth data
	 */
	async cleanup() {
		try {
			// Clean up expired tokens older than 90 days
			const cleanedTokens = await this.daos.oauthAccounts.cleanupExpiredTokens(90);
			if (cleanedTokens > 0) {
				logger.info('OAUTH', `Cleaned up ${cleanedTokens} expired OAuth tokens`);
			}

			// Clean up expired states
			this.cleanupExpiredStates();
		} catch (error) {
			logger.error('OAUTH', `OAuth cleanup error: ${error.message}`);
		}
	}
}