/**
 * AuthSession model and data access object
 */
export class AuthSessionDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Create a new authentication session
	 */
	async create(sessionData) {
		const {
			userId,
			deviceId = null,
			sessionToken,
			expiresAt,
			ipAddress = null,
			userAgent = null,
			isActive = true
		} = sessionData;

		const result = await this.db.run(`
			INSERT INTO auth_sessions (user_id, device_id, session_token, expires_at, ip_address, user_agent, is_active)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, [userId, deviceId, sessionToken, expiresAt, ipAddress, userAgent, isActive ? 1 : 0]);

		return this.getById(result.lastID);
	}

	/**
	 * Get session by ID
	 */
	async getById(sessionId) {
		const row = await this.db.get('SELECT * FROM auth_sessions WHERE id = ?', [sessionId]);
		return row ? this.mapRowToSession(row) : null;
	}

	/**
	 * Get session by token
	 */
	async getByToken(token) {
		const row = await this.db.get('SELECT * FROM auth_sessions WHERE session_token = ?', [token]);
		return row ? this.mapRowToSession(row) : null;
	}

	/**
	 * Get active session by token (not expired and active)
	 */
	async getActiveByToken(token) {
		const now = Date.now();
		const row = await this.db.get(`
			SELECT * FROM auth_sessions
			WHERE session_token = ? AND expires_at > ? AND is_active = 1
		`, [token, now]);

		return row ? this.mapRowToSession(row) : null;
	}

	/**
	 * Get all sessions for a user
	 */
	async getByUserId(userId, includeExpired = false) {
		let whereClause = 'user_id = ?';
		const params = [userId];

		if (!includeExpired) {
			whereClause += ' AND expires_at > ? AND is_active = 1';
			params.push(Date.now());
		}

		const rows = await this.db.all(`
			SELECT s.*, d.device_name, d.device_fingerprint
			FROM auth_sessions s
			LEFT JOIN user_devices d ON s.device_id = d.id
			WHERE ${whereClause}
			ORDER BY s.last_activity_at DESC
		`, params);

		return rows.map(row => this.mapRowToSession(row, true));
	}

	/**
	 * Update session activity
	 */
	async updateActivity(sessionId, ipAddress = null, userAgent = null) {
		const updates = ['last_activity_at = ?'];
		const params = [Date.now()];

		if (ipAddress) {
			updates.push('ip_address = ?');
			params.push(ipAddress);
		}

		if (userAgent) {
			updates.push('user_agent = ?');
			params.push(userAgent);
		}

		params.push(sessionId);

		await this.db.run(`
			UPDATE auth_sessions
			SET ${updates.join(', ')}
			WHERE id = ?
		`, params);
	}

	/**
	 * Update session by token
	 */
	async updateByToken(token, updateData) {
		const allowedFields = ['expires_at', 'is_active', 'last_activity_at'];
		const updates = [];
		const params = [];

		Object.keys(updateData).forEach(key => {
			if (allowedFields.includes(key)) {
				updates.push(`${key} = ?`);
				params.push(updateData[key]);
			}
		});

		if (updates.length === 0) {
			throw new Error('No valid fields to update');
		}

		params.push(token);

		await this.db.run(`
			UPDATE auth_sessions
			SET ${updates.join(', ')}
			WHERE session_token = ?
		`, params);
	}

	/**
	 * Revoke session (mark as inactive)
	 */
	async revoke(sessionId) {
		await this.db.run(`
			UPDATE auth_sessions
			SET is_active = 0
			WHERE id = ?
		`, [sessionId]);
	}

	/**
	 * Revoke session by token
	 */
	async revokeByToken(token) {
		await this.db.run(`
			UPDATE auth_sessions
			SET is_active = 0
			WHERE session_token = ?
		`, [token]);
	}

	/**
	 * Revoke all sessions for a user
	 */
	async revokeAllForUser(userId, exceptSessionId = null) {
		let whereClause = 'user_id = ?';
		const params = [userId];

		if (exceptSessionId) {
			whereClause += ' AND id != ?';
			params.push(exceptSessionId);
		}

		await this.db.run(`
			UPDATE auth_sessions
			SET is_active = 0
			WHERE ${whereClause}
		`, params);
	}

	/**
	 * Revoke all sessions for a device
	 */
	async revokeAllForDevice(deviceId) {
		await this.db.run(`
			UPDATE auth_sessions
			SET is_active = 0
			WHERE device_id = ?
		`, [deviceId]);
	}

	/**
	 * Clean up expired sessions
	 */
	async cleanupExpired() {
		const result = await this.db.run(`
			DELETE FROM auth_sessions
			WHERE expires_at < ?
		`, [Date.now()]);

		return result.changes;
	}

	/**
	 * Get session statistics
	 */
	async getStats() {
		const now = Date.now();

		const activeCount = await this.db.get(`
			SELECT COUNT(*) as count
			FROM auth_sessions
			WHERE expires_at > ? AND is_active = 1
		`, [now]);

		const expiredCount = await this.db.get(`
			SELECT COUNT(*) as count
			FROM auth_sessions
			WHERE expires_at <= ? OR is_active = 0
		`, [now]);

		const recentActivity = await this.db.get(`
			SELECT COUNT(*) as count
			FROM auth_sessions
			WHERE last_activity_at > ? AND is_active = 1
		`, [now - 86400000]); // Last 24 hours

		return {
			active: activeCount.count,
			expired: expiredCount.count,
			recentActivity: recentActivity.count
		};
	}

	/**
	 * List all sessions with user information for admin
	 */
	async listAllSessions(options = {}) {
		const { page = 1, limit = 50, userId = null, includeExpired = false } = options;
		const offset = (page - 1) * limit;

		let whereClause = includeExpired ? '' : 'WHERE s.expires_at > ? AND s.is_active = 1';
		const params = includeExpired ? [] : [Date.now()];

		if (userId) {
			const userClause = includeExpired ? 'WHERE s.user_id = ?' : 'AND s.user_id = ?';
			whereClause += userClause;
			params.push(userId);
		}

		params.push(limit, offset);

		const rows = await this.db.all(`
			SELECT s.*, u.username, u.display_name, d.device_name, d.device_fingerprint
			FROM auth_sessions s
			LEFT JOIN users u ON s.user_id = u.id
			LEFT JOIN user_devices d ON s.device_id = d.id
			${whereClause}
			ORDER BY s.last_activity_at DESC
			LIMIT ? OFFSET ?
		`, params);

		return rows.map(row => this.mapRowToSession(row, true));
	}

	/**
	 * Map database row to session object
	 */
	mapRowToSession(row, includeExtended = false) {
		const session = {
			id: row.id,
			userId: row.user_id,
			deviceId: row.device_id,
			sessionToken: row.session_token,
			expiresAt: new Date(row.expires_at),
			lastActivityAt: new Date(row.last_activity_at),
			ipAddress: row.ip_address,
			userAgent: row.user_agent,
			isActive: Boolean(row.is_active),
			createdAt: new Date(row.created_at)
		};

		if (includeExtended) {
			session.user = {
				username: row.username,
				displayName: row.display_name
			};

			if (row.device_name) {
				session.device = {
					name: row.device_name,
					fingerprint: row.device_fingerprint
				};
			}
		}

		return session;
	}
}