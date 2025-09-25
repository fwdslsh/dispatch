import { createDAOs } from '../db/models/index.js';
import { logger } from '../utils/logger.js';
import { createHash, randomBytes } from 'crypto';

/**
 * JWT-based session management with database persistence
 * Handles token generation, validation, and session lifecycle
 */
export class SessionManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		this.jwtSecret = this.generateJWTSecret();
	}

	/**
	 * Generate a secure JWT secret
	 */
	generateJWTSecret() {
		// In production, this should be stored securely and persist across restarts
		return randomBytes(64).toString('hex');
	}

	/**
	 * Create a new session with JWT token
	 */
	async createSession(sessionData) {
		try {
			const {
				userId,
				deviceId = null,
				ipAddress = null,
				userAgent = null,
				expiresAt = null
			} = sessionData;

			// Get session timeout from config
			const authConfig = await this.db.getSettingsByCategory('auth');
			const timeoutHours = authConfig.session_timeout_hours || 24;

			const now = Date.now();
			const sessionExpiresAt = expiresAt || new Date(now + (timeoutHours * 60 * 60 * 1000));

			// Create session in database first
			const session = await this.daos.authSessions.create({
				userId,
				deviceId,
				sessionToken: 'temp', // Temporary token, will be replaced
				expiresAt: sessionExpiresAt.getTime(),
				ipAddress,
				userAgent,
				isActive: true
			});

			// Generate JWT token with session ID
			const jwtPayload = {
				sessionId: session.id,
				userId: userId,
				deviceId: deviceId,
				iat: Math.floor(now / 1000),
				exp: Math.floor(sessionExpiresAt.getTime() / 1000)
			};

			const jwtToken = this.generateJWT(jwtPayload);

			// Update session with real JWT token
			await this.daos.authSessions.updateByToken('temp', {
				session_token: jwtToken
			});

			return {
				...session,
				sessionToken: jwtToken,
				expiresAt: sessionExpiresAt
			};

		} catch (error) {
			logger.error('SESSION', `Failed to create session: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Generate JWT token
	 */
	generateJWT(payload) {
		// Simple JWT implementation without external dependencies
		const header = {
			alg: 'HS256',
			typ: 'JWT'
		};

		const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
		const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

		const signature = this.generateSignature(`${encodedHeader}.${encodedPayload}`);

		return `${encodedHeader}.${encodedPayload}.${signature}`;
	}

	/**
	 * Validate JWT token
	 */
	async validateToken(token) {
		try {
			if (!token || typeof token !== 'string') {
				return { valid: false, error: 'Invalid token format' };
			}

			const parts = token.split('.');
			if (parts.length !== 3) {
				return { valid: false, error: 'Invalid token structure' };
			}

			const [header, payload, signature] = parts;

			// Verify signature
			const expectedSignature = this.generateSignature(`${header}.${payload}`);
			if (signature !== expectedSignature) {
				return { valid: false, error: 'Invalid token signature' };
			}

			// Decode payload
			const decodedPayload = JSON.parse(this.base64UrlDecode(payload));

			// Check expiration
			const now = Math.floor(Date.now() / 1000);
			if (decodedPayload.exp && decodedPayload.exp < now) {
				return { valid: false, error: 'Token has expired' };
			}

			// Verify session exists and is active in database
			const session = await this.daos.authSessions.getById(decodedPayload.sessionId);
			if (!session || !session.isActive) {
				return { valid: false, error: 'Session has been revoked' };
			}

			// Check session expiration in database
			if (session.expiresAt < new Date()) {
				return { valid: false, error: 'Session has expired' };
			}

			return {
				valid: true,
				payload: decodedPayload,
				session: session
			};

		} catch (error) {
			logger.error('SESSION', `Token validation error: ${error.message}`);
			return { valid: false, error: 'Invalid token' };
		}
	}

	/**
	 * Get session by token
	 */
	async getSessionByToken(token) {
		try {
			const validation = await this.validateToken(token);
			if (!validation.valid) {
				return null;
			}

			return validation.session;
		} catch (error) {
			logger.error('SESSION', `Failed to get session by token: ${error.message}`);
			return null;
		}
	}

	/**
	 * Get session by ID
	 */
	async getSessionById(sessionId) {
		try {
			return await this.daos.authSessions.getById(sessionId);
		} catch (error) {
			logger.error('SESSION', `Failed to get session by ID: ${error.message}`);
			return null;
		}
	}

	/**
	 * Get session with user and device details
	 */
	async getSessionWithDetails(sessionId) {
		try {
			const session = await this.daos.authSessions.getById(sessionId);
			if (!session) {
				return null;
			}

			// Get user and device info
			const [user, device] = await Promise.all([
				this.daos.users.getById(session.userId),
				session.deviceId ? this.daos.userDevices.getById(session.deviceId) : null
			]);

			return {
				...session,
				user: user ? {
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					email: user.email,
					isAdmin: user.isAdmin
				} : null,
				device: device ? {
					id: device.id,
					deviceName: device.deviceName,
					deviceFingerprint: device.deviceFingerprint,
					isTrusted: device.isTrusted
				} : null
			};

		} catch (error) {
			logger.error('SESSION', `Failed to get session details: ${error.message}`);
			return null;
		}
	}

	/**
	 * Update session activity
	 */
	async updateActivity(sessionId, ipAddress = null, userAgent = null) {
		try {
			await this.daos.authSessions.updateActivity(sessionId, ipAddress, userAgent);
		} catch (error) {
			logger.error('SESSION', `Failed to update activity: ${error.message}`);
		}
	}

	/**
	 * Refresh session token (generate new JWT)
	 */
	async refreshSession(sessionId) {
		try {
			const session = await this.daos.authSessions.getById(sessionId);
			if (!session || !session.isActive) {
				throw new Error('Session not found or inactive');
			}

			// Generate new JWT token
			const jwtPayload = {
				sessionId: session.id,
				userId: session.userId,
				deviceId: session.deviceId,
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(session.expiresAt.getTime() / 1000)
			};

			const newToken = this.generateJWT(jwtPayload);

			// Update session token in database
			await this.daos.authSessions.updateByToken(session.sessionToken, {
				session_token: newToken,
				last_activity_at: Date.now()
			});

			return {
				...session,
				sessionToken: newToken
			};

		} catch (error) {
			logger.error('SESSION', `Failed to refresh session: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Revoke a session
	 */
	async revokeSession(sessionId) {
		try {
			await this.daos.authSessions.revoke(sessionId);
			logger.info('SESSION', `Revoked session: ${sessionId}`);
		} catch (error) {
			logger.error('SESSION', `Failed to revoke session: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Revoke all sessions for a user except specified session
	 */
	async revokeAllUserSessions(userId, exceptSessionId = null) {
		try {
			await this.daos.authSessions.revokeAllForUser(userId, exceptSessionId);
			logger.info('SESSION', `Revoked all sessions for user: ${userId}`);
		} catch (error) {
			logger.error('SESSION', `Failed to revoke user sessions: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Revoke all sessions for a device
	 */
	async revokeDeviceSessions(deviceId) {
		try {
			await this.daos.authSessions.revokeAllForDevice(deviceId);
			logger.info('SESSION', `Revoked all sessions for device: ${deviceId}`);
		} catch (error) {
			logger.error('SESSION', `Failed to revoke device sessions: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get all sessions for a user
	 */
	async getUserSessions(userId, includeExpired = false) {
		try {
			return await this.daos.authSessions.getByUserId(userId, includeExpired);
		} catch (error) {
			logger.error('SESSION', `Failed to get user sessions: ${error.message}`);
			return [];
		}
	}

	/**
	 * Clean up expired sessions
	 */
	async cleanupExpiredSessions() {
		try {
			return await this.daos.authSessions.cleanupExpired();
		} catch (error) {
			logger.error('SESSION', `Failed to cleanup expired sessions: ${error.message}`);
			return 0;
		}
	}

	/**
	 * Get session statistics
	 */
	async getSessionStats() {
		try {
			return await this.daos.authSessions.getStats();
		} catch (error) {
			logger.error('SESSION', `Failed to get session stats: ${error.message}`);
			return { active: 0, expired: 0, recentActivity: 0 };
		}
	}

	/**
	 * Validate device policy (max devices per user, etc.)
	 */
	async validateDevicePolicy(userId, deviceId) {
		try {
			const authConfig = await this.db.getSettingsByCategory('auth');
			const maxDevices = authConfig.max_devices_per_user || 10;

			const userDevices = await this.daos.userDevices.getByUserId(userId);

			if (userDevices.length >= maxDevices) {
				// Check if current device is already registered
				const existingDevice = userDevices.find(d => d.id === deviceId);
				if (!existingDevice) {
					return {
						allowed: false,
						reason: 'Maximum number of devices exceeded'
					};
				}
			}

			return { allowed: true };

		} catch (error) {
			logger.error('SESSION', `Device policy validation error: ${error.message}`);
			return { allowed: false, reason: 'Policy validation failed' };
		}
	}

	/**
	 * Base64 URL encode
	 */
	base64UrlEncode(str) {
		return Buffer.from(str)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	/**
	 * Base64 URL decode
	 */
	base64UrlDecode(str) {
		// Add padding if needed
		str += '='.repeat((4 - str.length % 4) % 4);
		// Convert URL-safe characters back
		str = str.replace(/-/g, '+').replace(/_/g, '/');
		return Buffer.from(str, 'base64').toString();
	}

	/**
	 * Generate signature for JWT
	 */
	generateSignature(data) {
		const hmac = createHash('sha256');
		hmac.update(data + this.jwtSecret);
		return this.base64UrlEncode(hmac.digest('hex'));
	}
}