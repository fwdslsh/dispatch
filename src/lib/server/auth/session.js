/**
 * 30-Day Rolling Authentication Session Management
 *
 * Implements a rolling session system where authentication persists for 30 days
 * and automatically extends on each browser session start.
 * This follows constitutional requirement for persistent authentication.
 */

import { randomUUID, createHash } from 'node:crypto';
import { DatabaseManager } from '../shared/db/DatabaseManager.js';
import { logger } from '../shared/utils/logger.js';

/**
 * Session duration: 30 days in milliseconds
 * Rolling window that resets with each browser session
 */
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Session cleanup interval: 6 hours
 */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Authentication Session Manager
 * Manages rolling 30-day authentication sessions
 */
export class AuthSessionManager {
	constructor(dbManager = null) {
		this.dbManager = dbManager || DatabaseManager.getInstance();
		this.cleanupTimer = null;
		this.initialized = false;
	}

	/**
	 * Initialize the session manager
	 * Creates necessary database tables and starts cleanup timer
	 */
	async init() {
		if (this.initialized) return;

		try {
			await this.createSessionTable();
			this.startCleanupTimer();
			this.initialized = true;
			logger.info('AuthSessionManager initialized');
		} catch (error) {
			logger.error('Failed to initialize AuthSessionManager:', error);
			throw error;
		}
	}

	/**
	 * Create auth_sessions table if it doesn't exist
	 */
	async createSessionTable() {
		const query = `
			CREATE TABLE IF NOT EXISTS auth_sessions (
				id TEXT PRIMARY KEY,
				terminal_key_hash TEXT NOT NULL,
				user_id TEXT,
				created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				last_activity TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				expires_at TEXT NOT NULL,
				browser_fingerprint TEXT,
				ip_address TEXT,
				user_agent TEXT,
				is_active INTEGER NOT NULL DEFAULT 1
			);

			CREATE INDEX IF NOT EXISTS idx_auth_sessions_terminal_key
			ON auth_sessions(terminal_key_hash);

			CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
			ON auth_sessions(expires_at);

			CREATE INDEX IF NOT EXISTS idx_auth_sessions_active
			ON auth_sessions(is_active);
		`;

		await this.dbManager.exec(query);
		logger.debug('auth_sessions table created/verified');
	}

	/**
	 * Create a new authentication session
	 * @param {string} terminalKey - The terminal authentication key
	 * @param {Object} sessionInfo - Additional session information
	 * @returns {Object} Session details
	 */
	async createSession(terminalKey, sessionInfo = {}) {
		const sessionId = randomUUID();
		const terminalKeyHash = this.hashTerminalKey(terminalKey);
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

		const sessionData = {
			id: sessionId,
			terminal_key_hash: terminalKeyHash,
			user_id: sessionInfo.userId || null,
			created_at: now,
			last_activity: now,
			expires_at: expiresAt,
			browser_fingerprint: sessionInfo.browserFingerprint || null,
			ip_address: sessionInfo.ipAddress || null,
			user_agent: sessionInfo.userAgent || null,
			is_active: 1
		};

		try {
			await this.dbManager.run(
				`
				INSERT INTO auth_sessions (
					id, terminal_key_hash, user_id, created_at, last_activity,
					expires_at, browser_fingerprint, ip_address, user_agent, is_active
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				[
					sessionData.id,
					sessionData.terminal_key_hash,
					sessionData.user_id,
					sessionData.created_at,
					sessionData.last_activity,
					sessionData.expires_at,
					sessionData.browser_fingerprint,
					sessionData.ip_address,
					sessionData.user_agent,
					sessionData.is_active
				]
			);

			logger.info(`Created auth session: ${sessionId}`);

			return {
				sessionId,
				expiresAt,
				createdAt: now
			};
		} catch (error) {
			logger.error('Failed to create auth session:', error);
			throw new Error('Failed to create authentication session');
		}
	}

	/**
	 * Validate and extend an existing session
	 * @param {string} sessionId - Session ID to validate
	 * @param {string} terminalKey - Terminal key for validation
	 * @param {Object} updateInfo - Optional session update information
	 * @returns {Object|null} Session info if valid, null if invalid
	 */
	async validateAndExtendSession(sessionId, terminalKey, updateInfo = {}) {
		const terminalKeyHash = this.hashTerminalKey(terminalKey);
		const now = new Date().toISOString();
		const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

		try {
			// Get current session
			const session = await this.dbManager.get(
				`
				SELECT * FROM auth_sessions
				WHERE id = ? AND terminal_key_hash = ? AND is_active = 1
			`,
				[sessionId, terminalKeyHash]
			);

			if (!session) {
				logger.debug(`Session validation failed: ${sessionId}`);
				return null;
			}

			// Check if session has expired
			if (new Date(session.expires_at) < new Date()) {
				logger.debug(`Session expired: ${sessionId}`);
				await this.deactivateSession(sessionId);
				return null;
			}

			// Extend the session (rolling 30-day window)
			await this.dbManager.run(
				`
				UPDATE auth_sessions
				SET last_activity = ?, expires_at = ?,
					ip_address = COALESCE(?, ip_address),
					user_agent = COALESCE(?, user_agent)
				WHERE id = ?
			`,
				[now, newExpiresAt, updateInfo.ipAddress, updateInfo.userAgent, sessionId]
			);

			logger.debug(`Extended auth session: ${sessionId}`);

			return {
				sessionId,
				userId: session.user_id,
				expiresAt: newExpiresAt,
				lastActivity: now,
				isActive: true
			};
		} catch (error) {
			logger.error('Failed to validate/extend session:', error);
			return null;
		}
	}

	/**
	 * Get session information
	 * @param {string} sessionId - Session ID
	 * @returns {Object|null} Session information
	 */
	async getSession(sessionId) {
		try {
			const session = await this.dbManager.get(
				`
				SELECT * FROM auth_sessions
				WHERE id = ? AND is_active = 1
			`,
				[sessionId]
			);

			if (!session) {
				return null;
			}

			// Check if session has expired
			if (new Date(session.expires_at) < new Date()) {
				await this.deactivateSession(sessionId);
				return null;
			}

			return {
				sessionId: session.id,
				userId: session.user_id,
				createdAt: session.created_at,
				lastActivity: session.last_activity,
				expiresAt: session.expires_at,
				browserFingerprint: session.browser_fingerprint,
				ipAddress: session.ip_address,
				userAgent: session.user_agent,
				isActive: Boolean(session.is_active)
			};
		} catch (error) {
			logger.error('Failed to get session:', error);
			return null;
		}
	}

	/**
	 * Deactivate a session
	 * @param {string} sessionId - Session ID to deactivate
	 */
	async deactivateSession(sessionId) {
		try {
			await this.dbManager.run(
				`
				UPDATE auth_sessions
				SET is_active = 0
				WHERE id = ?
			`,
				[sessionId]
			);

			logger.info(`Deactivated auth session: ${sessionId}`);
		} catch (error) {
			logger.error('Failed to deactivate session:', error);
		}
	}

	/**
	 * Get all active sessions for a terminal key
	 * @param {string} terminalKey - Terminal key
	 * @returns {Array} Active sessions
	 */
	async getActiveSessions(terminalKey) {
		const terminalKeyHash = this.hashTerminalKey(terminalKey);

		try {
			const sessions = await this.dbManager.all(
				`
				SELECT * FROM auth_sessions
				WHERE terminal_key_hash = ? AND is_active = 1
				AND expires_at > datetime('now')
				ORDER BY last_activity DESC
			`,
				[terminalKeyHash]
			);

			return sessions.map((session) => ({
				sessionId: session.id,
				userId: session.user_id,
				createdAt: session.created_at,
				lastActivity: session.last_activity,
				expiresAt: session.expires_at,
				browserFingerprint: session.browser_fingerprint,
				ipAddress: session.ip_address,
				userAgent: session.user_agent
			}));
		} catch (error) {
			logger.error('Failed to get active sessions:', error);
			return [];
		}
	}

	/**
	 * Clean up expired sessions
	 * Removes sessions that have expired or been inactive
	 */
	async cleanupExpiredSessions() {
		try {
			const result = await this.dbManager.run(`
				DELETE FROM auth_sessions
				WHERE expires_at < datetime('now')
				OR (is_active = 0 AND last_activity < datetime('now', '-7 days'))
			`);

			if (result.changes > 0) {
				logger.info(`Cleaned up ${result.changes} expired auth sessions`);
			}
		} catch (error) {
			logger.error('Failed to cleanup expired sessions:', error);
		}
	}

	/**
	 * Hash terminal key for secure storage
	 * @param {string} terminalKey - Terminal key to hash
	 * @returns {string} Hashed key
	 */
	hashTerminalKey(terminalKey) {
		return createHash('sha256').update(terminalKey).digest('hex');
	}

	/**
	 * Start periodic cleanup timer
	 */
	startCleanupTimer() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanupExpiredSessions().catch((error) => {
				logger.error('Session cleanup failed:', error);
			});
		}, CLEANUP_INTERVAL_MS);

		logger.debug('Started auth session cleanup timer');
	}

	/**
	 * Stop cleanup timer and close
	 */
	async close() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		this.initialized = false;
		logger.debug('AuthSessionManager closed');
	}

	/**
	 * Get session statistics
	 * @returns {Object} Session statistics
	 */
	async getStatistics() {
		try {
			const stats = await this.dbManager.get(`
				SELECT
					COUNT(*) as total_sessions,
					COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sessions,
					COUNT(CASE WHEN expires_at > datetime('now') THEN 1 END) as valid_sessions,
					COUNT(DISTINCT terminal_key_hash) as unique_users
				FROM auth_sessions
			`);

			return {
				totalSessions: stats.total_sessions || 0,
				activeSessions: stats.active_sessions || 0,
				validSessions: stats.valid_sessions || 0,
				uniqueUsers: stats.unique_users || 0
			};
		} catch (error) {
			logger.error('Failed to get session statistics:', error);
			return {
				totalSessions: 0,
				activeSessions: 0,
				validSessions: 0,
				uniqueUsers: 0
			};
		}
	}
}

// Singleton instance for application-wide use
let authSessionManager = null;

/**
 * Get the global AuthSessionManager instance
 * @returns {AuthSessionManager} Global session manager instance
 */
export function getAuthSessionManager() {
	if (!authSessionManager) {
		authSessionManager = new AuthSessionManager();
	}
	return authSessionManager;
}

/**
 * Initialize the global session manager
 */
export async function initializeAuthSessions() {
	const manager = getAuthSessionManager();
	await manager.init();
	return manager;
}
