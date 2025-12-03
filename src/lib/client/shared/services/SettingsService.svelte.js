/**
 * Unified Settings Service with Svelte 5 Runes
 * Handles API communication, client-side caching, and dot-notation access
 * Consolidates previous SettingsService.js and SettingsService.svelte.js
 */

import { SvelteDate } from 'svelte/reactivity';
import { SETTINGS_POLLING_INTERVAL } from '../constants/timing.js';

export class SettingsService {
	constructor(config = {}) {
		this.config = {
			debug: false,
			serverUrl: typeof window !== 'undefined' ? window.location.origin : '',
			...config
		};

		// Internal state - categorized settings from server
		this.settings = $state({}); // e.g., { claude: { model: "..." }, workspace: { envVariables: {} } }
		this.isLoaded = $state(false);
		this.isLoading = $state(false);
		this.lastError = $state(null);
		this.lastSync = $state(null);

		// Initialize if in browser
		if (typeof window !== 'undefined') {
			this.loadSettings();
		}
	}

	/**
	 * Make authenticated API request
	 * Authentication handled via session cookies (credentials: 'include')
	 * @param {string} url - API endpoint URL
	 * @param {Object} options - Fetch options
	 * @returns {Promise<Object>} Response data
	 */
	async makeRequest(url, options = {}) {
		const defaultOptions = {
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			credentials: 'include' // Send session cookie automatically
		};

		const finalOptions = { ...defaultOptions, ...options };
		const response = await fetch(`${this.config.serverUrl}${url}`, finalOptions);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Load all settings from API
	 * Response format: { claude: {...}, workspace: {...}, global: {...}, ... }
	 * @param {string|null} categoryFilter - Optional category to filter by
	 */
	async loadSettings(categoryFilter = null) {
		if (this.isLoading) return;

		this.isLoading = true;
		this.lastError = null;

		try {
			let url = '/api/settings';
			if (categoryFilter) {
				url += `?category=${categoryFilter}`;
			}

			const data = await this.makeRequest(url);

			// Store the categorized settings directly
			this.settings = data;
			this.lastSync = new SvelteDate().toISOString();
			this.isLoaded = true;

			if (this.config.debug) {
				console.log('[SettingsService] Settings loaded:', data);
			}
		} catch (error) {
			this.lastError = `Failed to load settings: ${error.message}`;
			console.warn('[SettingsService]', this.lastError);

			// Use fallback defaults if server is unavailable
			this.settings = this.getFallbackDefaults();
			this.isLoaded = true;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Get setting value using dot notation
	 * @param {string} key - Setting key in format 'category.setting' or 'category.nested.setting'
	 * @param {any} fallback - Fallback value if setting not found
	 * @returns {any} Setting value or fallback
	 */
	get(key, fallback = null) {
		const parts = key.split('.');
		if (parts.length < 2) {
			console.warn('[SettingsService] Invalid setting key format:', key);
			return fallback;
		}

		// Navigate nested object path
		let value = this.settings;
		for (const part of parts) {
			if (value && typeof value === 'object' && part in value) {
				value = value[part];
			} else {
				return fallback;
			}
		}

		return value ?? fallback;
	}

	/**
	 * Get all settings (for ViewModel usage)
	 * @param {string|null} categoryFilter - Optional category filter
	 * @returns {Promise<Object>} All settings or filtered category
	 */
	async getAllSettings(categoryFilter = null) {
		// Ensure settings are loaded
		if (!this.isLoaded && !this.isLoading) {
			await this.loadSettings(categoryFilter);
		}

		// Wait for loading to complete if in progress
		while (this.isLoading) {
			await new Promise((resolve) => setTimeout(resolve, SETTINGS_POLLING_INTERVAL));
		}

		return this.settings;
	}

	/**
	 * Get settings for specific category
	 * @param {string} categoryId - Category ID
	 * @returns {Object} Category settings
	 */
	getCategory(categoryId) {
		return this.settings[categoryId] || {};
	}

	/**
	 * Update settings in a category
	 * @param {string} categoryId - Category ID
	 * @param {Object} updates - Settings key-value pairs to update
	 * @returns {Promise<Object>} Update result
	 */
	async updateCategorySettings(categoryId, updates) {
		const result = await this.makeRequest(`/api/settings/${categoryId}`, {
			method: 'PUT',
			body: JSON.stringify({ settings: updates })
		});

		// Reload to get updated values
		await this.loadSettings();

		return result;
	}

	/**
	 * Get authentication configuration status
	 * @returns {Promise<Object>} Authentication configuration
	 */
	async getAuthConfig() {
		return await this.makeRequest('/api/auth/config');
	}

	/**
	 * Update authentication configuration
	 * @param {Object} authSettings - Authentication settings to update
	 * @returns {Promise<Object>} Update result
	 */
	async updateAuthConfig(authSettings) {
		return await this.makeRequest('/api/auth/config', {
			method: 'PUT',
			body: JSON.stringify(authSettings)
		});
	}

	/**
	 * Fallback defaults when server unavailable
	 * @returns {Object} Default settings structure
	 */
	getFallbackDefaults() {
		return {
			global: {
				theme: 'retro',
				defaultWorkspaceDirectory: ''
			},
			claude: {
				model: 'claude-3-5-sonnet-20241022',
				customSystemPrompt: '',
				appendSystemPrompt: '',
				maxTurns: null,
				maxThinkingTokens: null,
				fallbackModel: '',
				includePartialMessages: false,
				continueConversation: false,
				permissionMode: 'default',
				executable: 'auto',
				executableArgs: '',
				allowedTools: '',
				disallowedTools: '',
				additionalDirectories: '',
				strictMcpConfig: false
			},
			workspace: {
				envVariables: {}
			},
			authentication: {
				terminal_key: null
			},
			onboarding: {
				currentStep: 'auth',
				completedSteps: [],
				isComplete: false,
				firstWorkspaceId: null
			},
			'vscode-tunnel': {
				state: null,
				lastUpdated: null
			}
		};
	}

	/**
	 * Check if service is configured
	 * With cookie-based auth, service is always configured if user is authenticated
	 * @returns {boolean} Always true (auth handled via cookies)
	 */
	isConfigured() {
		return true; // Auth validation happens server-side via session cookies
	}

	/**
	 * Alias for loadSettings() - for backwards compatibility
	 * @param {string|null} categoryFilter - Optional category to filter by
	 */
	async loadServerSettings(categoryFilter = null) {
		return await this.loadSettings(categoryFilter);
	}

	/**
	 * Set client-side override in localStorage
	 * Allows client to override server settings temporarily
	 * @param {string} key - Setting key in format 'category.setting'
	 * @param {any} value - Value to set
	 */
	setClientOverride(key, value) {
		if (typeof localStorage === 'undefined') return;

		try {
			const overrides = this.getClientOverrides();
			overrides[key] = value;
			localStorage.setItem('dispatch-settings-overrides', JSON.stringify(overrides));

			// Update in-memory settings
			const parts = key.split('.');
			if (parts.length >= 2) {
				const category = parts[0];
				const settingPath = parts.slice(1);

				if (!this.settings[category]) {
					this.settings[category] = {};
				}

				// Navigate to nested property and set value
				let target = this.settings[category];
				for (let i = 0; i < settingPath.length - 1; i++) {
					if (!target[settingPath[i]]) {
						target[settingPath[i]] = {};
					}
					target = target[settingPath[i]];
				}
				target[settingPath[settingPath.length - 1]] = value;
			}

			if (this.config.debug) {
				console.log('[SettingsService] Client override set:', key, value);
			}
		} catch (error) {
			console.warn('[SettingsService] Failed to set client override:', error);
		}
	}

	/**
	 * Get all client-side overrides from localStorage
	 * @returns {Object} Client overrides object
	 */
	getClientOverrides() {
		if (typeof localStorage === 'undefined') return {};

		try {
			const stored = localStorage.getItem('dispatch-settings-overrides');
			return stored ? JSON.parse(stored) : {};
		} catch (error) {
			console.warn('[SettingsService] Failed to get client overrides:', error);
			return {};
		}
	}

	/**
	 * Reset client overrides for specific category
	 * @param {string} category - Category to reset (e.g., 'claude', 'workspace')
	 */
	resetClientOverridesForCategory(category) {
		if (typeof localStorage === 'undefined') return;

		try {
			const overrides = this.getClientOverrides();
			const prefix = `${category}.`;

			// Remove all keys starting with category prefix
			Object.keys(overrides).forEach((key) => {
				if (key.startsWith(prefix)) {
					delete overrides[key];
				}
			});

			localStorage.setItem('dispatch-settings-overrides', JSON.stringify(overrides));

			// Reload settings from server to restore defaults
			this.loadSettings();

			if (this.config.debug) {
				console.log('[SettingsService] Client overrides reset for category:', category);
			}
		} catch (error) {
			console.warn('[SettingsService] Failed to reset client overrides:', error);
		}
	}
}

// Create default instance for use across the application
export const settingsService = new SettingsService();
