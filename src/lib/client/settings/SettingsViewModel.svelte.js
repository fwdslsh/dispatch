/**
 * SettingsViewModel - Svelte 5 State Management
 * Manages settings state with reactive $state runes and MVVM pattern
 */

/**
 * Settings category structure
 * @typedef {Object} SettingsCategory
 * @property {string} id - Category ID
 * @property {string} name - Display name
 * @property {string} description - Category description
 * @property {number} display_order - Display order
 */

/**
 * Configuration setting structure
 * @typedef {Object} ConfigurationSetting
 * @property {string} key - Setting key
 * @property {string} category_id - Category ID
 * @property {string} name - Display name
 * @property {string} description - Description
 * @property {string} type - Setting type
 * @property {string|null} current_value - Current value
 * @property {string|null} default_value - Default value
 * @property {string|null} env_var_name - Environment variable name
 * @property {boolean} is_sensitive - Whether to mask in UI
 * @property {boolean} is_required - Whether required
 * @property {string|null} validation_pattern - Validation regex
 * @property {string|null} resolved_value - Resolved value
 * @property {string|null} display_value - Display-safe value
 */

export class SettingsViewModel {
	/**
	 * Create SettingsViewModel instance
	 * @param {Object} settingsService - Settings API service
	 */
	constructor(settingsService) {
		this.settingsService = settingsService;

		// Reactive state using Svelte 5 $state runes
		this.categories = $state([]);
		this.settings = $state([]);
		this.loading = $state(false);
		this.saving = $state(false);
		this.error = $state(null);
		this.successMessage = $state(null);
		// Use plain objects instead of Maps for reactivity
		this.validationErrors = $state({});
		this.pendingChanges = $state({});
		this.authConfig = $state({
			terminal_key_set: false,
			oauth_configured: false,
			oauth_client_id: null,
			oauth_redirect_uri: null
		});

		// Derived state
		this.settingsByCategory = $derived.by(() => {
			return this.categories.map((category) => ({
				...category,
				settings: this.settings.filter((setting) => setting.category_id === category.id)
			}));
		});

		this.settingsByKey = $derived.by(() => {
			const map = new Map();
			this.settings.forEach((setting) => {
				map.set(setting.key, setting);
			});
			return map;
		});

		this.hasUnsavedChanges = $derived.by(() => {
			return Object.keys(this.pendingChanges).length > 0;
		});

		this.hasValidationErrors = $derived.by(() => {
			return Object.keys(this.validationErrors).length > 0;
		});

		this.canSave = $derived.by(() => {
			return this.hasUnsavedChanges && !this.hasValidationErrors && !this.saving;
		});

		// Authentication-specific derived state
		this.authenticationSettings = $derived.by(() => {
			return this.settings.filter((setting) => setting.category_id === 'authentication');
		});

		this.terminalKeySetting = $derived.by(() => {
			return this.settingsByKey.get('terminal_key');
		});

		this.oauthSettings = $derived.by(() => {
			return this.settings.filter(
				(setting) => setting.category_id === 'authentication' && setting.key.startsWith('oauth_')
			);
		});

		this.oauthClientIdSetting = $derived.by(() => {
			return this.settingsByKey.get('oauth_client_id');
		});

		this.oauthClientSecretSetting = $derived.by(() => {
			return this.settingsByKey.get('oauth_client_secret');
		});

		this.oauthRedirectUriSetting = $derived.by(() => {
			return this.settingsByKey.get('oauth_redirect_uri');
		});

		this.oauthScopeSetting = $derived.by(() => {
			return this.settingsByKey.get('oauth_scope');
		});

		// Global settings derived state
		this.workspaceSettings = $derived.by(() => {
			return this.settings.filter((setting) => setting.category_id === 'workspace');
		});

		this.uiSettings = $derived.by(() => {
			return this.settings.filter((setting) => setting.category_id === 'ui');
		});

		this.systemSettings = $derived.by(() => {
			return this.settings.filter((setting) => setting.category_id === 'system');
		});
	}

	/**
	 * Load all settings from the API
	 * @param {string|null} categoryFilter - Optional category to filter by
	 */
	async loadSettings(categoryFilter = null) {
		this.loading = true;
		this.error = null;

		try {
			const result = await this.settingsService.getAllSettings(categoryFilter);

			this.categories = result.categories;
			this.settings = result.settings;

			// Clear pending changes when loading fresh data
			this.pendingChanges = {};
			this.validationErrors = {};
		} catch (error) {
			console.error('Failed to load settings:', error);
			this.error = 'Failed to load settings. Please try again.';
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load authentication configuration
	 */
	async loadAuthConfig() {
		try {
			const config = await this.settingsService.getAuthConfig();
			this.authConfig = config;
		} catch (error) {
			console.error('Failed to load auth config:', error);
			this.error = 'Failed to load authentication configuration.';
		}
	}

	/**
	 * Update a setting value
	 * @param {string} key - Setting key
	 * @param {string} value - New value
	 */
	updateSetting(key, value) {
		const setting = this.settingsByKey.get(key);
		if (!setting) {
			console.error(`Setting '${key}' not found`);
			return;
		}

		// Store pending change - create new object for reactivity
		this.pendingChanges = { ...this.pendingChanges, [key]: value };

		// Validate the new value
		this.validateSetting(key, value);

		// Clear success message when making changes
		this.successMessage = null;
	}

	/**
	 * Validate a setting value
	 * @param {string} key - Setting key
	 * @param {string} value - Value to validate
	 */
	validateSetting(key, value) {
		const setting = this.settingsByKey.get(key);
		if (!setting) return;

		const errors = [];

		// Required validation
		if (setting.is_required && (!value || value.trim().length === 0)) {
			errors.push(`${setting.name} is required`);
		}

		// Type-specific validation
		if (value && value.trim().length > 0) {
			switch (setting.type) {
				case 'number':
					if (isNaN(Number(value))) {
						errors.push(`${setting.name} must be a valid number`);
					}
					break;
				case 'boolean':
					if (!['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase())) {
						errors.push(`${setting.name} must be a boolean value`);
					}
					break;
				case 'url':
					try {
						new URL(value);
					} catch {
						errors.push(`${setting.name} must be a valid URL`);
					}
					break;
				case 'path':
					if (!value.startsWith('/')) {
						errors.push(`${setting.name} must be an absolute path`);
					}
					break;
			}

			// Pattern validation
			if (setting.validation_pattern) {
				try {
					const regex = new RegExp(setting.validation_pattern);
					if (!regex.test(value)) {
						errors.push(`${setting.name} does not match the required format`);
					}
				} catch {
					errors.push(`Invalid validation pattern for ${setting.name}`);
				}
			}

			// Special validations
			if (key === 'terminal_key' && value.length < 8) {
				errors.push('Terminal key must be at least 8 characters long');
			}
		}

		// Update validation errors - create new object for reactivity
		if (errors.length > 0) {
			this.validationErrors = { ...this.validationErrors, [key]: errors };
		} else {
			const { [key]: _, ...rest } = this.validationErrors;
			this.validationErrors = rest;
		}
	}

	/**
	 * Get current value for a setting (including pending changes)
	 * @param {string} key - Setting key
	 * @returns {string} Current value
	 */
	getCurrentValue(key) {
		// Check for pending changes first
		if (key in this.pendingChanges) {
			return this.pendingChanges[key];
		}

		// Get from current setting
		const setting = this.settingsByKey.get(key);
		return setting?.display_value || setting?.resolved_value || '';
	}

	/**
	 * Get validation errors for a setting
	 * @param {string} key - Setting key
	 * @returns {Array<string>} Validation errors
	 */
	getValidationErrors(key) {
		return this.validationErrors[key] || [];
	}

	/**
	 * Save settings for a category
	 * @param {string} categoryId - Category ID
	 */
	async saveCategory(categoryId) {
		const categoryChanges = {};

		// Collect changes for this category
		for (const [key, value] of Object.entries(this.pendingChanges)) {
			const setting = this.settingsByKey.get(key);
			if (setting?.category_id === categoryId) {
				categoryChanges[key] = value;
			}
		}

		if (Object.keys(categoryChanges).length === 0) {
			return;
		}

		// Check for validation errors in this category
		const categoryErrors = [];
		for (const key of Object.keys(categoryChanges)) {
			const errors = this.getValidationErrors(key);
			if (errors.length > 0) {
				categoryErrors.push(...errors);
			}
		}

		if (categoryErrors.length > 0) {
			this.error = 'Please fix validation errors before saving.';
			return;
		}

		this.saving = true;
		this.error = null;

		try {
			const result = await this.settingsService.updateCategorySettings(categoryId, categoryChanges);

			// Handle session invalidation warning
			if (result.session_invalidated) {
				this.successMessage =
					'Settings saved successfully. All sessions have been invalidated for security.';
			} else {
				this.successMessage = 'Settings saved successfully.';
			}

			// Remove saved changes from pending - create new object
			const newPending = { ...this.pendingChanges };
			for (const key of Object.keys(categoryChanges)) {
				delete newPending[key];
			}
			this.pendingChanges = newPending;

			// Reload settings to get updated values
			await this.loadSettings();

			// If authentication category was updated, reload auth config
			if (categoryId === 'authentication') {
				await this.loadAuthConfig();
			}
		} catch (error) {
			console.error('Failed to save settings:', error);
			this.error = error.message || 'Failed to save settings. Please try again.';
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Save all pending changes
	 */
	async saveAll() {
		if (!this.hasUnsavedChanges) {
			return;
		}

		// Group changes by category
		const changesByCategory = {};
		for (const [key, value] of Object.entries(this.pendingChanges)) {
			const setting = this.settingsByKey.get(key);
			if (setting) {
				if (!changesByCategory[setting.category_id]) {
					changesByCategory[setting.category_id] = {};
				}
				changesByCategory[setting.category_id][key] = value;
			}
		}

		// Save each category
		for (const categoryId of Object.keys(changesByCategory)) {
			await this.saveCategory(categoryId);

			// Stop if there was an error
			if (this.error) {
				break;
			}
		}
	}

	/**
	 * Discard all pending changes
	 */
	discardChanges() {
		this.pendingChanges = {};
		this.validationErrors = {};
		this.error = null;
		this.successMessage = null;
	}

	/**
	 * Discard changes for a specific setting
	 * @param {string} key - Setting key
	 */
	discardSetting(key) {
		const { [key]: _, ...restPending } = this.pendingChanges;
		const { [key]: __, ...restErrors } = this.validationErrors;
		this.pendingChanges = restPending;
		this.validationErrors = restErrors;
	}

	/**
	 * Clear all messages
	 */
	clearMessages() {
		this.error = null;
		this.successMessage = null;
	}

	/**
	 * Check if a setting has unsaved changes
	 * @param {string} key - Setting key
	 * @returns {boolean} Whether setting has changes
	 */
	hasChanges(key) {
		return key in this.pendingChanges;
	}

	/**
	 * Check if a category has unsaved changes
	 * @param {string} categoryId - Category ID
	 * @returns {boolean} Whether category has changes
	 */
	categoryHasChanges(categoryId) {
		for (const key of Object.keys(this.pendingChanges)) {
			const setting = this.settingsByKey.get(key);
			if (setting?.category_id === categoryId) {
				return true;
			}
		}
		return false;
	}
}
