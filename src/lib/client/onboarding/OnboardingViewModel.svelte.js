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
	currentStep = $state('workspace');
	isLoading = $state(false);
	error = $state(null);

	// Form data collected during onboarding
	formData = $state({
		workspaceName: '',
		workspacePath: '',
		selectedTheme: '', // Theme ID selected during onboarding
		preferences: {}
	});

	// Note: apiClient parameter is accepted for future use but not currently needed
	// All data is collected locally and submitted via SvelteKit form action
	constructor(_apiClient) {
		// No API calls are made during onboarding flow
		// Data is submitted atomically at the end via form action
	}

	// Derived state - computed properties
	get progressPercentage() {
		const steps = ['workspace', 'theme', 'settings', 'complete'];
		const currentIndex = steps.indexOf(this.currentStep);
		return Math.round((currentIndex / (steps.length - 1)) * 100);
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
		const steps = ['workspace', 'theme', 'settings', 'complete'];
		const currentIndex = steps.indexOf(this.currentStep);

		if (currentIndex < steps.length - 1) {
			this.currentStep = steps[currentIndex + 1];
		}
	}

	/**
	 * Navigate to the previous step
	 */
	previousStep() {
		const steps = ['workspace', 'theme', 'settings', 'complete'];
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
	 * Reset the form (for testing or retry)
	 */
	reset() {
		this.currentStep = 'workspace';
		this.isLoading = false;
		this.error = null;
		this.formData = {
			workspaceName: '',
			workspacePath: '',
			selectedTheme: '',
			preferences: {}
		};
	}
}
