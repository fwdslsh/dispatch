import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { logger } from '../utils/logger.js';

/**
 * Multi-Authentication System for Dispatch
 *
 * Extends the basic key-based authentication with OAuth, device pairing, and WebAuthn support.
 * Designed for production deployments that need more sophisticated authentication.
 */

/**
 * Authentication provider interface
 */
export class AuthProvider {
	constructor(name, config = {}) {
		this.name = name;
		this.config = config;
		this.isEnabled = config.enabled !== false;
	}

	/**
	 * Initialize the auth provider
	 */
	async init() {
		throw new Error('init() must be implemented by auth provider');
	}

	/**
	 * Authenticate a user with provider-specific credentials
	 * @param {Object} credentials - Provider-specific credentials
	 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
	 */
	async authenticate(credentials) {
		throw new Error('authenticate() must be implemented by auth provider');
	}

	/**
	 * Get authorization URL for OAuth flows
	 * @param {Object} params - OAuth parameters
	 * @returns {Promise<string|{url: string, state: any}>} Authorization URL or object with URL and state
	 */
	async getAuthorizationUrl(params) {
		throw new Error('getAuthorizationUrl() not implemented for this provider');
	}

	/**
	 * Handle OAuth callback
	 * @param {Object} params - Callback parameters
	 * @returns {Promise<Object|null>} User object if successful
	 */
	async handleCallback(params) {
		throw new Error('handleCallback() not implemented for this provider');
	}

	/**
	 * Refresh access token
	 * @param {string} refreshToken - Refresh token
	 * @returns {Promise<Object|null>} New token data
	 */
	async refreshToken(refreshToken) {
		throw new Error('refreshToken() not implemented for this provider');
	}

	/**
	 * Revoke user session
	 * @param {string} userId - User ID
	 * @returns {Promise<boolean>} Success status
	 */
	async revokeSession(userId) {
		logger.debug('AUTH', `Default revoke session for user ${userId} on provider ${this.name}`);
		return true;
	}
}

/**
 * GitHub OAuth provider
 */
export class GitHubAuthProvider extends AuthProvider {
	constructor(config) {
		super('github', config);
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.redirectUri = config.redirectUri;
		this.scopes = config.scopes || ['user:email'];
	}

	async init() {
		if (!this.clientId || !this.clientSecret) {
			logger.warn('AUTH', 'GitHub OAuth not configured - missing client credentials');
			this.isEnabled = false;
			return;
		}
		logger.info('AUTH', 'GitHub OAuth provider initialized');
	}

	async getAuthorizationUrl(params = {}) {
		const state = params.state || randomUUID();
		const scope = this.scopes.join(' ');

		const url = new URL('https://github.com/login/oauth/authorize');
		url.searchParams.set('client_id', this.clientId);
		url.searchParams.set('redirect_uri', this.redirectUri);
		url.searchParams.set('scope', scope);
		url.searchParams.set('state', state);

		return { url: url.toString(), state };
	}

	async handleCallback(params) {
		const { code, state } = params;

		try {
			// Exchange code for access token
			const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					client_id: this.clientId,
					client_secret: this.clientSecret,
					code,
					redirect_uri: this.redirectUri
				})
			});

			if (!tokenResponse.ok) {
				logger.error(
					'AUTH',
					`GitHub OAuth token exchange failed with status ${tokenResponse.status}`
				);
				return null;
			}

			const tokenData = await tokenResponse.json();

			if (tokenData.error || tokenData.error_description) {
				logger.error('AUTH', 'GitHub OAuth token exchange failed:', {
					error: tokenData.error,
					description: tokenData.error_description
				});
				return null;
			}

			if (!tokenData.access_token) {
				logger.error('AUTH', 'GitHub OAuth token exchange succeeded but no access_token received');
				return null;
			}

			// Get user info
			const userResponse = await fetch('https://api.github.com/user', {
				headers: {
					Authorization: `token ${tokenData.access_token}`,
					'User-Agent': 'Dispatch-App',
					Accept: 'application/json'
				}
			});

			if (!userResponse.ok) {
				logger.error('AUTH', `GitHub user info request failed with status ${userResponse.status}`);
				return null;
			}

			const userData = await userResponse.json();

			if (!userData.id || !userData.login) {
				logger.error('AUTH', 'GitHub user data incomplete:', userData);
				return null;
			}

			// Get user email - this may fail if scope is insufficient
			let primaryEmail = userData.email; // Fallback to public email

			try {
				const emailResponse = await fetch('https://api.github.com/user/emails', {
					headers: {
						Authorization: `token ${tokenData.access_token}`,
						'User-Agent': 'Dispatch-App',
						Accept: 'application/json'
					}
				});

				if (emailResponse.ok) {
					const emailData = await emailResponse.json();

					// Validate that emailData is an array
					if (Array.isArray(emailData) && emailData.length > 0) {
						const primaryEmailObj = emailData.find((e) => e.primary);
						if (primaryEmailObj && primaryEmailObj.email) {
							primaryEmail = primaryEmailObj.email;
						} else if (emailData[0]?.email) {
							// Fall back to first email if no primary
							primaryEmail = emailData[0].email;
						}
					} else {
						logger.warn('AUTH', 'GitHub emails endpoint returned non-array data:', emailData);
					}
				} else {
					logger.warn(
						'AUTH',
						`GitHub emails endpoint failed with status ${emailResponse.status} - using public email`
					);
				}
			} catch (emailError) {
				logger.warn(
					'AUTH',
					'Failed to fetch GitHub user emails, using public email:',
					emailError.message
				);
			}

			return {
				id: `github:${userData.id}`,
				username: userData.login,
				displayName: userData.name || userData.login,
				email: primaryEmail,
				avatar: userData.avatar_url,
				provider: 'github',
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null
			};
		} catch (error) {
			logger.error('AUTH', 'GitHub OAuth callback failed:', error);
			return null;
		}
	}

	async authenticate(credentials) {
		// For API access with personal access token
		if (credentials.token) {
			try {
				const response = await fetch('https://api.github.com/user', {
					headers: {
						Authorization: `token ${credentials.token}`,
						'User-Agent': 'Dispatch-App'
					}
				});

				if (!response.ok) {
					return null;
				}

				const userData = await response.json();

				return {
					id: `github:${userData.id}`,
					username: userData.login,
					displayName: userData.name || userData.login,
					email: userData.email,
					avatar: userData.avatar_url,
					provider: 'github'
				};
			} catch (error) {
				logger.error('AUTH', 'GitHub token authentication failed:', error);
				return null;
			}
		}

		return null;
	}
}

/**
 * Device pairing authentication provider
 */
export class DevicePairingProvider extends AuthProvider {
	constructor(config, database) {
		super('device_pairing', config);
		this.db = database;
		this.deviceCodes = new Map(); // code -> { deviceId, expiresAt, verified }
		this.trustedDevices = new Map(); // deviceId -> { userId, name, lastUsed }
	}

	async init() {
		await this.db.init();

		// Create device pairing tables
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS device_pairs (
				device_id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				device_name TEXT NOT NULL,
				paired_at INTEGER NOT NULL,
				last_used INTEGER NOT NULL,
				is_active BOOLEAN DEFAULT 1
			)
		`);

		await this.db.run(`
			CREATE TABLE IF NOT EXISTS device_codes (
				code TEXT PRIMARY KEY,
				device_id TEXT NOT NULL,
				expires_at INTEGER NOT NULL,
				verified BOOLEAN DEFAULT 0,
				created_at INTEGER NOT NULL
			)
		`);

		// Load trusted devices
		const devices = await this.db.all('SELECT * FROM device_pairs WHERE is_active = 1');
		for (const device of devices) {
			this.trustedDevices.set(device.device_id, {
				userId: device.user_id,
				name: device.device_name,
				lastUsed: device.last_used
			});
		}

		logger.info(
			'AUTH',
			`Device pairing provider initialized with ${devices.length} trusted devices`
		);
	}

	/**
	 * Generate a device pairing code
	 * @param {string} deviceId - Unique device identifier
	 * @param {string} deviceName - Human-readable device name
	 * @returns {Promise<Object>} Pairing code and expiration
	 */
	async generatePairingCode(deviceId, deviceName) {
		// Generate 6-digit pairing code
		const code = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

		// Store in database
		await this.db.run(
			'INSERT OR REPLACE INTO device_codes (code, device_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
			[code, deviceId, expiresAt, Date.now()]
		);

		// Store in memory for quick access
		this.deviceCodes.set(code, {
			deviceId,
			deviceName,
			expiresAt,
			verified: false
		});

		logger.info('AUTH', `Generated pairing code ${code} for device ${deviceId}`);

		return {
			code,
			expiresAt: new Date(expiresAt).toISOString(),
			expiresIn: 5 * 60 // 5 minutes in seconds
		};
	}

	/**
	 * Verify and approve a pairing code
	 * @param {string} code - Pairing code
	 * @param {string} userId - User ID approving the pairing
	 * @returns {Promise<boolean>} Success status
	 */
	async approvePairing(code, userId) {
		const pairing = this.deviceCodes.get(code);

		if (!pairing) {
			logger.warn('AUTH', `Invalid pairing code: ${code}`);
			return false;
		}

		if (Date.now() > pairing.expiresAt) {
			logger.warn('AUTH', `Expired pairing code: ${code}`);
			this.deviceCodes.delete(code);
			return false;
		}

		// Mark as verified
		pairing.verified = true;
		pairing.userId = userId;

		// Update database
		await this.db.run('UPDATE device_codes SET verified = 1 WHERE code = ?', [code]);

		// Add to trusted devices
		const now = Date.now();
		await this.db.run(
			'INSERT OR REPLACE INTO device_pairs (device_id, user_id, device_name, paired_at, last_used) VALUES (?, ?, ?, ?, ?)',
			[pairing.deviceId, userId, pairing.deviceName, now, now]
		);

		this.trustedDevices.set(pairing.deviceId, {
			userId,
			name: pairing.deviceName,
			lastUsed: now
		});

		logger.info('AUTH', `Approved pairing for device ${pairing.deviceId} to user ${userId}`);
		return true;
	}

	async authenticate(credentials) {
		const { deviceId, code } = credentials;

		// Check if device is already trusted
		const trustedDevice = this.trustedDevices.get(deviceId);
		if (trustedDevice) {
			// Update last used
			trustedDevice.lastUsed = Date.now();
			await this.db.run('UPDATE device_pairs SET last_used = ? WHERE device_id = ?', [
				Date.now(),
				deviceId
			]);

			return {
				id: trustedDevice.userId,
				deviceId,
				deviceName: trustedDevice.name,
				provider: 'device_pairing',
				trusted: true
			};
		}

		// Check pairing code
		if (code) {
			const pairing = this.deviceCodes.get(code);
			if (pairing && pairing.verified && pairing.deviceId === deviceId) {
				this.deviceCodes.delete(code); // One-time use
				return {
					id: pairing.userId,
					deviceId,
					deviceName: pairing.deviceName,
					provider: 'device_pairing',
					trusted: true
				};
			}
		}

		return null;
	}

	/**
	 * Revoke device access
	 * @param {string} deviceId - Device ID to revoke
	 * @returns {Promise<boolean>} Success status
	 */
	async revokeDevice(deviceId) {
		await this.db.run('UPDATE device_pairs SET is_active = 0 WHERE device_id = ?', [deviceId]);
		this.trustedDevices.delete(deviceId);
		logger.info('AUTH', `Revoked access for device ${deviceId}`);
		return true;
	}

	/**
	 * List paired devices for a user
	 * @param {string} userId - User ID
	 * @returns {Promise<Array>} List of paired devices
	 */
	async listDevices(userId) {
		const devices = await this.db.all(
			'SELECT * FROM device_pairs WHERE user_id = ? AND is_active = 1 ORDER BY last_used DESC',
			[userId]
		);

		return devices.map((device) => ({
			deviceId: device.device_id,
			name: device.device_name,
			pairedAt: new Date(device.paired_at).toISOString(),
			lastUsed: new Date(device.last_used).toISOString()
		}));
	}
}

/**
 * Multi-authentication manager
 */
export class MultiAuthManager {
	constructor(database) {
		this.db = database;
		this.providers = new Map();
		this.sessions = new Map(); // sessionId -> { userId, provider, expiresAt }
		this.isInitialized = false;
	}

	/**
	 * Initialize the auth manager
	 */
	async init() {
		if (this.isInitialized) return;

		await this.db.init();

		// Create auth sessions table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS auth_sessions (
				session_id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				provider TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				expires_at INTEGER,
				last_used INTEGER NOT NULL,
				user_agent TEXT,
				ip_address TEXT
			)
		`);

		// Create users table for multi-auth
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS auth_users (
				user_id TEXT PRIMARY KEY,
				primary_provider TEXT NOT NULL,
				display_name TEXT,
				email TEXT,
				avatar_url TEXT,
				created_at INTEGER NOT NULL,
				last_login INTEGER,
				is_active BOOLEAN DEFAULT 1
			)
		`);

		// Load existing sessions
		const sessions = await this.db.all(
			'SELECT * FROM auth_sessions WHERE expires_at > ? OR expires_at IS NULL',
			[Date.now()]
		);
		for (const session of sessions) {
			this.sessions.set(session.session_id, {
				userId: session.user_id,
				provider: session.provider,
				expiresAt: session.expires_at,
				lastUsed: session.last_used
			});
		}

		this.isInitialized = true;
		logger.info('AUTH', `Multi-auth manager initialized with ${sessions.length} active sessions`);
	}

	/**
	 * Register an authentication provider
	 * @param {AuthProvider} provider - Auth provider instance
	 */
	async registerProvider(provider) {
		await provider.init();
		this.providers.set(provider.name, provider);
		logger.info(
			'AUTH',
			`Registered auth provider: ${provider.name} (enabled: ${provider.isEnabled})`
		);
	}

	/**
	 * Authenticate with any registered provider
	 * @param {string} providerName - Provider name
	 * @param {Object} credentials - Provider-specific credentials
	 * @param {Object} [sessionOptions] - Session options
	 * @returns {Promise<Object|null>} Authentication result
	 */
	async authenticate(providerName, credentials, sessionOptions = {}) {
		await this.init();

		const provider = this.providers.get(providerName);
		if (!provider || !provider.isEnabled) {
			logger.warn('AUTH', `Auth provider not found or disabled: ${providerName}`);
			return null;
		}

		try {
			const user = await provider.authenticate(credentials);
			if (!user) {
				logger.debug('AUTH', `Authentication failed with provider ${providerName}`);
				return null;
			}

			// Create or update user record
			await this.upsertUser(user);

			// Create session
			const session = await this.createSession(user.id, providerName, sessionOptions);

			logger.info('AUTH', `User ${user.id} authenticated via ${providerName}`);

			return {
				user,
				session,
				provider: providerName
			};
		} catch (error) {
			logger.error('AUTH', `Authentication error with provider ${providerName}:`, error);
			return null;
		}
	}

	/**
	 * Create an authentication session
	 * @param {string} userId - User ID
	 * @param {string} provider - Provider name
	 * @param {Object} options - Session options
	 * @returns {Promise<Object>} Session data
	 */
	async createSession(userId, provider, options = {}) {
		const sessionId = randomUUID();
		const now = Date.now();
		const expiresAt = options.expiresIn ? now + options.expiresIn : null;

		// Store in database
		await this.db.run(
			'INSERT INTO auth_sessions (session_id, user_id, provider, created_at, expires_at, last_used, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[sessionId, userId, provider, now, expiresAt, now, options.userAgent, options.ipAddress]
		);

		// Store in memory
		this.sessions.set(sessionId, {
			userId,
			provider,
			expiresAt,
			lastUsed: now
		});

		return {
			sessionId,
			userId,
			provider,
			createdAt: new Date(now).toISOString(),
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		};
	}

	/**
	 * Validate a session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<Object|null>} Session data if valid
	 */
	async validateSession(sessionId) {
		await this.init();

		const session = this.sessions.get(sessionId);
		if (!session) {
			return null;
		}

		// Check expiration
		if (session.expiresAt && Date.now() > session.expiresAt) {
			await this.revokeSession(sessionId);
			return null;
		}

		// Update last used
		session.lastUsed = Date.now();
		await this.db.run('UPDATE auth_sessions SET last_used = ? WHERE session_id = ?', [
			Date.now(),
			sessionId
		]);

		return session;
	}

	/**
	 * Revoke a session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<boolean>} Success status
	 */
	async revokeSession(sessionId) {
		await this.db.run('DELETE FROM auth_sessions WHERE session_id = ?', [sessionId]);
		this.sessions.delete(sessionId);
		logger.debug('AUTH', `Revoked session ${sessionId}`);
		return true;
	}

	/**
	 * Create or update user record
	 * @param {Object} user - User data
	 */
	async upsertUser(user) {
		const now = Date.now();

		await this.db.run(
			`INSERT OR REPLACE INTO auth_users
			 (user_id, primary_provider, display_name, email, avatar_url, created_at, last_login)
			 VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM auth_users WHERE user_id = ?), ?), ?)`,
			[user.id, user.provider, user.displayName, user.email, user.avatar, user.id, now, now]
		);
	}

	/**
	 * Get user by ID
	 * @param {string} userId - User ID
	 * @returns {Promise<Object|null>} User data
	 */
	async getUser(userId) {
		await this.init();
		return await this.db.get('SELECT * FROM auth_users WHERE user_id = ? AND is_active = 1', [
			userId
		]);
	}

	/**
	 * List active sessions for a user
	 * @param {string} userId - User ID
	 * @returns {Promise<Array>} List of active sessions
	 */
	async getUserSessions(userId) {
		const sessions = await this.db.all(
			'SELECT * FROM auth_sessions WHERE user_id = ? AND (expires_at > ? OR expires_at IS NULL) ORDER BY last_used DESC',
			[userId, Date.now()]
		);

		return sessions.map((s) => ({
			sessionId: s.session_id,
			provider: s.provider,
			createdAt: new Date(s.created_at).toISOString(),
			lastUsed: new Date(s.last_used).toISOString(),
			expiresAt: s.expires_at ? new Date(s.expires_at).toISOString() : null,
			userAgent: s.user_agent,
			ipAddress: s.ip_address
		}));
	}

	/**
	 * Get authentication statistics
	 * @returns {Promise<Object>} Auth stats
	 */
	async getStats() {
		await this.init();

		const userCount = await this.db.get(
			'SELECT COUNT(*) as count FROM auth_users WHERE is_active = 1'
		);
		const sessionCount = await this.db.get(
			'SELECT COUNT(*) as count FROM auth_sessions WHERE expires_at > ? OR expires_at IS NULL',
			[Date.now()]
		);

		const providerStats = await this.db.all(
			'SELECT provider, COUNT(*) as count FROM auth_sessions WHERE expires_at > ? OR expires_at IS NULL GROUP BY provider',
			[Date.now()]
		);

		return {
			totalUsers: userCount.count,
			activeSessions: sessionCount.count,
			registeredProviders: Array.from(this.providers.keys()),
			enabledProviders: Array.from(this.providers.values())
				.filter((p) => p.isEnabled)
				.map((p) => p.name),
			sessionsByProvider: providerStats.reduce((acc, stat) => {
				acc[stat.provider] = stat.count;
				return acc;
			}, {})
		};
	}

	/**
	 * Cleanup expired sessions
	 * @returns {Promise<number>} Number of sessions cleaned up
	 */
	async cleanupExpiredSessions() {
		const result = await this.db.run(
			'DELETE FROM auth_sessions WHERE expires_at IS NOT NULL AND expires_at <= ?',
			[Date.now()]
		);

		// Remove from memory
		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.expiresAt && Date.now() > session.expiresAt) {
				this.sessions.delete(sessionId);
			}
		}

		const cleanedCount = result.changes || 0;
		if (cleanedCount > 0) {
			logger.info('AUTH', `Cleaned up ${cleanedCount} expired sessions`);
		}

		return cleanedCount;
	}
}
