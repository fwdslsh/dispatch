import { createDAOs } from '../db/models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Core authentication manager with pluggable adapter pattern
 * Handles authentication, session management, and security policies
 */
export class AuthManager {
	constructor(databaseManager, sessionManager = null) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		this.sessionManager = sessionManager;
		this.adapters = new Map();
		this.rateLimiter = new Map(); // Simple rate limiter

		// Load session manager if not provided
		if (!this.sessionManager) {
			import('./SessionManager.js').then(({ SessionManager }) => {
				this.sessionManager = new SessionManager(databaseManager);
			});
		}

		// Register default local adapter
		this.registerDefaultAdapters();
	}

	/**
	 * Register default authentication adapters
	 */
	async registerDefaultAdapters() {
		try {
			// Register local authentication adapter
			const { LocalAuthAdapter } = await import('./adapters/LocalAuthAdapter.js');
			const localAdapter = new LocalAuthAdapter(this.db, this.daos);
			this.registerAdapter('local', localAdapter);

			// Register WebAuthn adapter
			const { WebAuthnAdapter } = await import('./adapters/WebAuthnAdapter.js');
			const webauthnAdapter = new WebAuthnAdapter(this.db, this);
			this.registerAdapter('webauthn', webauthnAdapter);

			// Register OAuth adapter
			const { OAuthAdapter } = await import('./adapters/OAuthAdapter.js');
			const oauthAdapter = new OAuthAdapter(this.db, this);
			this.registerAdapter('oauth', oauthAdapter);
		} catch (error) {
			logger.error('AUTH', `Failed to register default adapters: ${error.message}`);
		}
	}

	/**
	 * Register an authentication adapter
	 */
	registerAdapter(name, adapter) {
		if (!adapter || typeof adapter !== 'object') {
			throw new Error('Adapter must be an object');
		}

		if (typeof adapter.authenticate !== 'function') {
			throw new Error('Adapter must have an authenticate method');
		}

		this.adapters.set(name, adapter);
		logger.info('AUTH', `Registered authentication adapter: ${name}`);
	}

	/**
	 * Get list of available authentication adapters
	 */
	getAvailableAdapters() {
		return Array.from(this.adapters.keys());
	}

	/**
	 * Get authentication configuration from database
	 */
	async getAuthConfig() {
		try {
			return await this.db.getSettingsByCategory('auth');
		} catch (error) {
			logger.error('AUTH', `Failed to get auth config: ${error.message}`);
			// Return default config
			return {
				enabled_methods: ['local'],
				default_method: 'local',
				session_timeout_hours: 24,
				max_devices_per_user: 10,
				webauthn_enabled: false,
				oauth_providers: {
					google: { enabled: false },
					github: { enabled: false }
				}
			};
		}
	}

	/**
	 * Update authentication configuration
	 */
	async updateAuthConfig(config) {
		try {
			// Validate config
			const validFields = [
				'enabled_methods',
				'default_method',
				'session_timeout_hours',
				'max_devices_per_user',
				'webauthn_enabled',
				'oauth_providers'
			];

			const updates = {};
			Object.keys(config).forEach((key) => {
				if (validFields.includes(key)) {
					updates[key] = config[key];
				}
			});

			// Get current config and merge with updates
			const currentConfig = await this.getAuthConfig();
			const newConfig = { ...currentConfig, ...updates };

			await this.db.setSettingsForCategory('auth', newConfig, 'Authentication configuration');
			logger.info('AUTH', 'Updated authentication configuration');

			return newConfig;
		} catch (error) {
			logger.error('AUTH', `Failed to update auth config: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Main authentication method - routes to appropriate adapter
	 */
	async authenticate(method, credentials) {
		try {
			logger.info('AUTH', `Authenticate called with method: ${method}, credentials: ${JSON.stringify(credentials)}`);
			// Check if authentication method is enabled
			const config = await this.getAuthConfig();
			logger.info('AUTH', `Auth config: ${JSON.stringify(config)}`);
			if (!config.enabled_methods.includes(method)) {
				return {
					success: false,
					error: `Authentication method "${method}" not enabled`
				};
			}

			// Check rate limiting
			const rateLimitResult = await this.checkRateLimit(
				credentials.ipAddress,
				credentials.username
			);
			if (!rateLimitResult.allowed) {
				await this.logFailedAttempt(
					null,
					credentials.ipAddress,
					credentials.userAgent,
					'rate_limited',
					credentials.username
				);
				return {
					success: false,
					error: 'Too many failed attempts. You are temporarily rate limited.'
				};
			}

			// Get adapter
			const adapter = this.adapters.get(method);
			if (!adapter) {
				throw new Error(`Authentication adapter "${method}" not found`);
			}

			// Authenticate with adapter
			const authResult = await adapter.authenticate(credentials);

			if (authResult.success) {
				// Create or update device
				const device = await this.handleDeviceManagement(
					authResult.user.id,
					credentials.deviceName || 'Unknown Device',
					credentials.deviceFingerprint,
					credentials.ipAddress,
					credentials.userAgent
				);

				// Create session
				const session = await this.sessionManager.createSession({
					userId: authResult.user.id,
					deviceId: device.id,
					ipAddress: credentials.ipAddress,
					userAgent: credentials.userAgent
				});

				// Log successful authentication
				await this.daos.authEvents.logLogin(
					authResult.user.id,
					device.id,
					credentials.ipAddress,
					credentials.userAgent,
					method
				);

				// Reset rate limit counter on success
				this.resetRateLimit(credentials.ipAddress, credentials.username);

				return {
					success: true,
					user: authResult.user,
					device: device,
					sessionToken: session.sessionToken,
					expiresAt: session.expiresAt
				};
			} else {
				// Log failed attempt
				await this.logFailedAttempt(
					authResult.userId,
					credentials.ipAddress,
					credentials.userAgent,
					authResult.reason || 'invalid_credentials',
					credentials.username
				);

				// Update rate limiter
				this.updateRateLimit(credentials.ipAddress, credentials.username);

				return {
					success: false,
					error: authResult.error || 'Authentication failed'
				};
			}
		} catch (error) {
			logger.error('AUTH', `Authentication error: ${error.message}`);
			return {
				success: false,
				error: 'Internal authentication error'
			};
		}
	}

	/**
	 * Validate session token and return user context
	 */
	async validateSession(token) {
		try {
			if (!this.sessionManager) {
				throw new Error('Session manager not initialized');
			}

			const validation = await this.sessionManager.validateToken(token);
			if (!validation.valid) {
				return { valid: false, error: validation.error };
			}

			// Get full session with user and device info
			const session = await this.sessionManager.getSessionWithDetails(validation.payload.sessionId);
			if (!session) {
				return { valid: false, error: 'Session not found' };
			}

			// Update session activity
			await this.sessionManager.updateActivity(session.id);

			return {
				valid: true,
				user: session.user,
				device: session.device,
				session: {
					id: session.id,
					createdAt: session.createdAt,
					expiresAt: session.expiresAt,
					lastActivityAt: session.lastActivityAt
				}
			};
		} catch (error) {
			logger.error('AUTH', `Session validation error: ${error.message}`);
			return { valid: false, error: 'Session validation failed' };
		}
	}

	/**
	 * Logout user and invalidate session
	 */
	async logout(token) {
		try {
			const validation = await this.sessionManager.validateToken(token);
			if (!validation.valid) {
				return { success: false, error: 'Invalid session token' };
			}

			const session = await this.sessionManager.getSessionById(validation.payload.sessionId);
			if (session) {
				// Log logout event
				await this.daos.authEvents.logLogout(
					session.userId,
					session.deviceId,
					session.ipAddress,
					session.userAgent
				);

				// Revoke session
				await this.sessionManager.revokeSession(session.id);
			}

			return { success: true };
		} catch (error) {
			logger.error('AUTH', `Logout error: ${error.message}`);
			return { success: false, error: 'Logout failed' };
		}
	}

	/**
	 * Revoke all sessions for a device
	 */
	async revokeDeviceSessions(deviceId) {
		try {
			await this.sessionManager.revokeDeviceSessions(deviceId);
			logger.info('AUTH', `Revoked all sessions for device: ${deviceId}`);
			return { success: true };
		} catch (error) {
			logger.error('AUTH', `Failed to revoke device sessions: ${error.message}`);
			return { success: false, error: 'Failed to revoke device sessions' };
		}
	}

	/**
	 * Handle device creation or updates during authentication
	 */
	async handleDeviceManagement(userId, deviceName, deviceFingerprint, ipAddress, userAgent) {
		try {
			// Generate fingerprint if not provided
			if (!deviceFingerprint) {
				deviceFingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);
			}

			const device = await this.daos.userDevices.createOrUpdate({
				userId,
				deviceName,
				deviceFingerprint,
				ipAddress,
				userAgent,
				isTrusted: false
			});

			return device;
		} catch (error) {
			logger.error('AUTH', `Device management error: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Generate device fingerprint from available data
	 */
	generateDeviceFingerprint(userAgent, ipAddress) {
		const data = `${userAgent || ''}|${ipAddress || ''}|${Date.now()}`;
		// Simple hash function - in production, use crypto.createHash
		let hash = 0;
		for (let i = 0; i < data.length; i++) {
			const char = data.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return `fp_${Math.abs(hash).toString(36)}`;
	}

	/**
	 * Simple rate limiting implementation
	 */
	async checkRateLimit(ipAddress, username = null) {
		const key = `${ipAddress}:${username || 'anonymous'}`;
		const now = Date.now();
		const windowMs = 15 * 60 * 1000; // 15 minutes
		const maxAttempts = 10;

		// Check failed login attempts from database
		const attempts = await this.daos.authEvents.getFailedLoginAttempts(ipAddress, 15);

		if (attempts >= maxAttempts) {
			return { allowed: false, resetTime: now + windowMs };
		}

		return { allowed: true };
	}

	/**
	 * Update rate limit counter
	 */
	updateRateLimit(ipAddress, username = null) {
		const key = `${ipAddress}:${username || 'anonymous'}`;
		const now = Date.now();

		if (!this.rateLimiter.has(key)) {
			this.rateLimiter.set(key, { count: 0, firstAttempt: now });
		}

		const data = this.rateLimiter.get(key);
		data.count++;
		data.lastAttempt = now;
	}

	/**
	 * Reset rate limit counter on successful auth
	 */
	resetRateLimit(ipAddress, username = null) {
		const key = `${ipAddress}:${username || 'anonymous'}`;
		this.rateLimiter.delete(key);
	}

	/**
	 * Log failed authentication attempt
	 */
	async logFailedAttempt(userId, ipAddress, userAgent, reason, username = null) {
		try {
			await this.daos.authEvents.logFailedLogin(userId, ipAddress, userAgent, reason, username);
		} catch (error) {
			logger.error('AUTH', `Failed to log failed attempt: ${error.message}`);
		}
	}

	/**
	 * Get user sessions for admin interface
	 */
	async getUserSessions(userId, includeExpired = false) {
		try {
			return await this.sessionManager.getUserSessions(userId, includeExpired);
		} catch (error) {
			logger.error('AUTH', `Failed to get user sessions: ${error.message}`);
			return [];
		}
	}

	/**
	 * Get authentication statistics for admin dashboard
	 */
	async getAuthStats() {
		try {
			const [sessionStats, eventStats, deviceStats] = await Promise.all([
				this.sessionManager.getSessionStats(),
				this.daos.authEvents.getStats(30), // Last 30 days
				this.daos.userDevices.getStats()
			]);

			return {
				sessions: sessionStats,
				events: eventStats,
				devices: deviceStats,
				adapters: this.getAvailableAdapters()
			};
		} catch (error) {
			logger.error('AUTH', `Failed to get auth stats: ${error.message}`);
			return null;
		}
	}

	/**
	 * Validate WebAuthn compatibility for a given URL
	 * @param {string} url - The URL to validate
	 * @returns {object} Validation result with compatibility status
	 */
	async validateWebAuthnCompatibility(url) {
		try {
			const urlObj = new URL(url);
			const hostname = urlObj.hostname;

			// WebAuthn requires HTTPS (except localhost)
			if (urlObj.protocol !== 'https:' && hostname !== 'localhost') {
				return {
					compatible: false,
					reason: 'WebAuthn requires HTTPS connection',
					recommendation: 'Use HTTPS or configure certificates'
				};
			}

			// Check for tunnel domains which are unstable
			const tunnelDomains = ['loca.lt', 'tunnel.site', 'localtunnel.me'];
			const isTunnel = tunnelDomains.some((domain) => hostname.includes(domain));

			if (isTunnel) {
				return {
					compatible: false,
					reason: 'Tunnel URLs change on restart - WebAuthn credentials would be lost',
					recommendation: 'Use a custom domain with stable hostname for WebAuthn'
				};
			}

			// Check if we have existing WebAuthn credentials that would be invalidated
			const existingCredentials = await this.checkExistingWebAuthnCredentials();
			if (existingCredentials.count > 0) {
				const currentRpId = await this.getCurrentRpId();
				if (currentRpId && currentRpId !== hostname) {
					return {
						compatible: false,
						reason: `Hostname change detected. ${existingCredentials.count} existing WebAuthn credentials would be invalidated`,
						recommendation: 'Users will need to re-register their security keys',
						affectedUsers: existingCredentials.users
					};
				}
			}

			// All checks passed
			return {
				compatible: true,
				reason: 'WebAuthn is available',
				rpId: hostname
			};
		} catch (error) {
			logger.error('AUTH', `WebAuthn validation error: ${error.message}`);
			return {
				compatible: false,
				reason: 'Failed to validate WebAuthn compatibility',
				error: error.message
			};
		}
	}

	/**
	 * Check for existing WebAuthn credentials
	 * @returns {object} Count and affected users
	 */
	async checkExistingWebAuthnCredentials() {
		try {
			const credentials = await this.db.all(
				'SELECT DISTINCT user_id FROM webauthn_credentials WHERE active = 1'
			);

			return {
				count: credentials.length,
				users: credentials.map((c) => c.user_id)
			};
		} catch (error) {
			logger.error('AUTH', `Failed to check WebAuthn credentials: ${error.message}`);
			return { count: 0, users: [] };
		}
	}

	/**
	 * Get current rpID from settings
	 * @returns {string|null} Current rpID or null
	 */
	async getCurrentRpId() {
		try {
			const settings = await this.db.getSettingsByCategory('auth');
			return settings.webauthn_rpid || null;
		} catch (error) {
			logger.error('AUTH', `Failed to get current rpID: ${error.message}`);
			return null;
		}
	}

	/**
	 * Update WebAuthn rpID when URL changes
	 * @param {string} newRpId - New rpID (hostname)
	 */
	async updateWebAuthnRpId(newRpId) {
		try {
			const settings = await this.db.getSettingsByCategory('auth');
			await this.db.setSettingsForCategory(
				'auth',
				{
					...settings,
					webauthn_rpid: newRpId,
					webauthn_rpid_updated_at: new Date().toISOString()
				},
				'WebAuthn rpID update'
			);

			logger.info('AUTH', `Updated WebAuthn rpID to: ${newRpId}`);
		} catch (error) {
			logger.error('AUTH', `Failed to update WebAuthn rpID: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Cleanup expired sessions and old data
	 */
	async cleanup() {
		try {
			if (this.sessionManager) {
				const cleaned = await this.sessionManager.cleanupExpiredSessions();
				logger.info('AUTH', `Cleaned up ${cleaned} expired sessions`);
			}
		} catch (error) {
			logger.error('AUTH', `Cleanup error: ${error.message}`);
		}
	}
}
