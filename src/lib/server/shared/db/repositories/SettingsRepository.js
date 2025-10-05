import { logger } from '../../utils/logger.js';

/**
 * @typedef {Object} SettingsRecord
 * @property {string} category
 * @property {Record<string, any>} settings
 * @property {string | null} description
 * @property {number | null} createdAt
 * @property {number | null} updatedAt
 */

const parseSettingsRow = (row) => {
	if (!row) return null;
	let settings = {};
	if (row.settings_json) {
		try {
			settings = JSON.parse(row.settings_json);
		} catch (error) {
			logger.warn('DATABASE', `Failed to parse settings for ${row.category}: ${error.message}`);
		}
	}
	/** @type {SettingsRecord} */
	return {
		category: row.category,
		settings,
		description: row.description ?? null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null
	};
};

/**
 * Repository for persisted configuration categories.
 */
export class SettingsRepository {
	/**
	 * @param {import('../DatabaseManager.js').DatabaseManager} database
	 */
	constructor(database) {
		this.database = database;
	}

	/**
	 * Retrieve a settings category by identifier.
	 * @param {string} category
	 * @returns {Promise<SettingsRecord | null>}
	 */
	async getCategory(category) {
		const row = await this.database.get('SELECT * FROM settings WHERE category = ?', [category]);
		return row ? parseSettingsRow(row) : null;
	}

	/**
	 * Retrieve only the settings object for a category.
	 * @param {string} category
	 * @returns {Promise<Record<string, any>>}
	 */
	async getCategorySettings(category) {
		const record = await this.getCategory(category);
		return record?.settings ?? {};
	}

	/**
	 * List all persisted settings categories.
	 * @returns {Promise<SettingsRecord[]>}
	 */
	async getAll() {
		const rows = await this.database.all(
			`SELECT category, settings_json, description, created_at, updated_at FROM settings`
		);
		return rows.map((row) => parseSettingsRow(row));
	}

	/**
	 * Replace or create settings for a category.
	 * @param {string} category
	 * @param {Record<string, any>} settings
	 * @param {string | null} [description]
	 */
	async setCategory(category, settings, description = null) {
		const now = Date.now();
		await this.database.enqueueWrite(async () => {
			await this.database.run(
				`INSERT INTO settings (category, settings_json, description, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, ?)
                                 ON CONFLICT(category) DO UPDATE SET
                                        settings_json=excluded.settings_json,
                                        description=COALESCE(excluded.description, settings.description),
                                        updated_at=excluded.updated_at`,
				[category, JSON.stringify(settings ?? {}), description, now, now]
			);
		});
	}

	/**
	 * Update a single key in an existing category.
	 * @param {string} category
	 * @param {string} key
	 * @param {any} value
	 */
	async updateSetting(category, key, value) {
		const currentSettings = await this.getCategorySettings(category);
		currentSettings[key] = value;
		await this.setCategory(category, currentSettings);
	}

	/**
	 * Remove an entire category.
	 * @param {string} category
	 */
	async deleteCategory(category) {
		await this.database.run('DELETE FROM settings WHERE category = ?', [category]);
	}

	/**
	 * Seed the database with default settings if missing.
	 * @returns {Promise<void>}
	 */
	async initializeDefaults() {
		const defaults = [
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

		for (const entry of defaults) {
			const existing = await this.getCategorySettings(entry.category);
			if (Object.keys(existing).length === 0) {
				await this.setCategory(entry.category, entry.settings, entry.description);
			}
		}
	}
}
