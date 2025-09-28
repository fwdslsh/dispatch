import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Svelte runes for testing
const createMockState = (initialValue) => {
	let value = initialValue;
	return {
		get value() { return value; },
		set value(newValue) { value = newValue; }
	};
};

describe('RetentionPolicyViewModel', () => {
	let mockApiClient;
	let viewModel;

	beforeEach(() => {
		mockApiClient = {
			getRetentionPolicy: vi.fn(),
			updateRetentionPolicy: vi.fn(),
			previewRetentionChanges: vi.fn()
		};

		// Mock ViewModel structure using Svelte 5 runes pattern
		viewModel = {
			// State runes
			sessionDays: createMockState(30),
			logDays: createMockState(7),
			autoCleanup: createMockState(true),
			isLoading: createMockState(false),
			isSaving: createMockState(false),
			isGeneratingPreview: createMockState(false),
			error: createMockState(null),
			previewSummary: createMockState(''),
			originalPolicy: createMockState(null),

			// Derived state
			get hasChanges() {
				if (!this.originalPolicy.value) return false;
				return (
					this.sessionDays.value !== this.originalPolicy.value.sessionRetentionDays ||
					this.logDays.value !== this.originalPolicy.value.logRetentionDays ||
					this.autoCleanup.value !== this.originalPolicy.value.autoCleanupEnabled
				);
			},

			get isValid() {
				return this.validatePolicy();
			},

			get canSave() {
				return this.isValid && this.hasChanges && !this.isSaving.value;
			},

			// Methods
			validatePolicy() {
				return (
					this.sessionDays.value >= 1 && this.sessionDays.value <= 365 &&
					this.logDays.value >= 1 && this.logDays.value <= 90
				);
			},

			async loadPolicy() {
				this.isLoading.value = true;
				try {
					const policy = await mockApiClient.getRetentionPolicy();
					this.sessionDays.value = policy.sessionRetentionDays;
					this.logDays.value = policy.logRetentionDays;
					this.autoCleanup.value = policy.autoCleanupEnabled;
					this.originalPolicy.value = policy;
					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
				} finally {
					this.isLoading.value = false;
				}
			},

			async generatePreview() {
				if (!this.isValid) return;

				this.isGeneratingPreview.value = true;
				try {
					const preview = await mockApiClient.previewRetentionChanges({
						sessionRetentionDays: this.sessionDays.value,
						logRetentionDays: this.logDays.value
					});
					this.previewSummary.value = preview.summary;
					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
				} finally {
					this.isGeneratingPreview.value = false;
				}
			},

			async savePolicy() {
				if (!this.canSave) return;

				this.isSaving.value = true;
				try {
					const updatedPolicy = await mockApiClient.updateRetentionPolicy({
						sessionRetentionDays: this.sessionDays.value,
						logRetentionDays: this.logDays.value,
						autoCleanupEnabled: this.autoCleanup.value
					});

					this.originalPolicy.value = updatedPolicy;
					this.error.value = null;
					return updatedPolicy;
				} catch (err) {
					this.error.value = err.message;
					throw err;
				} finally {
					this.isSaving.value = false;
				}
			},

			resetToDefaults() {
				this.sessionDays.value = 30;
				this.logDays.value = 7;
				this.autoCleanup.value = true;
			},

			resetToOriginal() {
				if (this.originalPolicy.value) {
					this.sessionDays.value = this.originalPolicy.value.sessionRetentionDays;
					this.logDays.value = this.originalPolicy.value.logRetentionDays;
					this.autoCleanup.value = this.originalPolicy.value.autoCleanupEnabled;
				}
			}
		};
	});

	it('should initialize with default values', () => {
		expect(viewModel.sessionDays.value).toBe(30);
		expect(viewModel.logDays.value).toBe(7);
		expect(viewModel.autoCleanup.value).toBe(true);
		expect(viewModel.isLoading.value).toBe(false);
		expect(viewModel.error.value).toBeNull();
	});

	it('should load retention policy from API', async () => {
		const mockPolicy = {
			sessionRetentionDays: 21,
			logRetentionDays: 5,
			autoCleanupEnabled: false
		};

		mockApiClient.getRetentionPolicy.mockResolvedValue(mockPolicy);

		await viewModel.loadPolicy();

		expect(viewModel.sessionDays.value).toBe(21);
		expect(viewModel.logDays.value).toBe(5);
		expect(viewModel.autoCleanup.value).toBe(false);
		expect(viewModel.originalPolicy.value).toEqual(mockPolicy);
		expect(viewModel.error.value).toBeNull();
	});

	it('should validate policy correctly', () => {
		// Valid policy
		viewModel.sessionDays.value = 30;
		viewModel.logDays.value = 7;
		expect(viewModel.isValid).toBe(true);

		// Invalid session days (too low)
		viewModel.sessionDays.value = 0;
		expect(viewModel.isValid).toBe(false);

		// Invalid session days (too high)
		viewModel.sessionDays.value = 400;
		expect(viewModel.isValid).toBe(false);

		// Reset to valid
		viewModel.sessionDays.value = 30;
		expect(viewModel.isValid).toBe(true);

		// Invalid log days (too low)
		viewModel.logDays.value = 0;
		expect(viewModel.isValid).toBe(false);

		// Invalid log days (too high)
		viewModel.logDays.value = 100;
		expect(viewModel.isValid).toBe(false);
	});

	it('should detect changes correctly', () => {
		const originalPolicy = {
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		};

		viewModel.originalPolicy.value = originalPolicy;

		// No changes initially
		expect(viewModel.hasChanges).toBe(false);

		// Change session days
		viewModel.sessionDays.value = 21;
		expect(viewModel.hasChanges).toBe(true);

		// Reset
		viewModel.sessionDays.value = 30;
		expect(viewModel.hasChanges).toBe(false);

		// Change log days
		viewModel.logDays.value = 14;
		expect(viewModel.hasChanges).toBe(true);

		// Reset
		viewModel.logDays.value = 7;
		expect(viewModel.hasChanges).toBe(false);

		// Change auto cleanup
		viewModel.autoCleanup.value = false;
		expect(viewModel.hasChanges).toBe(true);
	});

	it('should determine when saving is allowed', () => {
		const originalPolicy = {
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		};

		viewModel.originalPolicy.value = originalPolicy;

		// No changes - cannot save
		expect(viewModel.canSave).toBe(false);

		// Make valid change - can save
		viewModel.sessionDays.value = 21;
		expect(viewModel.canSave).toBe(true);

		// Make invalid change - cannot save
		viewModel.sessionDays.value = 0;
		expect(viewModel.canSave).toBe(false);

		// Valid change but saving in progress - cannot save
		viewModel.sessionDays.value = 21;
		viewModel.isSaving.value = true;
		expect(viewModel.canSave).toBe(false);
	});

	it('should generate retention preview', async () => {
		const mockPreview = {
			summary: 'Will delete 15 sessions older than 14 days and 250 log entries older than 3 days'
		};

		mockApiClient.previewRetentionChanges.mockResolvedValue(mockPreview);

		viewModel.sessionDays.value = 14;
		viewModel.logDays.value = 3;

		await viewModel.generatePreview();

		expect(mockApiClient.previewRetentionChanges).toHaveBeenCalledWith({
			sessionRetentionDays: 14,
			logRetentionDays: 3
		});
		expect(viewModel.previewSummary.value).toBe(mockPreview.summary);
		expect(viewModel.error.value).toBeNull();
	});

	it('should not generate preview for invalid policy', async () => {
		viewModel.sessionDays.value = 0; // Invalid
		viewModel.logDays.value = 7;

		await viewModel.generatePreview();

		expect(mockApiClient.previewRetentionChanges).not.toHaveBeenCalled();
		expect(viewModel.previewSummary.value).toBe('');
	});

	it('should save policy changes', async () => {
		const originalPolicy = {
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		};

		const updatedPolicy = {
			sessionRetentionDays: 21,
			logRetentionDays: 5,
			autoCleanupEnabled: false
		};

		viewModel.originalPolicy.value = originalPolicy;
		viewModel.sessionDays.value = 21;
		viewModel.logDays.value = 5;
		viewModel.autoCleanup.value = false;

		mockApiClient.updateRetentionPolicy.mockResolvedValue(updatedPolicy);

		const result = await viewModel.savePolicy();

		expect(mockApiClient.updateRetentionPolicy).toHaveBeenCalledWith({
			sessionRetentionDays: 21,
			logRetentionDays: 5,
			autoCleanupEnabled: false
		});
		expect(viewModel.originalPolicy.value).toEqual(updatedPolicy);
		expect(viewModel.error.value).toBeNull();
		expect(result).toEqual(updatedPolicy);
	});

	it('should handle save errors', async () => {
		const originalPolicy = {
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		};

		viewModel.originalPolicy.value = originalPolicy;
		viewModel.sessionDays.value = 21;

		const error = new Error('Save failed');
		mockApiClient.updateRetentionPolicy.mockRejectedValue(error);

		await expect(viewModel.savePolicy()).rejects.toThrow('Save failed');
		expect(viewModel.error.value).toBe('Save failed');
		expect(viewModel.isSaving.value).toBe(false);
	});

	it('should reset to defaults', () => {
		viewModel.sessionDays.value = 21;
		viewModel.logDays.value = 14;
		viewModel.autoCleanup.value = false;

		viewModel.resetToDefaults();

		expect(viewModel.sessionDays.value).toBe(30);
		expect(viewModel.logDays.value).toBe(7);
		expect(viewModel.autoCleanup.value).toBe(true);
	});

	it('should reset to original values', () => {
		const originalPolicy = {
			sessionRetentionDays: 21,
			logRetentionDays: 5,
			autoCleanupEnabled: false
		};

		viewModel.originalPolicy.value = originalPolicy;
		viewModel.sessionDays.value = 30;
		viewModel.logDays.value = 7;
		viewModel.autoCleanup.value = true;

		viewModel.resetToOriginal();

		expect(viewModel.sessionDays.value).toBe(21);
		expect(viewModel.logDays.value).toBe(5);
		expect(viewModel.autoCleanup.value).toBe(false);
	});

	it('should handle loading states correctly', async () => {
		let resolvePromise;
		const pendingPromise = new Promise(resolve => {
			resolvePromise = resolve;
		});

		mockApiClient.getRetentionPolicy.mockReturnValue(pendingPromise);

		// Start loading
		const loadPromise = viewModel.loadPolicy();
		expect(viewModel.isLoading.value).toBe(true);

		// Complete loading
		resolvePromise({
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		});
		await loadPromise;

		expect(viewModel.isLoading.value).toBe(false);
	});

	it('should handle preview loading states', async () => {
		let resolvePromise;
		const pendingPromise = new Promise(resolve => {
			resolvePromise = resolve;
		});

		mockApiClient.previewRetentionChanges.mockReturnValue(pendingPromise);

		// Start preview generation
		const previewPromise = viewModel.generatePreview();
		expect(viewModel.isGeneratingPreview.value).toBe(true);

		// Complete preview
		resolvePromise({ summary: 'Preview complete' });
		await previewPromise;

		expect(viewModel.isGeneratingPreview.value).toBe(false);
	});
});