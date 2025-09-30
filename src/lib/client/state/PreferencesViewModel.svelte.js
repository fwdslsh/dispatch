/**
 * PreferencesViewModel - User preferences state management
 * Manages preference loading, validation, and persistence following MVVM pattern
 */

/**
 * Preference structure
 * @typedef {Object} Preferences
 * @property {Object} ui - UI preferences
 * @property {string} ui.theme - Theme selection (light, dark, auto)
 * @property {boolean} ui.showWorkspaceInTitle - Show workspace in title
 * @property {number} ui.autoHideInactiveTabsMinutes - Auto-hide inactive tabs
 * @property {Object} auth - Authentication preferences
 * @property {number} auth.sessionDuration - Session duration in days
 * @property {boolean} auth.rememberLastWorkspace - Remember last workspace
 * @property {Object} workspace - Workspace preferences
 * @property {string} workspace.defaultPath - Default workspace path
 * @property {boolean} workspace.autoCreateMissingDirectories - Auto-create directories
 * @property {Object} terminal - Terminal preferences
 * @property {number} terminal.fontSize - Font size in pixels
 * @property {string} terminal.fontFamily - Font family
 * @property {number} terminal.scrollback - Scrollback buffer lines
 */

export class PreferencesViewModel {
	/**
	 * Create PreferencesViewModel instance
	 * @param {Object} apiClient - API client service
	 * @param {string} authKey - Authentication key
	 */
	constructor(apiClient, authKey) {
		this.apiClient = apiClient;
		this.authKey = authKey;

		// Create default preferences structure
		const defaultPreferences = {
			ui: {
				theme: 'auto',
				showWorkspaceInTitle: true,
				autoHideInactiveTabsMinutes: 0
			},
			auth: {
				sessionDuration: 30,
				rememberLastWorkspace: true
			},
			workspace: {
				defaultPath: '',
				autoCreateMissingDirectories: true
			},
			terminal: {
				fontSize: 14,
				fontFamily: 'Monaco, monospace',
				scrollback: 1000
			}
		};

		// Reactive state using Svelte 5 $state runes
		this.preferences = $state(structuredClone(defaultPreferences));
		this.originalPreferences = $state.raw(structuredClone(defaultPreferences));
		this.isLoading = $state(false);
		this.isSaving = $state(false);
		this.error = $state(null);
		this.successMessage = $state(null);

		// Derived state
		this.hasChanges = $derived.by(() => {
			return (
				JSON.stringify($state.snapshot(this.preferences)) !==
				JSON.stringify(this.originalPreferences)
			);
		});

		this.canSave = $derived.by(() => {
			return this.hasChanges && !this.isSaving;
		});
	}

	/**
	 * Load preferences from API
	 * @returns {Promise<void>}
	 */
	async loadPreferences() {
		this.isLoading = true;
		this.error = null;

		try {
			if (!this.apiClient) {
				throw new Error('API client not available');
			}

			if (!this.authKey) {
				throw new Error('Authentication required');
			}

			const response = await fetch(`/api/preferences?authKey=${this.authKey}`);
			if (!response.ok) {
				throw new Error('Failed to load preferences');
			}

			const data = await response.json();
			const current = $state.snapshot(this.preferences);

			// Merge loaded preferences with current structure
			this.preferences = {
				ui: { ...current.ui, ...data.ui },
				auth: { ...current.auth, ...data.auth },
				workspace: { ...current.workspace, ...data.workspace },
				terminal: { ...current.terminal, ...data.terminal }
			};

			this.originalPreferences = structuredClone($state.snapshot(this.preferences));
		} catch (err) {
			this.error = err.message || 'Failed to load preferences';
			throw err;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Save preferences to API
	 * @param {Function} onSaveCallback - Optional callback after successful save
	 * @returns {Promise<void>}
	 */
	async savePreferences(onSaveCallback = null) {
		if (!this.canSave) return;

		this.isSaving = true;
		this.error = null;
		this.successMessage = null;

		try {
			if (!this.authKey) {
				throw new Error('Authentication required');
			}

			const preferencesSnapshot = $state.snapshot(this.preferences);

			// Save each category
			for (const [category, categoryPrefs] of Object.entries(preferencesSnapshot)) {
				const response = await fetch('/api/preferences', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						authKey: this.authKey,
						category,
						preferences: categoryPrefs
					})
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || `Failed to save ${category} preferences`);
				}
			}

			this.originalPreferences = structuredClone(preferencesSnapshot);
			this.successMessage = 'Preferences saved successfully';

			// Call callback if provided
			if (onSaveCallback) {
				onSaveCallback(preferencesSnapshot);
			}

			// Clear success message after 3 seconds
			setTimeout(() => {
				this.successMessage = null;
			}, 3000);
		} catch (err) {
			this.error = err.message || 'Failed to save preferences';
			throw err;
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Reset preferences to defaults
	 * @returns {Promise<void>}
	 */
	async resetToDefaults() {
		try {
			if (!this.authKey) {
				throw new Error('Authentication required');
			}

			// Reset each category
			for (const category of Object.keys($state.snapshot(this.preferences))) {
				const response = await fetch('/api/preferences', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'reset',
						authKey: this.authKey,
						category
					})
				});

				if (!response.ok) {
					throw new Error(`Failed to reset ${category} preferences`);
				}
			}

			// Reload preferences from server
			await this.loadPreferences();
			this.successMessage = 'Preferences reset to defaults';
		} catch (err) {
			this.error = err.message || 'Failed to reset preferences';
			throw err;
		}
	}

	/**
	 * Discard unsaved changes
	 */
	discardChanges() {
		this.preferences = structuredClone(this.originalPreferences);
		this.error = null;
		this.successMessage = null;
	}

	/**
	 * Update a specific preference value
	 * @param {string} category - Preference category
	 * @param {string} key - Preference key
	 * @param {any} value - New value
	 */
	updatePreference(category, key, value) {
		if (!this.preferences[category]) {
			console.error(`Invalid preference category: ${category}`);
			return;
		}

		// Create new object for reactivity
		this.preferences = {
			...this.preferences,
			[category]: {
				...this.preferences[category],
				[key]: value
			}
		};

		// Clear success message when making changes
		this.successMessage = null;
	}

	/**
	 * Get a specific preference value
	 * @param {string} category - Preference category
	 * @param {string} key - Preference key
	 * @returns {any} Preference value
	 */
	getPreference(category, key) {
		return this.preferences[category]?.[key];
	}

	/**
	 * Clear error message
	 */
	clearError() {
		this.error = null;
	}

	/**
	 * Clear success message
	 */
	clearSuccess() {
		this.successMessage = null;
	}
}