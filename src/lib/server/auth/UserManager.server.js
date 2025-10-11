import { logger } from '../shared/utils/logger.js';

/**
 * User Manager - Handles user record lifecycle for authentication
 *
 * Features:
 * - User creation and upsert for OAuth providers
 * - Last login timestamp tracking
 * - User lookup by ID
 * - Compliant with auth_users schema (Migration 2)
 */
export class UserManager {
	constructor(database) {
		this.db = database;
		logger.info('USER', 'UserManager initialized');
	}

	/**
	 * Create or update a user record (upsert)
	 * Used when a user authenticates via OAuth or API key for the first time
	 *
	 * @param {string} userId - User ID (e.g., 'default', 'github_12345', 'google_67890')
	 * @param {Object} userData - User data {email?, name?}
	 * @returns {Promise<Object>} User record {userId, email, name, createdAt, lastLogin}
	 */
	async upsertUser(userId, userData = {}) {
		const now = Date.now();

		// Check if user exists
		const existingUser = await this.db.get(
			'SELECT user_id, email, name, created_at FROM auth_users WHERE user_id = ?',
			[userId]
		);

		if (existingUser) {
			// Update existing user: update last_login and optionally email/name
			await this.db.run(
				`UPDATE auth_users
				 SET last_login = ?,
				     email = COALESCE(?, email),
				     name = COALESCE(?, name)
				 WHERE user_id = ?`,
				[now, userData.email, userData.name, userId]
			);

			logger.info('USER', `Updated user ${userId} (last_login: ${new Date(now).toISOString()})`);

			return {
				userId,
				email: userData.email || existingUser.email,
				name: userData.name || existingUser.name,
				createdAt: existingUser.created_at,
				lastLogin: now
			};
		} else {
			// Create new user
			await this.db.run(
				`INSERT INTO auth_users (user_id, email, name, created_at, last_login)
				 VALUES (?, ?, ?, ?, ?)`,
				[userId, userData.email || null, userData.name || null, now, now]
			);

			logger.info('USER', `Created user ${userId} (email: ${userData.email || 'none'})`);

			return {
				userId,
				email: userData.email || null,
				name: userData.name || null,
				createdAt: now,
				lastLogin: now
			};
		}
	}

	/**
	 * Get user by ID
	 * @param {string} userId - User ID
	 * @returns {Promise<Object|null>} User record or null if not found
	 */
	async getUser(userId) {
		const user = await this.db.get(
			'SELECT user_id, email, name, created_at, last_login FROM auth_users WHERE user_id = ?',
			[userId]
		);

		if (!user) {
			return null;
		}

		return {
			userId: user.user_id,
			email: user.email,
			name: user.name,
			createdAt: user.created_at,
			lastLogin: user.last_login
		};
	}

	/**
	 * List all users
	 * @returns {Promise<Array>} Array of user records
	 */
	async listUsers() {
		const users = await this.db.all(
			'SELECT user_id, email, name, created_at, last_login FROM auth_users ORDER BY last_login DESC'
		);

		return users.map((u) => ({
			userId: u.user_id,
			email: u.email,
			name: u.name,
			createdAt: u.created_at,
			lastLogin: u.last_login
		}));
	}

	/**
	 * Delete a user (cascade deletes sessions and API keys via foreign keys)
	 * @param {string} userId - User ID to delete
	 * @returns {Promise<boolean>} True if user was deleted, false if not found
	 */
	async deleteUser(userId) {
		const result = await this.db.run('DELETE FROM auth_users WHERE user_id = ?', [userId]);

		if (result.changes > 0) {
			logger.info('USER', `Deleted user ${userId}`);
			return true;
		}

		logger.debug('USER', `No user to delete: ${userId}`);
		return false;
	}
}
