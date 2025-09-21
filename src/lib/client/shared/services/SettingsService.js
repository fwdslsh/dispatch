/**
 * Settings Service
 * Unified settings management with server/client synchronization
 * Handles server defaults and client overrides with localStorage persistence
 */

import { STORAGE_CONFIG } from '$lib/shared/constants.js';

export class SettingsService {
	constructor(config = {}) {
		this.config = {
			debug: false,
			serverUrl: typeof window !== 'undefined' ? window.location.origin : '',
			...config
		};

		// Internal state - use regular properties instead of runes for compatibility
		this.serverSettings = {};
		this.clientOverrides = {};
		this.isLoaded = false;
		this.isLoading = false;
		this.lastError = null;
		this.lastSync = null;

		// Initialize if in browser
		if (typeof window !== 'undefined') {
			this.loadClientOverrides();
			this.loadServerSettings();
		}
	}

	/**
	 * Get effective settings (server defaults + client overrides)
	 */
	getEffectiveSettings() {
		const merged = { ...this.serverSettings };
		
		// Apply client overrides
		for (const [category, overrides] of Object.entries(this.clientOverrides)) {
			if (merged[category]) {
				merged[category] = { ...merged[category], ...overrides };
			} else {
				merged[category] = { ...overrides };
			}
		}
		
		return merged;
	}

	/**
	 * Load server settings from API
	 */
	async loadServerSettings() {
		if (this.isLoading) return;
		
		this.isLoading = true;
		this.lastError = null;

		try {
			const response = await fetch(`${this.config.serverUrl}/api/settings`);
			if (response.ok) {
				const data = await response.json();
				this.serverSettings = data;
				this.lastSync = new Date().toISOString();
				this.isLoaded = true;
				
				if (this.config.debug) {
					console.log('[SettingsService] Server settings loaded:', data);
				}
			} else {
				throw new Error(`Server responded with ${response.status}`);
			}
		} catch (error) {
			this.lastError = `Failed to load server settings: ${error.message}`;
			console.warn('[SettingsService]', this.lastError);
			
			// Use fallback defaults if server is unavailable
			this.serverSettings = this.getFallbackDefaults();
			this.isLoaded = true;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Load client overrides from localStorage
	 */
	loadClientOverrides() {
		try {
			const stored = localStorage.getItem(STORAGE_CONFIG.SETTINGS_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				// Migrate old settings format if needed
				this.clientOverrides = this.migrateClientSettings(parsed);
			} else {
				this.clientOverrides = {};
			}
			
			if (this.config.debug) {
				console.log('[SettingsService] Client overrides loaded:', this.clientOverrides);
			}
		} catch (error) {
			console.warn('[SettingsService] Failed to load client overrides:', error);
			this.clientOverrides = {};
		}
	}

	/**
	 * Save client overrides to localStorage
	 */
	saveClientOverrides() {
		try {
			localStorage.setItem(STORAGE_CONFIG.SETTINGS_KEY, JSON.stringify(this.clientOverrides));
			if (this.config.debug) {
				console.log('[SettingsService] Client overrides saved');
			}
		} catch (error) {
			console.error('[SettingsService] Failed to save client overrides:', error);
			throw error;
		}
	}

	/**
	 * Get effective setting value
	 * @param {string} key - Setting key in format 'category.setting'
	 * @param {any} fallback - Fallback value if setting not found
	 */
	get(key, fallback = null) {
		const [category, setting] = key.split('.');
		if (!category || !setting) {
			console.warn('[SettingsService] Invalid setting key format:', key);
			return fallback;
		}

		const effectiveSettings = this.getEffectiveSettings();
		return effectiveSettings[category]?.[setting] ?? fallback;
	}

	/**
	 * Set client override for a setting
	 * @param {string} key - Setting key in format 'category.setting'
	 * @param {any} value - Setting value
	 */
	setClientOverride(key, value) {
		const [category, setting] = key.split('.');
		if (!category || !setting) {
			throw new Error('Invalid setting key format. Use "category.setting"');
		}

		if (!this.clientOverrides[category]) {
			this.clientOverrides[category] = {};
		}

		this.clientOverrides[category][setting] = value;
		this.saveClientOverrides();

		if (this.config.debug) {
			console.log('[SettingsService] Client override set:', key, '=', value);
		}
	}

	/**
	 * Remove client override for a setting (revert to server default)
	 * @param {string} key - Setting key in format 'category.setting'
	 */
	removeClientOverride(key) {
		const [category, setting] = key.split('.');
		if (!category || !setting) {
			throw new Error('Invalid setting key format. Use "category.setting"');
		}

		if (this.clientOverrides[category]) {
			delete this.clientOverrides[category][setting];
			
			// Clean up empty categories
			if (Object.keys(this.clientOverrides[category]).length === 0) {
				delete this.clientOverrides[category];
			}
			
			this.saveClientOverrides();
			
			if (this.config.debug) {
				console.log('[SettingsService] Client override removed:', key);
			}
		}
	}

	/**
	 * Update server setting (requires authentication)
	 * @param {string} key - Setting key
	 * @param {any} value - Setting value
	 * @param {string} category - Setting category
	 * @param {string} authKey - Authentication key
	 * @param {boolean} isSensitive - Whether this setting contains sensitive data
	 */
	async updateServerSetting(key, value, category, authKey, isSensitive = false) {
		try {
			const response = await fetch(`${this.config.serverUrl}/api/settings`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${authKey}`
				},
				body: JSON.stringify({
					key,
					value,
					category,
					isSensitive
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to update server setting');
			}

			// Reload server settings to get updated values
			await this.loadServerSettings();
			
			if (this.config.debug) {
				console.log('[SettingsService] Server setting updated:', key);
			}
		} catch (error) {
			console.error('[SettingsService] Failed to update server setting:', error);
			throw error;
		}
	}

	/**
	 * Bulk update server settings
	 * @param {Array} settings - Array of setting objects
	 * @param {string} authKey - Authentication key
	 */
	async updateServerSettings(settings, authKey) {
		try {
			const response = await fetch(`${this.config.serverUrl}/api/settings`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${authKey}`
				},
				body: JSON.stringify({ settings })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to update server settings');
			}

			// Reload server settings to get updated values
			await this.loadServerSettings();
			
			if (this.config.debug) {
				console.log('[SettingsService] Server settings bulk updated');
			}
		} catch (error) {
			console.error('[SettingsService] Failed to bulk update server settings:', error);
			throw error;
		}
	}

	/**
	 * Reset client overrides (revert all to server defaults)
	 */
	resetClientOverrides() {
		this.clientOverrides = {};
		this.saveClientOverrides();
		
		if (this.config.debug) {
			console.log('[SettingsService] All client overrides reset');
		}
	}

	/**
	 * Reset specific category of client overrides
	 * @param {string} category - Category to reset
	 */
	resetClientOverridesForCategory(category) {
		if (this.clientOverrides[category]) {
			delete this.clientOverrides[category];
			this.saveClientOverrides();
			
			if (this.config.debug) {
				console.log('[SettingsService] Client overrides reset for category:', category);
			}
		}
	}

	/**
	 * Get fallback defaults when server is unavailable
	 * Only includes settings that are actually used in the application
	 */
	getFallbackDefaults() {
		return {
			global: {
				theme: 'retro' // Used in data-theme attribute setting
			},
			claude: {
				model: 'claude-3-5-sonnet-20241022',
				permissionMode: 'default',
				executable: 'auto',
				maxTurns: null,
				includePartialMessages: false,
				continueConversation: false
			}
		};
	}

	/**
	 * Migrate old client settings format to new structure
	 */
	migrateClientSettings(oldSettings) {
		// If already in new format, return as-is
		if (typeof oldSettings === 'object' && oldSettings !== null) {
			// Check if it's already categorized
			const hasCategories = Object.keys(oldSettings).some(key => 
				typeof oldSettings[key] === 'object' && oldSettings[key] !== null
			);
			
			if (hasCategories) {
				return oldSettings;
			}
		}

		// Migrate from flat structure to categorized
		const migrated = { global: {} };
		
		if (typeof oldSettings === 'object' && oldSettings !== null) {
			for (const [key, value] of Object.entries(oldSettings)) {
				// Skip metadata fields
				if (key === 'lastUpdated') continue;
				
				// Categorize based on key name
				if (key.startsWith('claude') || key.includes('Claude')) {
					if (!migrated.claude) migrated.claude = {};
					migrated.claude[key] = value;
				} else {
					migrated.global[key] = value;
				}
			}
		}

		return migrated;
	}

	/**
	 * Export all settings for backup
	 */
	exportSettings() {
		return {
			timestamp: new Date().toISOString(),
			serverSettings: this.serverSettings,
			clientOverrides: this.clientOverrides,
			version: '1.0'
		};
	}

	/**
	 * Import settings from backup
	 * @param {Object} backup - Exported settings object
	 */
	importSettings(backup) {
		if (backup.version !== '1.0') {
			throw new Error('Unsupported backup version');
		}

		if (backup.clientOverrides) {
			this.clientOverrides = backup.clientOverrides;
			this.saveClientOverrides();
		}

		if (this.config.debug) {
			console.log('[SettingsService] Settings imported from backup');
		}
	}
}

// Create default instance for use across the application
export const settingsService = new SettingsService();