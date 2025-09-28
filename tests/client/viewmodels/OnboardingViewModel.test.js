import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Svelte runes for testing
const createMockState = (initialValue) => {
	let value = initialValue;
	return {
		get value() { return value; },
		set value(newValue) { value = newValue; }
	};
};

const createMockDerived = (fn) => {
	return {
		get value() { return fn(); }
	};
};

describe('OnboardingViewModel', () => {
	let mockApiClient;
	let viewModel;

	beforeEach(() => {
		mockApiClient = {
			getOnboardingStatus: vi.fn(),
			updateProgress: vi.fn(),
			completeOnboarding: vi.fn()
		};

		// Mock ViewModel structure using Svelte 5 runes pattern
		viewModel = {
			// State runes
			currentStep: createMockState('auth'),
			isComplete: createMockState(false),
			completedSteps: createMockState([]),
			isLoading: createMockState(false),
			error: createMockState(null),

			// Derived state
			get canProceed() {
				return this.validateCurrentStep();
			},
			get progressPercentage() {
				return Math.round((this.completedSteps.value.length / 4) * 100);
			},

			// Methods
			validateCurrentStep() {
				const step = this.currentStep.value;
				switch (step) {
					case 'auth': return true; // Always can proceed from auth
					case 'workspace': return this.completedSteps.value.includes('auth');
					case 'settings': return this.completedSteps.value.includes('workspace');
					case 'complete': return this.completedSteps.value.length >= 2;
					default: return false;
				}
			},

			async loadState() {
				this.isLoading.value = true;
				try {
					const state = await mockApiClient.getOnboardingStatus();
					this.currentStep.value = state.currentStep;
					this.completedSteps.value = state.completedSteps;
					this.isComplete.value = state.isComplete;
					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
				} finally {
					this.isLoading.value = false;
				}
			},

			async updateStep(step, data = {}) {
				this.isLoading.value = true;
				try {
					await mockApiClient.updateProgress(step, data);
					this.currentStep.value = step;

					// Add to completed steps if not already there
					if (!this.completedSteps.value.includes(step)) {
						this.completedSteps.value = [...this.completedSteps.value, step];
					}

					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
				} finally {
					this.isLoading.value = false;
				}
			},

			async complete(workspaceId) {
				this.isLoading.value = true;
				try {
					await mockApiClient.completeOnboarding(workspaceId);
					this.currentStep.value = 'complete';
					this.completedSteps.value = ['auth', 'workspace', 'settings', 'complete'];
					this.isComplete.value = true;
					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
				} finally {
					this.isLoading.value = false;
				}
			}
		};
	});

	it('should initialize with auth step', () => {
		expect(viewModel.currentStep.value).toBe('auth');
		expect(viewModel.isComplete.value).toBe(false);
		expect(viewModel.completedSteps.value).toEqual([]);
		expect(viewModel.progressPercentage).toBe(0);
	});

	it('should load state from API', async () => {
		const mockState = {
			currentStep: 'workspace',
			completedSteps: ['auth'],
			isComplete: false
		};

		mockApiClient.getOnboardingStatus.mockResolvedValue(mockState);

		await viewModel.loadState();

		expect(viewModel.currentStep.value).toBe('workspace');
		expect(viewModel.completedSteps.value).toEqual(['auth']);
		expect(viewModel.isComplete.value).toBe(false);
		expect(viewModel.error.value).toBeNull();
	});

	it('should calculate progress percentage correctly', () => {
		// 0 steps = 0%
		viewModel.completedSteps.value = [];
		expect(viewModel.progressPercentage).toBe(0);

		// 1 step = 25%
		viewModel.completedSteps.value = ['auth'];
		expect(viewModel.progressPercentage).toBe(25);

		// 2 steps = 50%
		viewModel.completedSteps.value = ['auth', 'workspace'];
		expect(viewModel.progressPercentage).toBe(50);

		// 4 steps = 100%
		viewModel.completedSteps.value = ['auth', 'workspace', 'settings', 'complete'];
		expect(viewModel.progressPercentage).toBe(100);
	});

	it('should validate step progression correctly', () => {
		// Auth step - always valid
		viewModel.currentStep.value = 'auth';
		expect(viewModel.canProceed).toBe(true);

		// Workspace step - valid if auth completed
		viewModel.currentStep.value = 'workspace';
		viewModel.completedSteps.value = [];
		expect(viewModel.canProceed).toBe(false);

		viewModel.completedSteps.value = ['auth'];
		expect(viewModel.canProceed).toBe(true);

		// Settings step - valid if workspace completed
		viewModel.currentStep.value = 'settings';
		viewModel.completedSteps.value = ['auth'];
		expect(viewModel.canProceed).toBe(false);

		viewModel.completedSteps.value = ['auth', 'workspace'];
		expect(viewModel.canProceed).toBe(true);
	});

	it('should update step progress', async () => {
		mockApiClient.updateProgress.mockResolvedValue();

		await viewModel.updateStep('workspace', { workspaceId: 'test-workspace' });

		expect(mockApiClient.updateProgress).toHaveBeenCalledWith('workspace', { workspaceId: 'test-workspace' });
		expect(viewModel.currentStep.value).toBe('workspace');
		expect(viewModel.completedSteps.value).toContain('workspace');
		expect(viewModel.error.value).toBeNull();
	});

	it('should handle step update errors', async () => {
		const error = new Error('Invalid step transition');
		mockApiClient.updateProgress.mockRejectedValue(error);

		await viewModel.updateStep('invalid-step');

		expect(viewModel.error.value).toBe('Invalid step transition');
		expect(viewModel.isLoading.value).toBe(false);
	});

	it('should complete onboarding', async () => {
		mockApiClient.completeOnboarding.mockResolvedValue();

		await viewModel.complete('test-workspace');

		expect(mockApiClient.completeOnboarding).toHaveBeenCalledWith('test-workspace');
		expect(viewModel.currentStep.value).toBe('complete');
		expect(viewModel.isComplete.value).toBe(true);
		expect(viewModel.completedSteps.value).toEqual(['auth', 'workspace', 'settings', 'complete']);
	});

	it('should handle loading states correctly', async () => {
		let resolvePromise;
		const pendingPromise = new Promise(resolve => {
			resolvePromise = resolve;
		});

		mockApiClient.getOnboardingStatus.mockReturnValue(pendingPromise);

		// Start loading
		const loadPromise = viewModel.loadState();
		expect(viewModel.isLoading.value).toBe(true);

		// Complete loading
		resolvePromise({ currentStep: 'auth', completedSteps: [], isComplete: false });
		await loadPromise;

		expect(viewModel.isLoading.value).toBe(false);
	});

	it('should allow skipping optional settings step', async () => {
		// Set up state at workspace step
		viewModel.currentStep.value = 'workspace';
		viewModel.completedSteps.value = ['auth', 'workspace'];

		// Skip to complete
		mockApiClient.completeOnboarding.mockResolvedValue();
		await viewModel.complete('test-workspace');

		expect(viewModel.currentStep.value).toBe('complete');
		expect(viewModel.isComplete.value).toBe(true);
		// Settings should still be in completed steps when completing
		expect(viewModel.completedSteps.value).toContain('settings');
	});

	it('should prevent duplicate step completion', async () => {
		viewModel.completedSteps.value = ['auth'];
		mockApiClient.updateProgress.mockResolvedValue();

		// Try to complete auth again
		await viewModel.updateStep('auth');

		// Should not add duplicate
		expect(viewModel.completedSteps.value).toEqual(['auth']);
	});

	it('should reset error on successful operations', async () => {
		viewModel.error.value = 'Previous error';
		mockApiClient.updateProgress.mockResolvedValue();

		await viewModel.updateStep('workspace');

		expect(viewModel.error.value).toBeNull();
	});

	it('should maintain step order integrity', () => {
		const stepOrder = ['auth', 'workspace', 'settings', 'complete'];

		const getStepIndex = (step) => stepOrder.indexOf(step);
		const canNavigateToStep = (targetStep, currentStep) => {
			return getStepIndex(targetStep) <= getStepIndex(currentStep) + 1;
		};

		// From auth, can go to workspace
		expect(canNavigateToStep('workspace', 'auth')).toBe(true);
		// From auth, cannot skip to settings
		expect(canNavigateToStep('settings', 'auth')).toBe(false);
		// From workspace, can go to settings
		expect(canNavigateToStep('settings', 'workspace')).toBe(true);
	});
});