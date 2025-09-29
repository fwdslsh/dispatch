/**
 * SettingsManager Service
 * Centralized service for managing application settings with caching and validation
 */

import { SettingsCategory } from './SettingsCategory.js';
import { ConfigurationSetting } from './ConfigurationSetting.js';
import { initializeSettingsDatabase } from './DatabaseSetup.js';
import path from 'path';

export class SettingsManager {
	/**
	 * Create SettingsManager instance
	 * @param {string} dbPath - Path to SQLite database file
	 */
	constructor(dbPath = './dispatch.db') {
		this.dbPath = dbPath;
		this.db = null;
		this.categoryRepo = null;
		this.settingRepo = null;
		this.cache = new Map();
		this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
		this.lastCacheUpdate = 0;
	}

	/**
	 * Initialize the settings manager
	 */
	async initialize() {
		if (!this.db) {
			this.db = initializeSettingsDatabase(this.dbPath);
			this.categoryRepo = SettingsCategory.createRepository(this.db);
			this.settingRepo = ConfigurationSetting.createRepository(this.db);
		}
	}

	/**
	 * Get all settings categories
	 * @returns {Array<SettingsCategory>}
	 */
	async getCategories() {
		await this.initialize();
		return this.categoryRepo.findAll();
	}

	/**
	 * Get category by ID
	 * @param {string} categoryId - Category ID
	 * @returns {SettingsCategory|null}
	 */
	async getCategory(categoryId) {
		await this.initialize();
		return this.categoryRepo.findById(categoryId);
	}

	/**
	 * Get all settings with resolved values
	 * @param {string} categoryId - Optional category filter
	 * @returns {Array<ConfigurationSetting>}
	 */
	async getSettings(categoryId = null) {
		await this.initialize();

		const cacheKey = `settings_${categoryId || 'all'}`;
		const cached = this.getCachedValue(cacheKey);
		if (cached) {
			return cached;
		}

		let settings;
		if (categoryId) {
			settings = this.settingRepo.findByCategory(categoryId);
		} else {
			settings = this.settingRepo.findAll();
		}

		this.setCachedValue(cacheKey, settings);
		return settings;
	}

	/**
	 * Get settings grouped by category
	 * @returns {Object} Categories with their settings
	 */
	async getSettingsByCategory() {
		await this.initialize();

		const cacheKey = 'settings_by_category';
		const cached = this.getCachedValue(cacheKey);
		if (cached) {
			return cached;
		}

		const categories = await this.getCategories();
		const result = {
			categories: categories.map((cat) => cat.toObject()),
			settings: []
		};

		for (const category of categories) {
			const categorySettings = this.settingRepo.findByCategory(category.id);
			result.settings.push(...categorySettings.map((setting) => setting.toObject(true)));
		}

		this.setCachedValue(cacheKey, result);
		return result;
	}

	/**
	 * Get single setting by key
	 * @param {string} key - Setting key
	 * @returns {ConfigurationSetting|null}
	 */
	async getSetting(key) {
		await this.initialize();
		return this.settingRepo.findByKey(key);
	}

	/**
	 * Update single setting value
	 * @param {string} key - Setting key
	 * @param {string|null} value - New value
	 * @returns {boolean} Success status
	 */
	async updateSetting(key, value) {
		await this.initialize();

		// Get setting definition for validation
		const setting = this.settingRepo.findByKey(key);
		if (!setting) {
			throw new Error(`Setting '${key}' not found`);
		}

		// Validate the new value
		const validationErrors = setting.validateValue(value);
		if (validationErrors.length > 0) {
			throw new Error(`Validation failed for '${key}': ${validationErrors.join(', ')}`);
		}

		// Update in database
		const success = this.settingRepo.updateValue(key, value);
		if (success) {
			this.invalidateCache();
		}

		return success;
	}

	/**
	 * Update multiple settings in a category
	 * @param {string} categoryId - Category ID
	 * @param {Object} updates - Key-value pairs to update
	 * @returns {Object} Update results
	 */
	async updateCategorySettings(categoryId, updates) {
		await this.initialize();

		// Validate category exists
		const category = this.categoryRepo.findById(categoryId);
		if (!category) {
			throw new Error(`Category '${categoryId}' not found`);
		}

		// Get all settings in the category
		const categorySettings = this.settingRepo.findByCategory(categoryId);
		const settingsByKey = new Map(categorySettings.map((s) => [s.key, s]));

		// Validate all updates
		const validUpdates = {};
		const validationErrors = [];

		for (const [key, value] of Object.entries(updates)) {
			const setting = settingsByKey.get(key);
			if (!setting) {
				validationErrors.push(`Unknown setting '${key}' in category '${categoryId}'`);
				continue;
			}

			const errors = setting.validateValue(value);
			if (errors.length > 0) {
				validationErrors.push(...errors);
			} else {
				validUpdates[key] = value;
			}
		}

		if (validationErrors.length > 0) {
			throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
		}

		// Apply updates
		const updatedCount = this.settingRepo.updateMultiple(validUpdates);
		if (updatedCount > 0) {
			this.invalidateCache();
		}

		return {
			success: true,
			updated_count: updatedCount,
			session_invalidated: this.shouldInvalidateSessions(Object.keys(validUpdates))
		};
	}

	/**
	 * Clear setting value (revert to environment/default)
	 * @param {string} key - Setting key
	 * @returns {boolean} Success status
	 */
	async clearSetting(key) {
		await this.initialize();

		const success = this.settingRepo.clearValue(key);
		if (success) {
			this.invalidateCache();
		}

		return success;
	}

	/**
	 * Get resolved value for a setting (following priority hierarchy)
	 * @param {string} key - Setting key
	 * @returns {string|null} Resolved value
	 */
	async getResolvedValue(key) {
		const setting = await this.getSetting(key);
		return setting ? setting.getResolvedValue() : null;
	}

	/**
	 * Validate settings configuration
	 * @returns {Object} Validation result
	 */
	async validateConfiguration() {
		await this.initialize();

		const settings = await this.getSettings();
		const errors = [];
		const warnings = [];

		for (const setting of settings) {
			const value = setting.getResolvedValue();

			// Check required settings
			if (setting.is_required && (!value || value.trim().length === 0)) {
				errors.push(`Required setting '${setting.key}' is not configured`);
				continue;
			}

			// Validate non-empty values
			if (value && value.trim().length > 0) {
				const validationErrors = setting.validateValue(value);
				if (validationErrors.length > 0) {
					errors.push(...validationErrors);
				}
			}

			// Check for environment variable fallbacks
			if (!setting.current_value && setting.env_var_name && process.env[setting.env_var_name]) {
				warnings.push(`Setting '${setting.key}' using environment variable fallback`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Get authentication configuration status
	 * @returns {Object} Auth config status
	 */
	async getAuthConfig() {
		await this.initialize();

		const terminalKey = await this.getResolvedValue('terminal_key');
		const oauthClientId = await this.getResolvedValue('oauth_client_id');
		const oauthRedirectUri = await this.getResolvedValue('oauth_redirect_uri');

		return {
			terminal_key_set: Boolean(terminalKey && terminalKey !== 'change-me'),
			oauth_configured: Boolean(oauthClientId && oauthRedirectUri),
			oauth_client_id: oauthClientId,
			oauth_redirect_uri: oauthRedirectUri
		};
	}

	/**
	 * Check if session invalidation is needed for changed settings
	 * @param {Array<string>} changedKeys - Array of changed setting keys
	 * @returns {boolean} Whether to invalidate sessions
	 */
	shouldInvalidateSessions(changedKeys) {
		const authKeys = ['terminal_key', 'oauth_client_id', 'oauth_client_secret'];
		return changedKeys.some((key) => authKeys.includes(key));
	}

	/**
	 * Cache management
	 */
	getCachedValue(key) {
		const now = Date.now();
		if (now - this.lastCacheUpdate > this.cacheTimeout) {
			this.invalidateCache();
			return null;
		}

		return this.cache.get(key) || null;
	}

	setCachedValue(key, value) {
		this.cache.set(key, value);
		this.lastCacheUpdate = Date.now();
	}

	invalidateCache() {
		this.cache.clear();
		this.lastCacheUpdate = 0;
	}

	/**
	 * Close database connection
	 */
	close() {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}

export default SettingsManager;
