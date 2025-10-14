/**
 * SettingsRepository - Application settings CRUD operations
 * @file Handles settings persistence (JSON objects per category)
 */

/**
 * @typedef {import('./DatabaseManager.js').DatabaseManager} DatabaseManager
 */

export class SettingsRepository {
	#db;

	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {
		this.#db = db;
	}

	/**
	 * Get setting value by key (for simple key-value access)
	 * @param {string} key - Setting key
	 * @returns {Promise<any>} Setting value or undefined
	 */
	async get(key) {
		// Assuming 'global' category for simple get/set
		const settings = await this.getByCategory('global');
		return settings[key];
	}

	/**
	 * Set setting value (for simple key-value access)
	 * @param {string} key - Setting key
	 * @param {any} value - Setting value
	 * @returns {Promise<void>}
	 */
	async set(key, value) {
		// Assuming 'global' category for simple get/set
		const settings = await this.getByCategory('global');
		settings[key] = value;
		await this.setByCategory('global', settings);
	}

	/**
	 * Get all settings for a category
	 * @param {string} category - Setting category (e.g., 'global', 'claude', 'workspace')
	 * @returns {Promise<Object>} Settings object for the category
	 */
	async getByCategory(category) {
		const row = await this.#db.get('SELECT settings_json FROM settings WHERE category = ?', [
			category
		]);

		if (!row) return {};

		try {
			return JSON.parse(row.settings_json);
		} catch (e) {
			console.warn(`Failed to parse settings for category '${category}':`, e);
			return {};
		}
	}

	/**
	 * Set settings for a category
	 * @param {string} category - Setting category
	 * @param {Object} settings - Settings object for this category
	 * @param {string} [description=null] - Optional description
	 * @returns {Promise<void>}
	 */
	async setByCategory(category, settings, description = null) {
		const now = Date.now();
		const settingsJson = JSON.stringify(settings);

		await this.#db.run(
			`INSERT OR REPLACE INTO settings
			 (category, settings_json, description, created_at, updated_at)
			 VALUES (?, ?, ?,
			         COALESCE((SELECT created_at FROM settings WHERE category = ?), ?),
			         ?)`,
			[category, settingsJson, description, category, now, now]
		);
	}

	/**
	 * Update specific setting in a category
	 * @param {string} category - Setting category
	 * @param {string} key - Setting key within the category
	 * @param {any} value - Setting value
	 * @returns {Promise<void>}
	 */
	async updateInCategory(category, key, value) {
		const currentSettings = await this.getByCategory(category);
		currentSettings[key] = value;
		await this.setByCategory(category, currentSettings);
	}

	/**
	 * Get all settings with metadata
	 * @returns {Promise<Array>} Array of setting categories with metadata
	 */
	async getAll() {
		const rows = await this.#db.all(`
			SELECT category, settings_json, description, created_at, updated_at
			FROM settings
			ORDER BY category
		`);

		return rows.map((row) => {
			let settings = {};
			try {
				settings = JSON.parse(row.settings_json);
			} catch (e) {
				console.warn(`Failed to parse settings for category '${row.category}':`, e);
			}

			return {
				category: row.category,
				settings,
				description: row.description,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};
		});
	}

	/**
	 * Delete a settings category
	 * @param {string} category - Setting category
	 * @returns {Promise<void>}
	 */
	async deleteCategory(category) {
		await this.#db.run('DELETE FROM settings WHERE category = ?', [category]);
	}

	/**
	 * Initialize default settings
	 * @returns {Promise<void>}
	 */
	async initializeDefaults() {
		const categories = [
			{
				category: 'global',
				settings: {
					theme: 'retro'
				},
				description: 'Global application settings'
			},
			{
				category: 'claude',
				settings: {
					model: 'claude-3-5-sonnet-20241022',
					permissionMode: 'default',
					executable: 'auto',
					maxTurns: null,
					includePartialMessages: false,
					continueConversation: false
				},
				description: 'Default Claude session settings'
			},
			{
				category: 'workspace',
				settings: {
					envVariables: {}
				},
				description: 'Workspace-level environment variables for all sessions'
			}
		];

		for (const categoryData of categories) {
			// Only insert if the category doesn't already exist
			const existing = await this.getByCategory(categoryData.category);
			if (Object.keys(existing).length === 0) {
				await this.setByCategory(
					categoryData.category,
					categoryData.settings,
					categoryData.description
				);
			}
		}
	}

	/**
	 * Get system status including onboarding state
	 * @returns {Promise<Object>} System status object
	 */
	async getSystemStatus() {
		const systemSettings = await this.getByCategory('system');

		return {
			onboarding: {
				isComplete: systemSettings.onboarding_complete === true
			},
			authConfigured: false // Placeholder for auth configuration check
		};
	}

	/**
	 * Update settings for a category (alias for setByCategory with partial updates)
	 * @param {string} category - Setting category
	 * @param {Object} updates - Settings to update
	 * @returns {Promise<void>}
	 */
	async updateSettings(category, updates) {
		const current = await this.getByCategory(category);
		const merged = { ...current, ...updates };
		await this.setByCategory(category, merged);
	}
}
