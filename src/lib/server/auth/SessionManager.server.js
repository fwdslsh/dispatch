import { randomUUID } from 'node:crypto';
import { logger } from '../shared/utils/logger.js';

/**
 * Session Manager - Handles browser session lifecycle with cookie-based authentication
 *
 * Features:
 * - 30-day session expiration with rolling refresh window (24 hours before expiry)
 * - Automatic cleanup of expired sessions (hourly)
 * - Session persistence across server restarts (SQLite storage)
 * - Multi-tab support (unlimited concurrent sessions)
 * - Provider tracking (api_key, oauth_github, oauth_google)
 */
export class SessionManager {
	constructor(database) {
		this.db = database;

		// Session duration constants
		this.SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
		this.REFRESH_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
		this.CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

		// Set up periodic cleanup timer
		this.cleanupTimer = setInterval(() => {
			this.cleanupExpiredSessions().catch((err) => {
				logger.error('SESSION', 'Failed to run periodic session cleanup:', err);
			});
		}, this.CLEANUP_INTERVAL);

		logger.info('SESSION', 'SessionManager initialized with automatic cleanup (every 1 hour)');
	}

	/**
	 * Create a new browser session
	 * @param {string} userId - User ID (default: 'default')
	 * @param {string} provider - Authentication provider ('api_key', 'oauth_github', 'oauth_google')
	 * @param {Object} [_sessionInfo] - Additional session metadata (e.g., {apiKeyId, label}) - unused but preserved for future use
	 * @returns {Promise<Object>} Object with {sessionId, expiresAt}
	 */
	async createSession(userId, provider, _sessionInfo = {}) {
		// Validate provider
		const validProviders = ['api_key', 'oauth_github', 'oauth_google'];
		if (!validProviders.includes(provider)) {
			throw new Error(
				`Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`
			);
		}

		// Generate cryptographically secure session ID (UUID v4)
		const sessionId = randomUUID();
		const now = Date.now();
		const expiresAt = now + this.SESSION_DURATION;

		// Store session in database
		await this.db.run(
			`INSERT INTO auth_sessions (id, user_id, provider, expires_at, created_at, last_active_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[sessionId, userId, provider, expiresAt, now, now]
		);

		logger.info(
			'SESSION',
			`Created session ${sessionId} for user ${userId} (provider: ${provider}, expires: ${new Date(expiresAt).toISOString()})`
		);

		return {
			sessionId,
			expiresAt,
			userId,
			provider
		};
	}

	/**
	 * Validate a session and determine if it needs refresh
	 * @param {string} sessionId - Session ID from cookie
	 * @returns {Promise<Object|null>} Object with {session, user, needsRefresh} or null if invalid
	 */
	async validateSession(sessionId) {
		if (!sessionId || typeof sessionId !== 'string') {
			return null;
		}

		// Fetch session from database with user info
		const session = await this.db.get(
			`SELECT s.*, u.email, u.name
			 FROM auth_sessions s
			 LEFT JOIN auth_users u ON s.user_id = u.user_id
			 WHERE s.id = ?`,
			[sessionId]
		);

		if (!session) {
			logger.debug('SESSION', `Session not found: ${sessionId}`);
			return null;
		}

		const now = Date.now();

		// Check if session has expired
		if (now > session.expires_at) {
			logger.info(
				'SESSION',
				`Session expired: ${sessionId} (expired at: ${new Date(session.expires_at).toISOString()})`
			);
			// Clean up expired session
			await this.invalidateSession(sessionId);
			return null;
		}

		// Update last_active_at timestamp
		await this.db.run(`UPDATE auth_sessions SET last_active_at = ? WHERE id = ?`, [now, sessionId]);

		// Check if session needs refresh (within 24 hours of expiration)
		const timeUntilExpiry = session.expires_at - now;
		const needsRefresh = timeUntilExpiry < this.REFRESH_WINDOW;

		if (needsRefresh) {
			logger.debug(
				'SESSION',
				`Session ${sessionId} is within refresh window (${Math.round(timeUntilExpiry / 1000 / 60 / 60)}h remaining)`
			);
		}

		return {
			session: {
				id: session.id,
				userId: session.user_id,
				provider: session.provider,
				expiresAt: session.expires_at,
				createdAt: session.created_at,
				lastActiveAt: now
			},
			user: {
				userId: session.user_id,
				email: session.email || null,
				name: session.name || null
			},
			needsRefresh
		};
	}

	/**
	 * Refresh a session by extending its expiration
	 * @param {string} sessionId - Session ID to refresh
	 * @returns {Promise<number>} New expiration timestamp
	 */
	async refreshSession(sessionId) {
		const now = Date.now();
		const newExpiresAt = now + this.SESSION_DURATION;

		const result = await this.db.run(
			`UPDATE auth_sessions
			 SET expires_at = ?, last_active_at = ?
			 WHERE id = ?`,
			[newExpiresAt, now, sessionId]
		);

		if (result.changes > 0) {
			logger.info(
				'SESSION',
				`Refreshed session ${sessionId} (new expiry: ${new Date(newExpiresAt).toISOString()})`
			);
			return newExpiresAt;
		}

		logger.warn('SESSION', `Failed to refresh session ${sessionId}: session not found`);
		return null;
	}

	/**
	 * Invalidate and delete a session
	 * @param {string} sessionId - Session ID to invalidate
	 * @returns {Promise<boolean>} True if session was deleted, false if not found
	 */
	async invalidateSession(sessionId) {
		const result = await this.db.run(`DELETE FROM auth_sessions WHERE id = ?`, [sessionId]);

		if (result.changes > 0) {
			logger.info('SESSION', `Invalidated session ${sessionId}`);
			return true;
		}

		logger.debug('SESSION', `No session to invalidate: ${sessionId}`);
		return false;
	}

	/**
	 * Clean up all expired sessions
	 * @returns {Promise<number>} Number of sessions deleted
	 */
	async cleanupExpiredSessions() {
		const now = Date.now();

		const result = await this.db.run(`DELETE FROM auth_sessions WHERE expires_at < ?`, [now]);

		if (result.changes > 0) {
			logger.info('SESSION', `Cleaned up ${result.changes} expired session(s)`);
		} else {
			logger.debug('SESSION', 'No expired sessions to clean up');
		}

		return result.changes || 0;
	}

	/**
	 * Get all active sessions for a user
	 * @param {string} userId - User ID
	 * @returns {Promise<Array>} Array of session objects
	 */
	async getUserSessions(userId) {
		const sessions = await this.db.all(
			`SELECT id, provider, created_at, last_active_at, expires_at
			 FROM auth_sessions
			 WHERE user_id = ?
			 ORDER BY created_at DESC`,
			[userId]
		);

		return sessions.map((s) => ({
			id: s.id,
			provider: s.provider,
			createdAt: s.created_at,
			lastActiveAt: s.last_active_at,
			expiresAt: s.expires_at
		}));
	}

	/**
	 * Clean up timer on shutdown
	 */
	destroy() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			logger.info('SESSION', 'SessionManager cleanup timer stopped');
		}
	}
}
