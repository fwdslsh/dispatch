import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingViewModel } from '../../../src/lib/client/onboarding/OnboardingViewModel.svelte.js';

describe('OnboardingViewModel', () => {
	let mockApiClient;
	let viewModel;

	beforeEach(() => {
		// Mock API client with new methods
		mockApiClient = {
			submitOnboarding: vi.fn(),
			getSystemStatus: vi.fn()
		};

		// Create ViewModel instance
		viewModel = new OnboardingViewModel(mockApiClient);
	});

	it('should initialize with auth step and empty form data', () => {
		expect(viewModel.currentStep).toBe('auth');
		expect(viewModel.isLoading).toBe(false);
		expect(viewModel.error).toBeNull();
		expect(viewModel.formData.terminalKey).toBe('');
		expect(viewModel.formData.confirmTerminalKey).toBe('');
		expect(viewModel.formData.workspaceName).toBe('');
		expect(viewModel.formData.workspacePath).toBe('');
	});

	it('should calculate progress percentage correctly', () => {
		// Auth step = 0%
		viewModel.currentStep = 'auth';
		expect(viewModel.progressPercentage).toBe(0);

		// Workspace step = 33%
		viewModel.currentStep = 'workspace';
		expect(viewModel.progressPercentage).toBe(33);

		// Settings step = 67%
		viewModel.currentStep = 'settings';
		expect(viewModel.progressPercentage).toBe(67);

		// Complete step = 100%
		viewModel.currentStep = 'complete';
		expect(viewModel.progressPercentage).toBe(100);
	});

	it('should navigate to next step', () => {
		viewModel.currentStep = 'auth';
		viewModel.nextStep();
		expect(viewModel.currentStep).toBe('workspace');

		viewModel.nextStep();
		expect(viewModel.currentStep).toBe('settings');

		viewModel.nextStep();
		expect(viewModel.currentStep).toBe('complete');

		// Should not go beyond complete
		viewModel.nextStep();
		expect(viewModel.currentStep).toBe('complete');
	});

	it('should navigate to previous step', () => {
		viewModel.currentStep = 'complete';
		viewModel.previousStep();
		expect(viewModel.currentStep).toBe('settings');

		viewModel.previousStep();
		expect(viewModel.currentStep).toBe('workspace');

		viewModel.previousStep();
		expect(viewModel.currentStep).toBe('auth');

		// Should not go before auth
		viewModel.previousStep();
		expect(viewModel.currentStep).toBe('auth');
	});

	it('should update form data and auto-generate workspace path', () => {
		viewModel.updateFormData('workspaceName', 'My Test Project');
		expect(viewModel.formData.workspaceName).toBe('My Test Project');
		expect(viewModel.formData.workspacePath).toBe('/workspace/my-test-project');

		viewModel.updateFormData('workspaceName', 'Another-Project_123');
		expect(viewModel.formData.workspacePath).toBe('/workspace/another-project-123');
	});

	it('should validate terminal key requirements', () => {
		const result = viewModel.validateCurrentStep();
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Terminal key is required');

		viewModel.formData.terminalKey = 'short';
		const result2 = viewModel.validateCurrentStep();
		expect(result2.valid).toBe(false);
		expect(result2.errors).toContain('Terminal key must be at least 8 characters long');

		viewModel.formData.terminalKey = 'longenoughkey';
		viewModel.formData.confirmTerminalKey = 'different';
		const result3 = viewModel.validateCurrentStep();
		expect(result3.valid).toBe(false);
		expect(result3.errors).toContain('Terminal keys do not match');

		viewModel.formData.confirmTerminalKey = 'longenoughkey';
		const result4 = viewModel.validateCurrentStep();
		expect(result4.valid).toBe(true);
	});

	it('should validate workspace step (optional)', () => {
		viewModel.currentStep = 'workspace';

		// Workspace is optional - should be valid with no data
		const result1 = viewModel.validateCurrentStep();
		expect(result1.valid).toBe(true);

		// If name is provided, path is required (but auto-generated)
		viewModel.formData.workspaceName = 'Test';
		viewModel.formData.workspacePath = ''; // Manually clear
		const result2 = viewModel.validateCurrentStep();
		expect(result2.valid).toBe(false);
		expect(result2.errors).toContain('Workspace path is required when workspace name is provided');
	});

	it('should check canProceedFromAuth correctly', () => {
		expect(viewModel.canProceedFromAuth).toBe(false);

		viewModel.formData.terminalKey = 'validkey123';
		expect(viewModel.canProceedFromAuth).toBe(false); // No confirmation

		viewModel.formData.confirmTerminalKey = 'validkey123';
		expect(viewModel.canProceedFromAuth).toBe(true);
	});

	it('should submit onboarding with all form data', async () => {
		const mockResponse = {
			success: true,
			onboarding: {
				isComplete: true,
				completedAt: new Date().toISOString(),
				firstWorkspaceId: '/workspace/test'
			},
			workspace: {
				id: '/workspace/test',
				name: 'Test',
				path: '/workspace/test'
			}
		};

		mockApiClient.submitOnboarding.mockResolvedValue(mockResponse);

		viewModel.formData.terminalKey = 'testkey123';
		viewModel.formData.confirmTerminalKey = 'testkey123';
		viewModel.formData.workspaceName = 'Test';
		viewModel.formData.workspacePath = '/workspace/test';
		viewModel.formData.preferences = { autoCleanup: true };

		const result = await viewModel.submit();

		expect(mockApiClient.submitOnboarding).toHaveBeenCalledWith({
			terminalKey: 'testkey123',
			workspaceName: 'Test',
			workspacePath: '/workspace/test',
			preferences: { autoCleanup: true }
		});

		expect(result).toEqual(mockResponse);
		expect(viewModel.currentStep).toBe('complete');
		expect(viewModel.error).toBeNull();
	});

	it('should submit onboarding without workspace if not provided', async () => {
		const mockResponse = {
			success: true,
			onboarding: {
				isComplete: true,
				completedAt: new Date().toISOString(),
				firstWorkspaceId: null
			},
			workspace: null
		};

		mockApiClient.submitOnboarding.mockResolvedValue(mockResponse);

		viewModel.formData.terminalKey = 'testkey123';
		viewModel.formData.confirmTerminalKey = 'testkey123';

		await viewModel.submit();

		expect(mockApiClient.submitOnboarding).toHaveBeenCalledWith({
			terminalKey: 'testkey123'
		});
	});

	it('should handle submission errors', async () => {
		const error = new Error('Onboarding already completed');
		mockApiClient.submitOnboarding.mockRejectedValue(error);

		viewModel.formData.terminalKey = 'testkey123';
		viewModel.formData.confirmTerminalKey = 'testkey123';

		await expect(viewModel.submit()).rejects.toThrow('Onboarding already completed');
		expect(viewModel.error).toBe('Onboarding already completed');
		expect(viewModel.isLoading).toBe(false);
	});

	it('should set loading state during submission', async () => {
		let resolvePromise;
		const pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		mockApiClient.submitOnboarding.mockReturnValue(pendingPromise);

		viewModel.formData.terminalKey = 'testkey123';
		viewModel.formData.confirmTerminalKey = 'testkey123';

		const submitPromise = viewModel.submit();
		expect(viewModel.isLoading).toBe(true);

		resolvePromise({
			success: true,
			onboarding: { isComplete: true },
			workspace: null
		});
		await submitPromise;

		expect(viewModel.isLoading).toBe(false);
	});

	it('should reset form data', () => {
		viewModel.currentStep = 'settings';
		viewModel.formData.terminalKey = 'test';
		viewModel.formData.workspaceName = 'Test';
		viewModel.error = 'Some error';

		viewModel.reset();

		expect(viewModel.currentStep).toBe('auth');
		expect(viewModel.formData.terminalKey).toBe('');
		expect(viewModel.formData.workspaceName).toBe('');
		expect(viewModel.error).toBeNull();
	});

	it('should validate before submission', async () => {
		viewModel.formData.terminalKey = 'short'; // Invalid

		await expect(viewModel.submit()).rejects.toThrow();
		expect(mockApiClient.submitOnboarding).not.toHaveBeenCalled();
	});
});
