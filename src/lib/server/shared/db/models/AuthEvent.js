/**
 * AuthEvent model and data access object for audit logging
 */
export class AuthEventDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Log an authentication event
	 */
	async create(eventData) {
		const {
			userId = null,
			deviceId = null,
			eventType,
			ipAddress = null,
			userAgent = null,
			details = null
		} = eventData;

		const result = await this.db.run(
			`
			INSERT INTO auth_events (user_id, device_id, event_type, ip_address, user_agent, details)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
			[userId, deviceId, eventType, ipAddress, userAgent, details ? JSON.stringify(details) : null]
		);

		return this.getById(result.lastID);
	}

	/**
	 * Get event by ID
	 */
	async getById(eventId) {
		const row = await this.db.get('SELECT * FROM auth_events WHERE id = ?', [eventId]);
		return row ? this.mapRowToEvent(row) : null;
	}

	/**
	 * Get events for a user
	 */
	async getByUserId(userId, options = {}) {
		const { limit = 100, eventType = null, days = 30 } = options;
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

		let whereClause = 'e.user_id = ? AND e.created_at > ?';
		const params = [userId, cutoffTime];

		if (eventType) {
			whereClause += ' AND e.event_type = ?';
			params.push(eventType);
		}

		params.push(limit);

		const rows = await this.db.all(
			`
			SELECT e.*, d.device_name, d.device_fingerprint
			FROM auth_events e
			LEFT JOIN user_devices d ON e.device_id = d.id
			WHERE ${whereClause}
			ORDER BY e.created_at DESC
			LIMIT ?
		`,
			params
		);

		return rows.map((row) => this.mapRowToEvent(row, true));
	}

	/**
	 * Get events for a device
	 */
	async getByDeviceId(deviceId, options = {}) {
		const { limit = 100, days = 30 } = options;
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const rows = await this.db.all(
			`
			SELECT e.*, u.username, u.display_name, d.device_name
			FROM auth_events e
			LEFT JOIN users u ON e.user_id = u.id
			LEFT JOIN user_devices d ON e.device_id = d.id
			WHERE e.device_id = ? AND e.created_at > ?
			ORDER BY e.created_at DESC
			LIMIT ?
		`,
			[deviceId, cutoffTime, limit]
		);

		return rows.map((row) => this.mapRowToEvent(row, true));
	}

	/**
	 * List all events with filtering for admin
	 */
	async listEvents(options = {}) {
		const {
			page = 1,
			limit = 50,
			userId = null,
			deviceId = null,
			eventType = null,
			ipAddress = null,
			days = 30
		} = options;

		const offset = (page - 1) * limit;
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const conditions = ['e.created_at > ?'];
		const params = [cutoffTime];

		if (userId) {
			conditions.push('e.user_id = ?');
			params.push(userId);
		}

		if (deviceId) {
			conditions.push('e.device_id = ?');
			params.push(deviceId);
		}

		if (eventType) {
			conditions.push('e.event_type = ?');
			params.push(eventType);
		}

		if (ipAddress) {
			conditions.push('e.ip_address = ?');
			params.push(ipAddress);
		}

		const whereClause = 'WHERE ' + conditions.join(' AND ');

		params.push(limit, offset);

		const rows = await this.db.all(
			`
			SELECT e.*, u.username, u.display_name, d.device_name, d.device_fingerprint
			FROM auth_events e
			LEFT JOIN users u ON e.user_id = u.id
			LEFT JOIN user_devices d ON e.device_id = d.id
			${whereClause}
			ORDER BY e.created_at DESC
			LIMIT ? OFFSET ?
		`,
			params
		);

		const events = rows.map((row) => this.mapRowToEvent(row, true));

		// Get total count for pagination
		const countParams = params.slice(0, -2); // Remove limit and offset
		const countResult = await this.db.get(
			`
			SELECT COUNT(*) as total FROM auth_events e ${whereClause}
		`,
			countParams
		);

		return {
			events,
			pagination: {
				page,
				limit,
				total: countResult.total,
				pages: Math.ceil(countResult.total / limit)
			}
		};
	}

	/**
	 * Get event statistics
	 */
	async getStats(days = 30) {
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const totalEvents = await this.db.get(
			`
			SELECT COUNT(*) as count FROM auth_events WHERE created_at > ?
		`,
			[cutoffTime]
		);

		const eventsByType = await this.db.all(
			`
			SELECT event_type, COUNT(*) as count
			FROM auth_events
			WHERE created_at > ?
			GROUP BY event_type
			ORDER BY count DESC
		`,
			[cutoffTime]
		);

		const recentFailedLogins = await this.db.get(
			`
			SELECT COUNT(*) as count FROM auth_events
			WHERE event_type = 'failed_login' AND created_at > ?
		`,
			[Date.now() - 24 * 60 * 60 * 1000]
		); // Last 24 hours

		const uniqueIPs = await this.db.get(
			`
			SELECT COUNT(DISTINCT ip_address) as count
			FROM auth_events
			WHERE created_at > ? AND ip_address IS NOT NULL
		`,
			[cutoffTime]
		);

		const suspiciousActivity = await this.db.get(
			`
			SELECT COUNT(*) as count FROM auth_events
			WHERE event_type IN ('failed_login', 'blocked_attempt', 'suspicious_activity')
			AND created_at > ?
		`,
			[cutoffTime]
		);

		return {
			total: totalEvents.count,
			byType: eventsByType,
			recentFailedLogins: recentFailedLogins.count,
			uniqueIPs: uniqueIPs.count,
			suspiciousActivity: suspiciousActivity.count
		};
	}

	/**
	 * Get failed login attempts for rate limiting
	 */
	async getFailedLoginAttempts(ipAddress, minutes = 15) {
		const cutoffTime = Date.now() - minutes * 60 * 1000;

		const result = await this.db.get(
			`
			SELECT COUNT(*) as count FROM auth_events
			WHERE event_type = 'failed_login'
			AND ip_address = ?
			AND created_at > ?
		`,
			[ipAddress, cutoffTime]
		);

		return result.count;
	}

	/**
	 * Get recent events by IP address
	 */
	async getEventsByIP(ipAddress, options = {}) {
		const { limit = 50, days = 7 } = options;
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const rows = await this.db.all(
			`
			SELECT e.*, u.username, u.display_name, d.device_name
			FROM auth_events e
			LEFT JOIN users u ON e.user_id = u.id
			LEFT JOIN user_devices d ON e.device_id = d.id
			WHERE e.ip_address = ? AND e.created_at > ?
			ORDER BY e.created_at DESC
			LIMIT ?
		`,
			[ipAddress, cutoffTime, limit]
		);

		return rows.map((row) => this.mapRowToEvent(row, true));
	}

	/**
	 * Clean up old events
	 */
	async cleanupOldEvents(daysOld = 90) {
		const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

		const result = await this.db.run(
			`
			DELETE FROM auth_events WHERE created_at < ?
		`,
			[cutoffTime]
		);

		return result.changes;
	}

	/**
	 * Log common authentication events
	 */
	async logLogin(userId, deviceId, ipAddress, userAgent, method = 'local') {
		return this.create({
			userId,
			deviceId,
			eventType: 'login',
			ipAddress,
			userAgent,
			details: { method }
		});
	}

	async logLogout(userId, deviceId, ipAddress, userAgent) {
		return this.create({
			userId,
			deviceId,
			eventType: 'logout',
			ipAddress,
			userAgent
		});
	}

	async logFailedLogin(userId, ipAddress, userAgent, reason, username = null) {
		return this.create({
			userId,
			eventType: 'failed_login',
			ipAddress,
			userAgent,
			details: { reason, username }
		});
	}

	async logEvent(userId, deviceId, ipAddress, userAgent, eventType, details = null) {
		return this.create({
			userId,
			deviceId,
			eventType,
			ipAddress,
			userAgent,
			details
		});
	}

	async logDeviceRegistered(userId, deviceId, ipAddress, userAgent, deviceName) {
		return this.create({
			userId,
			deviceId,
			eventType: 'device_registered',
			ipAddress,
			userAgent,
			details: { deviceName }
		});
	}

	async logWebAuthnRegistered(userId, deviceId, ipAddress, userAgent, credentialId) {
		return this.create({
			userId,
			deviceId,
			eventType: 'webauthn_registered',
			ipAddress,
			userAgent,
			details: { credentialId }
		});
	}

	async logOAuthLinked(userId, deviceId, ipAddress, userAgent, provider) {
		return this.create({
			userId,
			deviceId,
			eventType: 'oauth_linked',
			ipAddress,
			userAgent,
			details: { provider }
		});
	}

	async logPasswordChanged(userId, deviceId, ipAddress, userAgent) {
		return this.create({
			userId,
			deviceId,
			eventType: 'password_changed',
			ipAddress,
			userAgent
		});
	}

	async logSessionRevoked(userId, deviceId, ipAddress, userAgent, revokedSessionId) {
		return this.create({
			userId,
			deviceId,
			eventType: 'session_revoked',
			ipAddress,
			userAgent,
			details: { revokedSessionId }
		});
	}

	/**
	 * Map database row to event object
	 */
	mapRowToEvent(row, includeExtended = false) {
		const event = {
			id: row.id,
			userId: row.user_id,
			deviceId: row.device_id,
			eventType: row.event_type,
			ipAddress: row.ip_address,
			userAgent: row.user_agent,
			details: row.details ? JSON.parse(row.details) : null,
			createdAt: new Date(row.created_at)
		};

		if (includeExtended) {
			event.user = {
				username: row.username,
				displayName: row.display_name
			};

			if (row.device_name) {
				event.device = {
					name: row.device_name,
					fingerprint: row.device_fingerprint
				};
			}
		}

		return event;
	}
}
