/**
 * WebAuthnCredential model and data access object
 */
export class WebAuthnCredentialDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Create a new WebAuthn credential
	 */
	async create(credentialData) {
		const {
			userId,
			credentialId,
			publicKey,
			counter = 0,
			deviceName = null,
			aaguid = null
		} = credentialData;

		const result = await this.db.run(`
			INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_name, aaguid)
			VALUES (?, ?, ?, ?, ?, ?)
		`, [userId, credentialId, publicKey, counter, deviceName, aaguid]);

		return this.getById(result.lastID);
	}

	/**
	 * Get credential by ID
	 */
	async getById(credentialId) {
		const row = await this.db.get('SELECT * FROM webauthn_credentials WHERE id = ?', [credentialId]);
		return row ? this.mapRowToCredential(row) : null;
	}

	/**
	 * Get credential by credential ID (WebAuthn credential ID)
	 */
	async getByCredentialId(credentialId) {
		const row = await this.db.get('SELECT * FROM webauthn_credentials WHERE credential_id = ?', [credentialId]);
		return row ? this.mapRowToCredential(row) : null;
	}

	/**
	 * Get all credentials for a user
	 */
	async getByUserId(userId) {
		const rows = await this.db.all(`
			SELECT * FROM webauthn_credentials
			WHERE user_id = ?
			ORDER BY created_at DESC
		`, [userId]);

		return rows.map(row => this.mapRowToCredential(row));
	}

	/**
	 * Get credentials for WebAuthn authentication (returns only necessary fields)
	 */
	async getCredentialsForAuth(userId) {
		const rows = await this.db.all(`
			SELECT credential_id, public_key, counter
			FROM webauthn_credentials
			WHERE user_id = ?
		`, [userId]);

		return rows.map(row => ({
			credentialId: row.credential_id,
			publicKey: row.public_key,
			counter: row.counter
		}));
	}

	/**
	 * Update credential counter after authentication
	 */
	async updateCounter(credentialId, newCounter) {
		await this.db.run(`
			UPDATE webauthn_credentials
			SET counter = ?, last_used_at = ?
			WHERE credential_id = ?
		`, [newCounter, Date.now(), credentialId]);
	}

	/**
	 * Update device name
	 */
	async updateDeviceName(credentialId, deviceName) {
		await this.db.run(`
			UPDATE webauthn_credentials
			SET device_name = ?
			WHERE id = ?
		`, [deviceName, credentialId]);
	}

	/**
	 * Delete credential
	 */
	async delete(credentialId) {
		await this.db.run('DELETE FROM webauthn_credentials WHERE id = ?', [credentialId]);
	}

	/**
	 * Delete credential by credential ID
	 */
	async deleteByCredentialId(credentialId) {
		await this.db.run('DELETE FROM webauthn_credentials WHERE credential_id = ?', [credentialId]);
	}

	/**
	 * List all credentials with user information for admin
	 */
	async listAllCredentials(options = {}) {
		const { page = 1, limit = 50, userId = null } = options;
		const offset = (page - 1) * limit;

		let whereClause = '';
		const params = [];

		if (userId) {
			whereClause = 'WHERE c.user_id = ?';
			params.push(userId);
		}

		params.push(limit, offset);

		const rows = await this.db.all(`
			SELECT c.*, u.username, u.display_name
			FROM webauthn_credentials c
			LEFT JOIN users u ON c.user_id = u.id
			${whereClause}
			ORDER BY c.created_at DESC
			LIMIT ? OFFSET ?
		`, params);

		return rows.map(row => this.mapRowToCredential(row, true));
	}

	/**
	 * Get credential statistics
	 */
	async getStats() {
		const totalCredentials = await this.db.get('SELECT COUNT(*) as count FROM webauthn_credentials');

		const recentlyUsed = await this.db.get(`
			SELECT COUNT(*) as count FROM webauthn_credentials
			WHERE last_used_at > ?
		`, [Date.now() - (30 * 24 * 60 * 60 * 1000)]); // Last 30 days

		const byAAGUID = await this.db.all(`
			SELECT aaguid, COUNT(*) as count
			FROM webauthn_credentials
			WHERE aaguid IS NOT NULL
			GROUP BY aaguid
			ORDER BY count DESC
			LIMIT 10
		`);

		return {
			total: totalCredentials.count,
			recentlyUsed: recentlyUsed.count,
			byAAGUID: byAAGUID
		};
	}

	/**
	 * Check if user has any WebAuthn credentials
	 */
	async userHasCredentials(userId) {
		const result = await this.db.get(`
			SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ?
		`, [userId]);

		return result.count > 0;
	}

	/**
	 * Get user's credential IDs for WebAuthn allowCredentials
	 */
	async getUserCredentialIds(userId) {
		const rows = await this.db.all(`
			SELECT credential_id FROM webauthn_credentials WHERE user_id = ?
		`, [userId]);

		return rows.map(row => row.credential_id);
	}

	/**
	 * Cleanup old unused credentials
	 */
	async cleanupUnusedCredentials(daysOld = 365) {
		const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

		const result = await this.db.run(`
			DELETE FROM webauthn_credentials
			WHERE (last_used_at IS NULL AND created_at < ?)
			   OR (last_used_at < ?)
		`, [cutoffTime, cutoffTime]);

		return result.changes;
	}

	/**
	 * Map database row to credential object
	 */
	mapRowToCredential(row, includeExtended = false) {
		const credential = {
			id: row.id,
			userId: row.user_id,
			credentialId: row.credential_id,
			publicKey: row.public_key,
			counter: row.counter,
			deviceName: row.device_name,
			aaguid: row.aaguid,
			createdAt: new Date(row.created_at),
			lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null
		};

		if (includeExtended) {
			credential.user = {
				username: row.username,
				displayName: row.display_name
			};
		}

		return credential;
	}
}