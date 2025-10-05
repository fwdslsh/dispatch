const DEFAULT_USER_ID = 'default';

/**
 * Repository for persisted user preference documents.
 */
export class UserRepository {
	/**
	 * @param {import('../DatabaseManager.js').DatabaseManager} database
	 */
	constructor(database) {
		this.database = database;
	}

	/**
	 * Retrieve preferences for a specific category.
	 * @param {string} category
	 * @param {string} [userId]
	 * @returns {Promise<Record<string, any>>}
	 */
	async getPreferences(category, userId = DEFAULT_USER_ID) {
		const row = await this.database.get(
			'SELECT preferences_json FROM user_preferences WHERE user_id = ? AND category = ?',
			[userId, category]
		);
		if (!row) return {};
		try {
			return JSON.parse(row.preferences_json);
		} catch {
			return {};
		}
	}

	/**
	 * Retrieve all stored preferences grouped by category.
	 * @param {string} [userId]
	 * @returns {Promise<Record<string, Record<string, any>>>}
	 */
	async getAllPreferences(userId = DEFAULT_USER_ID) {
		const rows = await this.database.all(
			'SELECT category, preferences_json FROM user_preferences WHERE user_id = ?',
			[userId]
		);
		const preferences = {};
		for (const row of rows) {
			try {
				preferences[row.category] = JSON.parse(row.preferences_json);
			} catch {
				preferences[row.category] = {};
			}
		}
		return preferences;
	}

	/**
	 * Replace the stored preferences for a category.
	 * @param {string} category
	 * @param {Record<string, any>} preferences
	 * @param {string} [userId]
	 * @returns {Promise<Record<string, any>>}
	 */
	async updatePreferences(category, preferences, userId = DEFAULT_USER_ID) {
		const preferencesJson = JSON.stringify(preferences ?? {});
		const timestamp = new Date().toISOString();
		await this.database.enqueueWrite(async () => {
			await this.database.run(
				`INSERT INTO user_preferences (user_id, category, preferences_json, updated_at)
                                 VALUES (?, ?, ?, ?)
                                 ON CONFLICT(user_id, category) DO UPDATE SET
                                        preferences_json = excluded.preferences_json,
                                        updated_at = excluded.updated_at`,
				[userId, category, preferencesJson, timestamp]
			);
		});
		return preferences;
	}
}
