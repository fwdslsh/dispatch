/**
 * ValueResolver Service
 * Implements the settings value resolution hierarchy:
 * 1. UI Configuration (database current_value)
 * 2. Environment Variable (process.env)
 * 3. Default Value (database default_value)
 */

import SettingsManager from "./SettingsManager";

export class ValueResolver {
	/**
	 * Create ValueResolver instance
	 * @param {SettingsManager} settingsManager - Settings manager instance
	 */
	constructor(settingsManager) {
		this.settingsManager = settingsManager;
		this.cache = new Map();
		this.cacheTimeout = 60 * 1000; // 1 minute for value resolution cache
		this.lastCacheUpdate = new Map();
	}

	/**
	 * Resolve value for a setting following the priority hierarchy
	 * @param {string} key - Setting key
	 * @returns {Promise<string|null>} Resolved value
	 */
	async resolveSettingValue(key) {
		// Check cache first
		const cached = this.getCachedValue(key);
		if (cached !== null) {
			return cached;
		}

		const setting = await this.settingsManager.getSetting(key);
		if (!setting) {
			return null;
		}

		const resolved = this.resolveValue(setting);
		this.setCachedValue(key, resolved);

		return resolved;
	}

	/**
	 * Resolve value for a ConfigurationSetting instance
	 * @param {ConfigurationSetting} setting - Setting instance
	 * @returns {string|null} Resolved value
	 */
	resolveValue(setting) {
		// Priority 1: UI Configuration (current_value in database)
		if (setting.current_value !== null && setting.current_value !== '') {
			return setting.current_value;
		}

		// Priority 2: Environment Variable
		if (setting.env_var_name && process.env[setting.env_var_name]) {
			const envValue = process.env[setting.env_var_name];
			if (envValue !== null && envValue !== '') {
				return envValue;
			}
		}

		// Priority 3: Default Value
		return setting.default_value;
	}

	/**
	 * Resolve values for multiple settings
	 * @param {Array<string>} keys - Array of setting keys
	 * @returns {Promise<Object>} Object with keys and their resolved values
	 */
	async resolveMultipleValues(keys) {
		const result = {};

		// Batch process for efficiency
		const promises = keys.map(async (key) => {
			const value = await this.resolveSettingValue(key);
			return { key, value };
		});

		const results = await Promise.all(promises);

		for (const { key, value } of results) {
			result[key] = value;
		}

		return result;
	}

	/**
	 * Resolve all settings in a category
	 * @param {string} categoryId - Category ID
	 * @returns {Promise<Object>} Object with setting keys and resolved values
	 */
	async resolveCategoryValues(categoryId) {
		const settings = await this.settingsManager.getSettings(categoryId);
		const result = {};

		for (const setting of settings) {
			result[setting.key] = this.resolveValue(setting);
		}

		return result;
	}

	/**
	 * Get resolution info for a setting (shows which source was used)
	 * @param {string} key - Setting key
	 * @returns {Promise<Object>} Resolution information
	 */
	async getResolutionInfo(key) {
		const setting = await this.settingsManager.getSetting(key);
		if (!setting) {
			return {
				key,
				resolved: null,
				source: 'not_found',
				sources: {}
			};
		}

		const sources = {
			ui: setting.current_value,
			environment: setting.env_var_name ? process.env[setting.env_var_name] : null,
			default: setting.default_value
		};

		let resolvedValue = null;
		let source = 'none';

		// Determine which source was used
		if (setting.current_value !== null && setting.current_value !== '') {
			resolvedValue = setting.current_value;
			source = 'ui';
		} else if (setting.env_var_name && process.env[setting.env_var_name]) {
			resolvedValue = process.env[setting.env_var_name];
			source = 'environment';
		} else if (setting.default_value !== null) {
			resolvedValue = setting.default_value;
			source = 'default';
		}

		return {
			key,
			resolved: resolvedValue,
			source,
			sources,
			setting_info: {
				name: setting.name,
				type: setting.type,
				is_sensitive: setting.is_sensitive,
				is_required: setting.is_required,
				env_var_name: setting.env_var_name
			}
		};
	}

	/**
	 * Get resolution info for all settings
	 * @returns {Promise<Array>} Array of resolution info objects
	 */
	async getAllResolutionInfo() {
		const settings = await this.settingsManager.getSettings();
		const promises = settings.map((setting) => this.getResolutionInfo(setting.key));
		return Promise.all(promises);
	}

	/**
	 * Check for conflicts between different value sources
	 * @returns {Promise<Array>} Array of conflicts
	 */
	async checkValueConflicts() {
		const conflicts = [];
		const settings = await this.settingsManager.getSettings();

		for (const setting of settings) {
			const ui = setting.current_value;
			const env = setting.env_var_name ? process.env[setting.env_var_name] : null;
			const defaultVal = setting.default_value;

			// Check if UI and environment values differ
			if (ui && env && ui !== env) {
				conflicts.push({
					key: setting.key,
					name: setting.name,
					type: 'ui_env_mismatch',
					ui_value: setting.is_sensitive ? '*'.repeat(ui.length) : ui,
					env_value: setting.is_sensitive ? '*'.repeat(env.length) : env,
					message: `UI setting (${ui}) differs from environment variable (${env})`
				});
			}

			// Check if environment and default values differ significantly
			if (env && defaultVal && env !== defaultVal && !ui) {
				conflicts.push({
					key: setting.key,
					name: setting.name,
					type: 'env_default_override',
					env_value: setting.is_sensitive ? '*'.repeat(env.length) : env,
					default_value: setting.is_sensitive ? '*'.repeat(defaultVal.length) : defaultVal,
					message: `Environment variable (${env}) overrides default (${defaultVal})`
				});
			}
		}

		return conflicts;
	}

	/**
	 * Validate resolved values meet requirements
	 * @returns {Promise<Object>} Validation result
	 */
	async validateResolvedValues() {
		const settings = await this.settingsManager.getSettings();
		const errors = [];
		const warnings = [];

		for (const setting of settings) {
			const resolved = this.resolveValue(setting);

			// Check required settings
			if (setting.is_required && (!resolved || resolved.trim().length === 0)) {
				errors.push({
					key: setting.key,
					name: setting.name,
					error: 'Required setting has no value'
				});
			}

			// Check for default values that should be changed
			if (resolved === setting.default_value && setting.is_sensitive) {
				warnings.push({
					key: setting.key,
					name: setting.name,
					warning: 'Using default value for sensitive setting'
				});
			}

			// Check for empty environment variables overriding defaults
			if (
				setting.env_var_name &&
				process.env[setting.env_var_name] === '' &&
				setting.default_value
			) {
				warnings.push({
					key: setting.key,
					name: setting.name,
					warning: 'Empty environment variable overrides non-empty default'
				});
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Get recommended configuration based on current environment
	 * @returns {Promise<Object>} Configuration recommendations
	 */
	async getConfigurationRecommendations() {
		const recommendations = [];
		const resolutionInfo = await this.getAllResolutionInfo();

		for (const info of resolutionInfo) {
			const { key, source, sources, setting_info } = info;

			// Recommend UI configuration for sensitive settings
			if (setting_info.is_sensitive && source === 'environment') {
				recommendations.push({
					key,
					name: setting_info.name,
					type: 'security',
					priority: 'high',
					message:
						'Consider setting this sensitive value through the UI instead of environment variables'
				});
			}

			// Recommend environment variables for deployment settings
			if (['workspaces_root', 'ssl_enabled'].includes(key) && source === 'default') {
				recommendations.push({
					key,
					name: setting_info.name,
					type: 'deployment',
					priority: 'medium',
					message: 'Consider setting this deployment-specific value via environment variable'
				});
			}

			// Recommend changing default values
			if (source === 'default' && ['terminal_key'].includes(key)) {
				recommendations.push({
					key,
					name: setting_info.name,
					type: 'security',
					priority: 'critical',
					message: 'Default value must be changed for security'
				});
			}
		}

		return recommendations;
	}

	/**
	 * Cache management
	 */
	getCachedValue(key) {
		const cached = this.cache.get(key);
		const lastUpdate = this.lastCacheUpdate.get(key) || 0;

		if (cached !== undefined && Date.now() - lastUpdate < this.cacheTimeout) {
			return cached;
		}

		return null;
	}

	setCachedValue(key, value) {
		this.cache.set(key, value);
		this.lastCacheUpdate.set(key, Date.now());
	}

	/**
	 * Invalidate cache for specific key or all keys
	 * @param {string} key - Optional specific key to invalidate
	 */
	invalidateCache(key = null) {
		if (key) {
			this.cache.delete(key);
			this.lastCacheUpdate.delete(key);
		} else {
			this.cache.clear();
			this.lastCacheUpdate.clear();
		}
	}

	/**
	 * Clear all caches
	 */
	clearCache() {
		this.invalidateCache();
	}
}

export default ValueResolver;
