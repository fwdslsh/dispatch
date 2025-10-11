/**
 * SettingsViewModel - Simplified Svelte 5 State Management
 * Works directly with nested JSON structure from API without flattening
 * Follows MVVM pattern with minimal complexity
 */

export class SettingsViewModel {
	/**
	 * Create SettingsViewModel instance
	 * @param {Object} settingsService - Settings API service
	 */
	constructor(settingsService) {
		this.settingsService = settingsService;

		// Store nested structure directly with $state for reactivity
		this.categories = $state({
			global: {},
			claude: {},
			workspace: {},
			authentication: {},
			onboarding: {},
			'vscode-tunnel': {}
		});

		// Track original values for change detection (deep clone)
		this.originalCategories = {};

		// UI state
		this.loading = $state(false);
		this.saving = $state(false);
		this.error = $state(null);
		this.successMessage = $state(null);
		/** @type {Record<string, string[]>} */
		this.validationErrors = $state({}); // category.field -> error array

		// Derived state - automatic change detection per category
		this.categoryChanges = $derived.by(() => {
			const changes = {};
			for (const [categoryId, currentData] of Object.entries(this.categories)) {
				if (this._hasDeepChanges(categoryId)) {
					changes[categoryId] = currentData;
				}
			}
			return changes;
		});

		this.hasUnsavedChanges = $derived(Object.keys(this.categoryChanges).length > 0);

		this.hasValidationErrors = $derived(Object.keys(this.validationErrors).length > 0);

		this.canSave = $derived(this.hasUnsavedChanges && !this.hasValidationErrors && !this.saving);
	}

	/**
	 * Load settings from API
	 * @param {string|null} categoryFilter - Optional category to filter by
	 */
	async loadSettings(categoryFilter = null) {
		this.loading = true;
		this.error = null;

		try {
			const data = await this.settingsService.getAllSettings(categoryFilter);

			// Update nested structure directly - mutate existing $state
			this.categories.global = data.global || {};
			this.categories.claude = data.claude || {};
			this.categories.workspace = data.workspace || {};
			this.categories.authentication = data.authentication || {};
			this.categories.onboarding = data.onboarding || {};
			this.categories['vscode-tunnel'] = data['vscode-tunnel'] || {};

			// Deep clone for comparison
			this.originalCategories = this._deepClone(this.categories);

			// Clear state
			/** @type {Record<string, string[]>} */
			this.validationErrors = {};
			this.successMessage = null;
		} catch (error) {
			console.error('Failed to load settings:', error);
			this.error = 'Failed to load settings. Please try again.';
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Get reactive category object for component binding
	 * @param {string} categoryId - Category ID
	 * @returns {Object} Reactive category object
	 */
	getCategory(categoryId) {
		return this.categories[categoryId] || {};
	}

	/**
	 * Validate a specific field in a category
	 * @param {string} categoryId - Category ID
	 * @param {string} fieldPath - Field path (dot notation for nested, e.g., 'envVariables.NODE_ENV')
	 * @param {any} value - Value to validate
	 */
	validateField(categoryId, fieldPath, value) {
		const errors = [];
		const key = `${categoryId}.${fieldPath}`;

		// Required validation
		if (this._isFieldRequired(categoryId, fieldPath) && !value) {
			errors.push(`${this._getFieldLabel(fieldPath)} is required`);
		}

		// Type-specific validation
		if (value) {
			const fieldType = this._inferFieldType(fieldPath, value);

			switch (fieldType) {
				case 'NUMBER':
					if (isNaN(Number(value))) {
						errors.push(`Must be a valid number`);
					}
					break;
				case 'URL':
					try {
						new URL(value);
					} catch {
						errors.push(`Must be a valid URL`);
					}
					break;
				case 'PATH':
					if (typeof value === 'string' && !value.startsWith('/')) {
						errors.push(`Must be an absolute path`);
					}
					break;
			}
		}

		// Special validations
		if (categoryId === 'authentication' && fieldPath === 'terminal_key') {
			if (value && value.length < 8) {
				errors.push('Terminal key must be at least 8 characters');
			}
		}

		// Update validation errors - create new object for reactivity
		if (errors.length > 0) {
			this.validationErrors = { ...this.validationErrors, [key]: errors };
		} else {
			const { [key]: _unused, ...rest } = this.validationErrors;
			this.validationErrors = rest;
		}
	}

	/**
	 * Save a specific category
	 * @param {string} categoryId - Category ID
	 */
	async saveCategory(categoryId) {
		// Check for validation errors in this category
		const categoryErrors = Object.keys(this.validationErrors).filter((key) =>
			key.startsWith(`${categoryId}.`)
		);

		if (categoryErrors.length > 0) {
			this.error = 'Please fix validation errors before saving.';
			return;
		}

		// No changes to save
		if (!this.categoryChanges[categoryId]) {
			this.successMessage = 'No changes to save.';
			return;
		}

		this.saving = true;
		this.error = null;

		try {
			// Send nested structure directly - no reconstruction needed!
			const result = await this.settingsService.updateCategorySettings(
				categoryId,
				this.categories[categoryId]
			);

			// Handle session invalidation
			if (result.session_invalidated) {
				this.successMessage = 'Settings saved. All sessions invalidated for security.';
			} else {
				this.successMessage = 'Settings saved successfully.';
			}

			// Update original to reflect saved state
			this.originalCategories[categoryId] = this._deepClone(this.categories[categoryId]);

			// Reload settings to get any server-side updates
			await this.loadSettings();
		} catch (error) {
			console.error('Failed to save settings:', error);
			this.error = error.message || 'Failed to save settings. Please try again.';
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Discard changes for a category
	 * @param {string} categoryId - Category ID
	 */
	discardCategory(categoryId) {
		// Restore from original
		this.categories[categoryId] = this._deepClone(this.originalCategories[categoryId]);

		// Clear validation errors for this category
		const errorsToRemove = Object.keys(this.validationErrors).filter((key) =>
			key.startsWith(`${categoryId}.`)
		);

		const newErrors = { ...this.validationErrors };
		errorsToRemove.forEach((key) => delete newErrors[key]);
		this.validationErrors = newErrors;

		this.successMessage = null;
		this.error = null;
	}

	/**
	 * Check if category has unsaved changes
	 * @param {string} categoryId - Category ID
	 * @returns {boolean}
	 */
	categoryHasChanges(categoryId) {
		return Boolean(this.categoryChanges[categoryId]);
	}

	/**
	 * Get validation errors for a field
	 * @param {string} categoryId - Category ID
	 * @param {string} fieldPath - Field path
	 * @returns {Array<string>} Validation errors
	 */
	getFieldErrors(categoryId, fieldPath) {
		return this.validationErrors[`${categoryId}.${fieldPath}`] || [];
	}

	/**
	 * Clear all messages
	 */
	clearMessages() {
		this.error = null;
		this.successMessage = null;
	}

	// Private helper methods

	_hasDeepChanges(categoryId) {
		return (
			JSON.stringify(this.categories[categoryId]) !==
			JSON.stringify(this.originalCategories[categoryId])
		);
	}

	_deepClone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	_isFieldRequired(categoryId, fieldPath) {
		const requiredFields = {
			authentication: ['terminal_key']
		};
		return requiredFields[categoryId]?.includes(fieldPath) || false;
	}

	_getFieldLabel(fieldPath) {
		// Convert camelCase or snake_case to Title Case
		// Extract last part of path for nested fields
		const lastPart = fieldPath.split('.').pop();
		return lastPart
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ')
			.trim();
	}

	_inferFieldType(fieldPath, value) {
		if (typeof value === 'boolean') return 'BOOLEAN';
		if (typeof value === 'number') return 'NUMBER';
		if (fieldPath.includes('path') || fieldPath.includes('directory')) return 'PATH';
		if (fieldPath.includes('url')) return 'URL';
		return 'STRING';
	}
}
