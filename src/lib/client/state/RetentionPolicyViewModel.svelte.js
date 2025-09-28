/**
 * RetentionPolicyViewModel - Manages retention policy settings and preview
 * Uses Svelte 5 runes for reactive state management
 * Follows MVVM pattern with validation and preview capabilities
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
	#apiClient;

	constructor(apiClient) {
		this.#apiClient = apiClient;
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
	 * Load current retention policy from server
	 */
	async loadPolicy() {
		this.isLoading = true;
		try {
			const policy = await this.#apiClient.getRetentionPolicy();
			this.sessionDays = policy.sessionRetentionDays;
			this.logDays = policy.logRetentionDays;
			this.autoCleanup = policy.autoCleanupEnabled;
			this.originalPolicy = policy;
			this.error = null;
		} catch (err) {
			this.error = err.message;
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
			const preview = await this.#apiClient.previewRetentionChanges({
				sessionRetentionDays: this.sessionDays,
				logRetentionDays: this.logDays
			});
			this.previewSummary = preview.summary;
			this.error = null;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.isGeneratingPreview = false;
		}
	}

	/**
	 * Save current policy settings
	 * @returns {object} Updated policy
	 */
	async savePolicy() {
		if (!this.canSave) return;

		this.isSaving = true;
		try {
			const updatedPolicy = await this.#apiClient.updateRetentionPolicy({
				sessionRetentionDays: this.sessionDays,
				logRetentionDays: this.logDays,
				autoCleanupEnabled: this.autoCleanup
			});

			this.originalPolicy = updatedPolicy;
			this.error = null;
			return updatedPolicy;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.isSaving = false;
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
