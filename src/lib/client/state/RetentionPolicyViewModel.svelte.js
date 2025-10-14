/**
 * RetentionPolicyViewModel - Manages retention policy settings via settings table
 * Uses Svelte 5 runes for reactive state management
 * Follows MVVM pattern with validation and preview capabilities
 *
 * CONSOLIDATED ARCHITECTURE:
 * - Retention policies stored in settings table under 'maintenance' category
 * - Uses SettingsService for settings management
 * - Cleanup operations via /api/maintenance endpoint
 */

export class RetentionPolicyViewModel {
	// State runes for reactive data
	sessionDays = $state(30);
	logDays = $state(7);
	autoCleanup = $state(true);
	isLoading = $state(false);
	isSaving = $state(false);
	isGeneratingPreview = $state(false);
	error = $state(null);
	previewSummary = $state('');
	originalPolicy = $state(null);

	// Injected dependencies
	#settingsService;

	/**
	 * Create RetentionPolicyViewModel
	 * @param {import('$lib/client/shared/services/SettingsService.svelte.js').SettingsService} settingsService - Settings manager
	 */
	constructor(settingsService) {
		this.#settingsService = settingsService;
	}

	// Derived state - computed properties
	get hasChanges() {
		if (!this.originalPolicy) return false;
		return (
			this.sessionDays !== this.originalPolicy.sessionRetentionDays ||
			this.logDays !== this.originalPolicy.logRetentionDays ||
			this.autoCleanup !== this.originalPolicy.autoCleanupEnabled
		);
	}

	get isValid() {
		return this.validatePolicy();
	}

	get canSave() {
		return this.isValid && this.hasChanges && !this.isSaving;
	}

	// Methods for retention policy management

	/**
	 * Validate current policy settings
	 * @returns {boolean} Whether policy is valid
	 */
	validatePolicy() {
		return (
			this.sessionDays >= 1 && this.sessionDays <= 365 && this.logDays >= 1 && this.logDays <= 90
		);
	}

	/**
	 * Load current retention policy from settings
	 */
	async loadPolicy() {
		this.isLoading = true;
		try {
			// Load maintenance settings via SettingsService
			const maintenanceSettings = await this.#settingsService.getCategory('maintenance');

			// Use defaults if settings don't exist
			this.sessionDays = maintenanceSettings.sessionRetentionDays || 30;
			this.logDays = maintenanceSettings.logRetentionDays || 7;
			this.autoCleanup = maintenanceSettings.autoCleanupEnabled ?? true;

			// Store original policy for change tracking
			this.originalPolicy = {
				sessionRetentionDays: this.sessionDays,
				logRetentionDays: this.logDays,
				autoCleanupEnabled: this.autoCleanup
			};

			this.error = null;
		} catch (err) {
			this.error = err.message || 'Failed to load retention policy';
			console.error('Failed to load retention policy:', err);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Generate preview of retention changes
	 */
	async generatePreview() {
		if (!this.isValid) return;

		this.isGeneratingPreview = true;
		try {
			// Save policy first if changed (preview uses current settings from DB)
			if (this.hasChanges) {
				await this.savePolicy();
			}

			// Call maintenance API for preview
			const response = await fetch('/api/maintenance', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					action: 'preview'
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to generate preview');
			}

			const data = await response.json();
			this.previewSummary = data.preview.summary;
			this.error = null;
		} catch (err) {
			this.error = err.message || 'Failed to generate preview';
			console.error('Failed to generate preview:', err);
		} finally {
			this.isGeneratingPreview = false;
		}
	}

	/**
	 * Save current policy settings
	 * @returns {Promise<object>} Updated policy
	 */
	async savePolicy() {
		if (!this.canSave) return;

		this.isSaving = true;
		try {
			// Save via SettingsService (maintenance category)
			await this.#settingsService.updateCategorySettings('maintenance', {
				sessionRetentionDays: this.sessionDays,
				logRetentionDays: this.logDays,
				autoCleanupEnabled: this.autoCleanup
			});

			// Update original policy tracking
			this.originalPolicy = {
				sessionRetentionDays: this.sessionDays,
				logRetentionDays: this.logDays,
				autoCleanupEnabled: this.autoCleanup
			};

			this.error = null;
			return this.originalPolicy;
		} catch (err) {
			this.error = err.message || 'Failed to save retention policy';
			console.error('Failed to save retention policy:', err);
			throw err;
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Execute cleanup operation
	 */
	async executeCleanup() {
		try {
			// Call maintenance API for cleanup
			const response = await fetch('/api/maintenance', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					action: 'cleanup'
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to execute cleanup');
			}

			const data = await response.json();
			return data.cleanup;
		} catch (err) {
			this.error = err.message || 'Failed to execute cleanup';
			console.error('Failed to execute cleanup:', err);
			throw err;
		}
	}

	/**
	 * Reset settings to default values
	 */
	resetToDefaults() {
		this.sessionDays = 30;
		this.logDays = 7;
		this.autoCleanup = true;
	}

	/**
	 * Reset settings to original loaded values
	 */
	resetToOriginal() {
		if (this.originalPolicy) {
			this.sessionDays = this.originalPolicy.sessionRetentionDays;
			this.logDays = this.originalPolicy.logRetentionDays;
			this.autoCleanup = this.originalPolicy.autoCleanupEnabled;
		}
	}
}
