/**
 * User model and data access object
 */
export class UserDAO {
	constructor(databaseManager) {
		this.db = databaseManager;
	}

	/**
	 * Create a new user
	 */
	async create(userData) {
		const {
			username,
			displayName = null,
			email = null,
			passwordHash = null,
			isAdmin = false,
			isActive = true
		} = userData;

		const result = await this.db.run(`
			INSERT INTO users (username, display_name, email, password_hash, is_admin, is_active)
			VALUES (?, ?, ?, ?, ?, ?)
		`, [username, displayName, email, passwordHash, isAdmin ? 1 : 0, isActive ? 1 : 0]);

		return this.getById(result.lastID);
	}

	/**
	 * Get user by ID
	 */
	async getById(userId) {
		const row = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
		return row ? this.mapRowToUser(row) : null;
	}

	/**
	 * Get user by username
	 */
	async getByUsername(username) {
		const row = await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
		return row ? this.mapRowToUser(row) : null;
	}

	/**
	 * Get user by email
	 */
	async getByEmail(email) {
		const row = await this.db.get('SELECT * FROM users WHERE email = ?', [email]);
		return row ? this.mapRowToUser(row) : null;
	}

	/**
	 * List all users with optional pagination
	 */
	async list(options = {}) {
		const { page = 1, limit = 50, search = null, includeInactive = false } = options;
		const offset = (page - 1) * limit;

		let whereClause = includeInactive ? '' : 'WHERE is_active = 1';
		const params = [];

		if (search) {
			const searchClause = includeInactive
				? 'WHERE (username LIKE ? OR email LIKE ? OR display_name LIKE ?)'
				: 'AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)';

			whereClause += searchClause;
			const searchPattern = `%${search}%`;
			params.push(searchPattern, searchPattern, searchPattern);
		}

		params.push(limit, offset);

		const rows = await this.db.all(`
			SELECT * FROM users
			${whereClause}
			ORDER BY created_at DESC
			LIMIT ? OFFSET ?
		`, params);

		const users = rows.map(row => this.mapRowToUser(row));

		// Get total count for pagination
		let countWhereClause = includeInactive ? '' : 'WHERE is_active = 1';
		const countParams = [];

		if (search) {
			const searchClause = includeInactive
				? 'WHERE (username LIKE ? OR email LIKE ? OR display_name LIKE ?)'
				: 'AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)';

			countWhereClause += searchClause;
			const searchPattern = `%${search}%`;
			countParams.push(searchPattern, searchPattern, searchPattern);
		}

		const countResult = await this.db.get(`
			SELECT COUNT(*) as total FROM users ${countWhereClause}
		`, countParams);

		return {
			users,
			pagination: {
				page,
				limit,
				total: countResult.total,
				pages: Math.ceil(countResult.total / limit)
			}
		};
	}

	/**
	 * Update user
	 */
	async update(userId, updateData) {
		const allowedFields = ['display_name', 'email', 'password_hash', 'is_admin', 'is_active'];
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

		params.push(Date.now(), userId);

		await this.db.run(`
			UPDATE users
			SET ${updates.join(', ')}, updated_at = ?
			WHERE id = ?
		`, params);

		return this.getById(userId);
	}

	/**
	 * Delete user (soft delete by default)
	 */
	async delete(userId, hardDelete = false) {
		if (hardDelete) {
			await this.db.run('DELETE FROM users WHERE id = ?', [userId]);
		} else {
			await this.update(userId, { is_active: false });
		}
	}

	/**
	 * Check if user exists
	 */
	async exists(username, email = null) {
		let whereClause = 'username = ?';
		const params = [username];

		if (email) {
			whereClause += ' OR email = ?';
			params.push(email);
		}

		const result = await this.db.get(`
			SELECT COUNT(*) as count FROM users WHERE ${whereClause}
		`, params);

		return result.count > 0;
	}

	/**
	 * Get admin users
	 */
	async getAdmins() {
		const rows = await this.db.all(`
			SELECT * FROM users WHERE is_admin = 1 AND is_active = 1
			ORDER BY created_at ASC
		`);

		return rows.map(row => this.mapRowToUser(row));
	}

	/**
	 * Map database row to user object
	 */
	mapRowToUser(row) {
		return {
			id: row.id,
			username: row.username,
			displayName: row.display_name,
			email: row.email,
			passwordHash: row.password_hash,
			isAdmin: Boolean(row.is_admin),
			isActive: Boolean(row.is_active),
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at)
		};
	}
}