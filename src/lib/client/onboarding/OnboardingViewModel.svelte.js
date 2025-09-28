/**
 * OnboardingViewModel - Manages onboarding flow state and progression
 * Uses Svelte 5 runes for reactive state management
 * Follows MVVM pattern with clear separation of concerns
 */

export class OnboardingViewModel {
	// State runes for reactive data
	currentStep = $state('auth');
	isComplete = $state(false);
	completedSteps = $state([]);
	isLoading = $state(false);
	error = $state(null);

	// Injected dependencies
	#apiClient;

	constructor(apiClient) {
		this.#apiClient = apiClient;
	}

	// Derived state - computed properties
	get canProceed() {
		return this.validateCurrentStep();
	}

	get progressPercentage() {
		return Math.round((this.completedSteps.length / 4) * 100);
	}

	// Methods for onboarding management

	/**
	 * Validate if user can proceed from current step
	 * @returns {boolean} Whether user can proceed
	 */
	validateCurrentStep() {
		const step = this.currentStep;
		switch (step) {
			case 'auth':
				return true; // Always can proceed from auth
			case 'workspace':
				return this.completedSteps.includes('auth');
			case 'settings':
				return this.completedSteps.includes('workspace');
			case 'complete':
				return this.completedSteps.length >= 2;
			default:
				return false;
		}
	}

	/**
	 * Load current onboarding state from server
	 */
	async loadState() {
		this.isLoading = true;
		try {
			const state = await this.#apiClient.getOnboardingStatus();
			this.currentStep = state.currentStep;
			this.completedSteps = state.completedSteps;
			this.isComplete = state.isComplete;
			this.error = null;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Update progress to specific step
	 * @param {string} step - Target step
	 * @param {object} data - Optional step data
	 */
	async updateStep(step, data = {}) {
		this.isLoading = true;
		try {
			await this.#apiClient.updateProgress(step, data);
			this.currentStep = step;

			// Add to completed steps if not already there
			if (!this.completedSteps.includes(step)) {
				this.completedSteps = [...this.completedSteps, step];
			}

			this.error = null;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Complete the onboarding process
	 * @param {string} workspaceId - Selected workspace ID
	 */
	async complete(workspaceId) {
		this.isLoading = true;
		try {
			await this.#apiClient.completeOnboarding(workspaceId);
			this.currentStep = 'complete';
			this.completedSteps = ['auth', 'workspace', 'settings', 'complete'];
			this.isComplete = true;
			this.error = null;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.isLoading = false;
		}
	}
}
