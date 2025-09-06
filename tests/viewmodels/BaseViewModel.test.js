/**
 * BaseViewModel Unit Tests
 * Tests all common state patterns ($state, $derived, $effect)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseViewModel } from '../../src/lib/shared/contexts/BaseViewModel.svelte.js';

describe('BaseViewModel', () => {
	let mockModel;
	let mockServices;
	let viewModel;

	beforeEach(() => {
		// Mock model with basic state
		mockModel = {
			state: {
				id: 1,
				name: 'test',
				value: 'initial'
			},
			onChange: null,
			dispose: vi.fn()
		};

		// Mock services
		mockServices = {
			apiService: { call: vi.fn() },
			validationService: { validate: vi.fn() }
		};

		// Create ViewModel instance
		viewModel = new BaseViewModel(mockModel, mockServices);
	});

	afterEach(() => {
		if (viewModel && !viewModel.isDisposed) {
			viewModel.dispose();
		}
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with model and services', () => {
			expect(viewModel.model).toBe(mockModel);
			expect(viewModel.services).toBe(mockServices);
			expect(viewModel.isDisposed).toBe(false);
		});

		it('should create reactive state from model state', () => {
			expect(viewModel.state).toEqual(mockModel.state);
			expect(viewModel.state.id).toBe(1);
			expect(viewModel.state.name).toBe('test');
			expect(viewModel.state.value).toBe('initial');
		});

		it('should initialize loading and error states', () => {
			expect(viewModel.loading).toBe(false);
			expect(viewModel.error).toBe(null);
		});

		it('should set up model onChange listener', () => {
			expect(typeof mockModel.onChange).toBe('function');
		});
	});

	describe('Reactive State Management ($state patterns)', () => {
		it('should update reactive state when model state changes', () => {
			const newState = { id: 2, name: 'updated', value: 'changed' };

			// Simulate model state change
			mockModel.onChange(newState);

			expect(viewModel.state.id).toBe(2);
			expect(viewModel.state.name).toBe('updated');
			expect(viewModel.state.value).toBe('changed');
		});

		it('should preserve existing model onChange if present', () => {
			const originalOnChange = vi.fn();
			mockModel.onChange = originalOnChange;

			// Create new ViewModel
			const vm = new BaseViewModel(mockModel, mockServices);
			const newState = { id: 3, name: 'test', value: 'test' };

			// Trigger change
			mockModel.onChange(newState);

			// Both should be called
			expect(originalOnChange).toHaveBeenCalledWith(newState);
			expect(vm.state.id).toBe(3);

			vm.dispose();
		});

		it('should handle partial state updates', () => {
			const initialState = { ...viewModel.state };

			// Partial update
			mockModel.onChange({ name: 'partially-updated' });

			expect(viewModel.state.id).toBe(initialState.id); // unchanged
			expect(viewModel.state.name).toBe('partially-updated'); // changed
			expect(viewModel.state.value).toBe(initialState.value); // unchanged
		});
	});

	describe('Loading State Management', () => {
		it('should manage loading state during async operations', async () => {
			const asyncAction = vi.fn().mockResolvedValue('success');

			const promise = viewModel.withLoading(asyncAction);

			// Should be loading during execution
			expect(viewModel.loading).toBe(true);
			expect(viewModel.error).toBe(null);

			const result = await promise;

			// Should not be loading after completion
			expect(viewModel.loading).toBe(false);
			expect(result).toBe('success');
			expect(asyncAction).toHaveBeenCalled();
		});

		it('should handle async action errors', async () => {
			const error = new Error('Test error');
			const asyncAction = vi.fn().mockRejectedValue(error);

			await expect(viewModel.withLoading(asyncAction)).rejects.toThrow('Test error');

			expect(viewModel.loading).toBe(false);
			expect(viewModel.error).toBe('Test error');
		});

		it('should handle errors without message', async () => {
			const asyncAction = vi.fn().mockRejectedValue('string error');

			await expect(viewModel.withLoading(asyncAction)).rejects.toBe('string error');

			expect(viewModel.error).toBe('string error'); // Enhanced error handling preserves actual string
		});

		it('should not execute action if disposed', async () => {
			const asyncAction = vi.fn().mockResolvedValue('success');

			viewModel.dispose();
			const result = await viewModel.withLoading(asyncAction);

			expect(result).toBeUndefined();
			expect(asyncAction).not.toHaveBeenCalled();
		});

		it('should clear error on successful action', async () => {
			// Set initial error
			viewModel.setError('initial error');
			expect(viewModel.error).toBe('initial error');

			const asyncAction = vi.fn().mockResolvedValue('success');
			await viewModel.withLoading(asyncAction);

			expect(viewModel.error).toBe(null);
		});
	});

	describe('Error State Management', () => {
		it('should set error message', () => {
			viewModel.setError('Test error message');

			expect(viewModel.error).toBe('Test error message');
		});

		it('should clear error message', () => {
			viewModel.setError('Test error');
			viewModel.clearError();

			expect(viewModel.error).toBe(null);
		});

		it('should throw when setting error on disposed ViewModel', () => {
			viewModel.dispose();

			expect(() => viewModel.setError('error')).toThrow('ViewModel has been disposed');
		});

		it('should not clear error on disposed ViewModel', () => {
			viewModel.setError('error');
			viewModel.dispose();

			// Should not throw, just return early
			expect(() => viewModel.clearError()).not.toThrow();
		});
	});

	describe('Resource Management and Disposal', () => {
		it('should add and execute cleanup callbacks', () => {
			const cleanup1 = vi.fn();
			const cleanup2 = vi.fn();

			viewModel.addCleanup(cleanup1);
			viewModel.addCleanup(cleanup2);

			viewModel.dispose();

			expect(cleanup1).toHaveBeenCalled();
			expect(cleanup2).toHaveBeenCalled();
		});

		it('should handle cleanup callback errors gracefully', () => {
			const goodCleanup = vi.fn();
			const badCleanup = vi.fn().mockImplementation(() => {
				throw new Error('Cleanup failed');
			});

			// Mock console.error to avoid output during tests
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			viewModel.addCleanup(goodCleanup);
			viewModel.addCleanup(badCleanup);
			viewModel.addCleanup(goodCleanup);

			viewModel.dispose();

			expect(goodCleanup).toHaveBeenCalledTimes(2);
			expect(badCleanup).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith('Cleanup callback failed:', expect.any(Error));

			consoleSpy.mockRestore();
		});

		it('should dispose model if it has dispose method', () => {
			viewModel.dispose();

			expect(mockModel.dispose).toHaveBeenCalled();
		});

		it('should handle model without dispose method', () => {
			delete mockModel.dispose;

			// Should not throw
			expect(() => viewModel.dispose()).not.toThrow();
		});

		it('should mark as disposed and clear references', () => {
			viewModel.dispose();

			expect(viewModel.isDisposed).toBe(true);
			expect(viewModel.model).toBe(null);
			expect(viewModel.services).toBe(null);
		});

		it('should be idempotent (safe to call multiple times)', () => {
			const cleanup = vi.fn();
			viewModel.addCleanup(cleanup);

			viewModel.dispose();
			viewModel.dispose(); // Second call

			expect(cleanup).toHaveBeenCalledTimes(1);
			expect(mockModel.dispose).toHaveBeenCalledTimes(1);
		});
	});

	describe('Integration Scenarios', () => {
		it('should handle model changes after partial disposal', () => {
			// Start disposal process but before model is nulled
			const cleanup = vi.fn();
			viewModel.addCleanup(cleanup);

			// Simulate a model change during disposal
			mockModel.onChange({ name: 'changed-during-disposal' });

			// Should still update state before disposal
			expect(viewModel.state.name).toBe('changed-during-disposal');

			viewModel.dispose();
			expect(cleanup).toHaveBeenCalled();
		});

		it('should work with complex nested state objects', () => {
			const complexModel = {
				state: {
					user: { id: 1, profile: { name: 'John', settings: { theme: 'dark' } } },
					data: [1, 2, 3],
					meta: { lastUpdated: Date.now() }
				},
				onChange: null
			};

			const complexVM = new BaseViewModel(complexModel, mockServices);

			// Verify deep state access
			expect(complexVM.state.user.profile.name).toBe('John');
			expect(complexVM.state.data).toEqual([1, 2, 3]);

			// Test partial deep update
			complexModel.onChange({
				user: {
					...complexModel.state.user,
					profile: { ...complexModel.state.user.profile, name: 'Jane' }
				}
			});

			expect(complexVM.state.user.profile.name).toBe('Jane');

			complexVM.dispose();
		});
	});

	describe('Service Integration Patterns', () => {
		it('should provide access to injected services', () => {
			expect(viewModel.services.apiService).toBeDefined();
			expect(viewModel.services.validationService).toBeDefined();
		});

		it('should work with no services provided', () => {
			const vmWithoutServices = new BaseViewModel(mockModel);

			expect(vmWithoutServices.services).toEqual({});

			vmWithoutServices.dispose();
		});

		it('should support service-based async operations', async () => {
			mockServices.apiService.call.mockResolvedValue({ success: true });

			const result = await viewModel.withLoading(async () => {
				return await viewModel.services.apiService.call('/test');
			});

			expect(result).toEqual({ success: true });
			expect(mockServices.apiService.call).toHaveBeenCalledWith('/test');
		});
	});
});
