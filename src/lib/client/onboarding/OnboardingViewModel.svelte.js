/**
 * OnboardingViewModel - Manages onboarding flow state (client-side only)
 * Uses Svelte 5 runes for reactive state management
 * Follows MVVM pattern with clear separation of concerns
 *
 * NOTE: This ViewModel only manages local UI state. It does NOT make
 * intermediate API calls during the onboarding flow. All data is collected
 * locally and submitted in a single atomic operation at the end.
 */

export class OnboardingViewModel {
	// State runes for reactive data (all client-side)
	currentStep = $state('auth');
	isLoading = $state(false);
	error = $state(null);

	// Form data collected during onboarding
	formData = $state({
		terminalKey: '',
		confirmTerminalKey: '',
		workspaceName: '',
		workspacePath: '',
		preferences: {}
	});

	// Injected dependencies
	#apiClient;

	constructor(apiClient) {
		this.#apiClient = apiClient;
	}

	// Derived state - computed properties
	get progressPercentage() {
		const steps = ['auth', 'workspace', 'theme', 'settings', 'complete'];
		const currentIndex = steps.indexOf(this.currentStep);
		return Math.round((currentIndex / (steps.length - 1)) * 100);
	}

	get canProceedFromAuth() {
		return (
			this.formData.terminalKey.length >= 8 &&
			this.formData.terminalKey === this.formData.confirmTerminalKey
		);
	}

	get canProceedFromWorkspace() {
		// Workspace creation is optional - user can skip
		return true;
	}

	// Methods for onboarding management

	/**
	 * Navigate to the next step
	 */
	nextStep() {
		const steps = ['auth', 'workspace', 'theme', 'settings', 'complete'];
		const currentIndex = steps.indexOf(this.currentStep);

		if (currentIndex < steps.length - 1) {
			this.currentStep = steps[currentIndex + 1];
		}
	}

	/**
	 * Navigate to the previous step
	 */
	previousStep() {
		const steps = ['auth', 'workspace', 'theme', 'settings', 'complete'];
		const currentIndex = steps.indexOf(this.currentStep);

		if (currentIndex > 0) {
			this.currentStep = steps[currentIndex - 1];
		}
	}

	/**
	 * Update form data
	 * @param {string} field - Field name
	 * @param {any} value - Field value
	 */
	updateFormData(field, value) {
		this.formData[field] = value;

		// Auto-generate workspace path from workspace name
		if (field === 'workspaceName' && value) {
			const sanitized = value
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '');
			this.formData.workspacePath = `/workspace/${sanitized}`;
		}
	}

	/**
	 * Validate current step
	 * @returns {Object} Validation result with {valid: boolean, errors: string[]}
	 */
	validateCurrentStep() {
		const errors = [];

		switch (this.currentStep) {
			case 'auth':
				if (!this.formData.terminalKey) {
					errors.push('Terminal key is required');
				} else if (this.formData.terminalKey.length < 8) {
					errors.push('Terminal key must be at least 8 characters long');
				}

				if (this.formData.terminalKey !== this.formData.confirmTerminalKey) {
					errors.push('Terminal keys do not match');
				}
				break;

			case 'workspace':
				// Workspace is optional, but if name is provided, path must be too
				if (this.formData.workspaceName && !this.formData.workspacePath) {
					errors.push('Workspace path is required when workspace name is provided');
				}
				break;

			case 'theme':
				// Theme selection is optional - user can skip
				break;

			case 'settings':
				// Settings are all optional
				break;
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Submit the complete onboarding form
	 * This is the ONLY API call made during the onboarding flow
	 * @returns {Promise<{success: boolean, onboarding: object, workspace: object|null}>}
	 */
	async submit() {
		this.isLoading = true;
		this.error = null;

		try {
			// Validate all steps before submission
			const validation = this.validateCurrentStep();
			if (!validation.valid) {
				throw new Error(validation.errors.join(', '));
			}

			// Prepare submission data
			const submissionData = {
				terminalKey: this.formData.terminalKey
			};

			// Include workspace if provided
			if (this.formData.workspaceName && this.formData.workspacePath) {
				submissionData.workspaceName = this.formData.workspaceName;
				submissionData.workspacePath = this.formData.workspacePath;
			}

			// Include preferences if any were set
			if (Object.keys(this.formData.preferences).length > 0) {
				submissionData.preferences = this.formData.preferences;
			}

			// Submit to API (single atomic operation)
			const result = await this.#apiClient.submitOnboarding(submissionData);

			// Mark as complete
			this.currentStep = 'complete';

			return result;
		} catch (err) {
			this.error = err.message || 'Failed to complete onboarding';
			throw err;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Reset the form (for testing or retry)
	 */
	reset() {
		this.currentStep = 'auth';
		this.isLoading = false;
		this.error = null;
		this.formData = {
			terminalKey: '',
			confirmTerminalKey: '',
			workspaceName: '',
			workspacePath: '',
			preferences: {}
		};
	}
}
