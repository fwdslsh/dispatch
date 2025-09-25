/**
 * UserDevice model and data access object
 */
export class UserDeviceDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Create or update a user device
	 */
	async createOrUpdate(deviceData) {
		const {
			userId,
			deviceName,
			deviceFingerprint,
			ipAddress = null,
			userAgent = null,
			isTrusted = false
		} = deviceData;

		// Check if device already exists
		const existing = await this.getByFingerprint(deviceFingerprint);

		if (existing) {
			// Update existing device
			await this.db.run(
				`
				UPDATE user_devices
				SET last_seen_at = ?, last_ip_address = ?, user_agent = ?
				WHERE device_fingerprint = ?
			`,
				[Date.now(), ipAddress, userAgent, deviceFingerprint]
			);

			return this.getById(existing.id);
		} else {
			// Create new device
			const result = await this.db.run(
				`
				INSERT INTO user_devices (user_id, device_name, device_fingerprint, last_ip_address, user_agent, is_trusted)
				VALUES (?, ?, ?, ?, ?, ?)
			`,
				[userId, deviceName, deviceFingerprint, ipAddress, userAgent, isTrusted ? 1 : 0]
			);

			return this.getById(result.lastID);
		}
	}

	/**
	 * Get device by ID
	 */
	async getById(deviceId) {
		const row = await this.db.get('SELECT * FROM user_devices WHERE id = ?', [deviceId]);
		return row ? this.mapRowToDevice(row) : null;
	}

	/**
	 * Get device by fingerprint
	 */
	async getByFingerprint(fingerprint) {
		const row = await this.db.get('SELECT * FROM user_devices WHERE device_fingerprint = ?', [
			fingerprint
		]);
		return row ? this.mapRowToDevice(row) : null;
	}

	/**
	 * Get all devices for a user
	 */
	async getByUserId(userId, includeInactive = false) {
		let sql = `
			SELECT d.*, u.username, u.display_name,
			       (SELECT COUNT(*) FROM auth_sessions s
			        WHERE s.device_id = d.id AND s.is_active = 1 AND s.expires_at > ?) as active_sessions
			FROM user_devices d
			LEFT JOIN users u ON d.user_id = u.id
			WHERE d.user_id = ?
		`;

		const params = [Date.now(), userId];

		if (!includeInactive) {
			// Only show devices that have been seen recently (within last 30 days)
			sql += ' AND d.last_seen_at > ?';
			params.push(Date.now() - 30 * 24 * 60 * 60 * 1000);
		}

		sql += ' ORDER BY d.last_seen_at DESC';

		const rows = await this.db.all(sql, params);
		return rows.map((row) => this.mapRowToDevice(row, true));
	}

	/**
	 * List all devices with user information for admin
	 */
	async listAllDevices(options = {}) {
		const { page = 1, limit = 50, userId = null, trustedOnly = false } = options;
		const offset = (page - 1) * limit;

		let whereClause = '';
		const params = [Date.now()]; // For active sessions count

		const conditions = [];

		if (userId) {
			conditions.push('d.user_id = ?');
			params.push(userId);
		}

		if (trustedOnly) {
			conditions.push('d.is_trusted = 1');
		}

		if (conditions.length > 0) {
			whereClause = 'WHERE ' + conditions.join(' AND ');
		}

		// Add pagination params
		params.push(limit, offset);

		const rows = await this.db.all(
			`
			SELECT d.*, u.username, u.display_name,
			       (SELECT COUNT(*) FROM auth_sessions s
			        WHERE s.device_id = d.id AND s.is_active = 1 AND s.expires_at > ?) as active_sessions
			FROM user_devices d
			LEFT JOIN users u ON d.user_id = u.id
			${whereClause}
			ORDER BY d.last_seen_at DESC
			LIMIT ? OFFSET ?
		`,
			params
		);

		return rows.map((row) => this.mapRowToDevice(row, true));
	}

	/**
	 * Update device trust status
	 */
	async updateTrustStatus(deviceId, isTrusted) {
		await this.db.run(
			`
			UPDATE user_devices
			SET is_trusted = ?
			WHERE id = ?
		`,
			[isTrusted ? 1 : 0, deviceId]
		);
	}

	/**
	 * Update device name
	 */
	async updateDeviceName(deviceId, deviceName) {
		await this.db.run(
			`
			UPDATE user_devices
			SET device_name = ?
			WHERE id = ?
		`,
			[deviceName, deviceId]
		);
	}

	/**
	 * Delete device and revoke all its sessions
	 */
	async delete(deviceId) {
		// First revoke all sessions for this device
		await this.db.run(
			`
			UPDATE auth_sessions
			SET is_active = 0
			WHERE device_id = ?
		`,
			[deviceId]
		);

		// Then delete the device
		await this.db.run('DELETE FROM user_devices WHERE id = ?', [deviceId]);
	}

	/**
	 * Get device statistics
	 */
	async getStats() {
		const totalDevices = await this.db.get('SELECT COUNT(*) as count FROM user_devices');

		const trustedDevices = await this.db.get(`
			SELECT COUNT(*) as count FROM user_devices WHERE is_trusted = 1
		`);

		const recentDevices = await this.db.get(
			`
			SELECT COUNT(*) as count FROM user_devices
			WHERE last_seen_at > ?
		`,
			[Date.now() - 7 * 24 * 60 * 60 * 1000]
		); // Last 7 days

		const activeDevices = await this.db.get(
			`
			SELECT COUNT(DISTINCT d.id) as count
			FROM user_devices d
			JOIN auth_sessions s ON d.id = s.device_id
			WHERE s.is_active = 1 AND s.expires_at > ?
		`,
			[Date.now()]
		);

		return {
			total: totalDevices.count,
			trusted: trustedDevices.count,
			recent: recentDevices.count,
			active: activeDevices.count
		};
	}

	/**
	 * Clean up old inactive devices
	 */
	async cleanupInactive(daysOld = 90) {
		const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

		// Get devices to be deleted
		const devicesToDelete = await this.db.all(
			`
			SELECT id FROM user_devices
			WHERE last_seen_at < ? AND is_trusted = 0
		`,
			[cutoffTime]
		);

		// Revoke sessions for these devices
		for (const device of devicesToDelete) {
			await this.db.run(
				`
				UPDATE auth_sessions
				SET is_active = 0
				WHERE device_id = ?
			`,
				[device.id]
			);
		}

		// Delete the devices
		const result = await this.db.run(
			`
			DELETE FROM user_devices
			WHERE last_seen_at < ? AND is_trusted = 0
		`,
			[cutoffTime]
		);

		return result.changes;
	}

	/**
	 * Get devices by user with pagination
	 */
	async getDevicesForUser(userId, options = {}) {
		const { page = 1, limit = 10 } = options;
		const offset = (page - 1) * limit;

		const rows = await this.db.all(
			`
			SELECT d.*,
			       (SELECT COUNT(*) FROM auth_sessions s
			        WHERE s.device_id = d.id AND s.is_active = 1 AND s.expires_at > ?) as active_sessions
			FROM user_devices d
			WHERE d.user_id = ?
			ORDER BY d.last_seen_at DESC
			LIMIT ? OFFSET ?
		`,
			[Date.now(), userId, limit, offset]
		);

		const devices = rows.map((row) => this.mapRowToDevice(row));

		// Get total count for pagination
		const countResult = await this.db.get(
			`
			SELECT COUNT(*) as total FROM user_devices WHERE user_id = ?
		`,
			[userId]
		);

		return {
			devices,
			pagination: {
				page,
				limit,
				total: countResult.total,
				pages: Math.ceil(countResult.total / limit)
			}
		};
	}

	/**
	 * Map database row to device object
	 */
	mapRowToDevice(row, includeExtended = false) {
		const device = {
			id: row.id,
			userId: row.user_id,
			deviceName: row.device_name,
			deviceFingerprint: row.device_fingerprint,
			lastSeenAt: new Date(row.last_seen_at),
			lastIpAddress: row.last_ip_address,
			userAgent: row.user_agent,
			isTrusted: Boolean(row.is_trusted),
			createdAt: new Date(row.created_at)
		};

		if (includeExtended) {
			device.user = {
				username: row.username,
				displayName: row.display_name
			};

			device.activeSessions = row.active_sessions || 0;
		}

		return device;
	}
}
