/**
 * ModalViewModel Unit Tests
 * Tests Svelte 5 modal state management with stack support and keyboard handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModalViewModel } from '../../src/lib/client/shared/viewmodels/ModalViewModel.svelte.js';

// Mock addEventListener/removeEventListener
const mockEventListeners = new Map();
Object.defineProperty(document, 'addEventListener', {
	value: vi.fn((event, handler) => {
		mockEventListeners.set(event, handler);
	})
});
Object.defineProperty(document, 'removeEventListener', {
	value: vi.fn((event) => {
		mockEventListeners.delete(event);
	})
});

describe('ModalViewModel', () => {
	let viewModel;

	beforeEach(() => {
		// Clear event listeners
		mockEventListeners.clear();

		// Create ViewModel instance
		viewModel = new ModalViewModel();
	});

	afterEach(() => {
		if (viewModel) {
			// Clean up any open modals
			while (viewModel.modalStack.length > 0) {
				viewModel.closeModal();
			}
			viewModel = null;
		}
		mockEventListeners.clear();
	});

	describe('Svelte 5 Runes - Initial State', () => {
		it('should initialize with correct $state values', () => {
			expect(viewModel.modalStack).toEqual([]);
			expect(viewModel.currentModal).toBe(null);
			expect(viewModel.modalData).toBe(null);
		});

		it('should initialize $derived computed values correctly', () => {
			expect(viewModel.isModalOpen).toBe(false);
			expect(viewModel.modalCount).toBe(0);
		});
	});

	describe('Svelte 5 Runes - $derived Computed Properties', () => {
		it('should update isModalOpen when modal is opened', () => {
			expect(viewModel.isModalOpen).toBe(false);

			viewModel.openModal('test-modal', { test: true });

			expect(viewModel.isModalOpen).toBe(true);
		});

		it('should update modalCount when modals are added/removed', () => {
			expect(viewModel.modalCount).toBe(0);

			viewModel.openModal('modal-1');
			expect(viewModel.modalCount).toBe(1);

			viewModel.openModal('modal-2');
			expect(viewModel.modalCount).toBe(2);

			viewModel.closeModal();
			expect(viewModel.modalCount).toBe(1);

			viewModel.closeModal();
			expect(viewModel.modalCount).toBe(0);
		});

		it('should maintain reactivity when stack changes', () => {
			// Test multiple operations
			expect(viewModel.isModalOpen).toBe(false);
			expect(viewModel.modalCount).toBe(0);

			viewModel.openModal('first');
			expect(viewModel.isModalOpen).toBe(true);
			expect(viewModel.modalCount).toBe(1);

			viewModel.openModal('second');
			expect(viewModel.modalCount).toBe(2);
			expect(viewModel.currentModal).toBe('second');

			viewModel.closeAllModals();
			expect(viewModel.isModalOpen).toBe(false);
			expect(viewModel.modalCount).toBe(0);
		});
	});

	describe('Modal Stack Management', () => {
		it('should open modal and add to stack', () => {
			const data = { title: 'Test Modal', content: 'Hello' };

			viewModel.openModal('test-modal', data);

			expect(viewModel.modalStack).toHaveLength(1);
			expect(viewModel.modalStack[0].type).toBe('test-modal');
			expect(viewModel.modalStack[0].data).toEqual(data);
			expect(viewModel.currentModal).toBe('test-modal');
			expect(viewModel.modalData).toEqual(data);
		});

		it('should support stacked modals (modal over modal)', () => {
			viewModel.openModal('base-modal', { level: 1 });
			viewModel.openModal('overlay-modal', { level: 2 });

			expect(viewModel.modalStack).toHaveLength(2);
			expect(viewModel.currentModal).toBe('overlay-modal');
			expect(viewModel.modalData).toEqual({ level: 2 });
		});

		it('should close topmost modal from stack', () => {
			viewModel.openModal('modal-1', { id: 1 });
			viewModel.openModal('modal-2', { id: 2 });

			viewModel.closeModal();

			expect(viewModel.modalStack).toHaveLength(1);
			expect(viewModel.currentModal).toBe('modal-1');
			expect(viewModel.modalData).toEqual({ id: 1 });
		});

		it('should handle closing modal when stack is empty', () => {
			expect(() => viewModel.closeModal()).not.toThrow();
			expect(viewModel.modalStack).toHaveLength(0);
			expect(viewModel.currentModal).toBe(null);
		});

		it('should close all modals at once', () => {
			viewModel.openModal('modal-1');
			viewModel.openModal('modal-2');
			viewModel.openModal('modal-3');

			viewModel.closeAllModals();

			expect(viewModel.modalStack).toHaveLength(0);
			expect(viewModel.currentModal).toBe(null);
			expect(viewModel.modalData).toBe(null);
			expect(viewModel.isModalOpen).toBe(false);
		});
	});

	describe('Modal Types and Data', () => {
		it('should handle different modal types', () => {
			const confirmData = {
				message: 'Are you sure?',
				onConfirm: vi.fn(),
				onCancel: vi.fn()
			};

			viewModel.openModal('confirm', confirmData);

			expect(viewModel.currentModal).toBe('confirm');
			expect(viewModel.modalData.message).toBe('Are you sure?');
			expect(typeof viewModel.modalData.onConfirm).toBe('function');
		});

		it('should handle modal without data', () => {
			viewModel.openModal('simple-modal');

			expect(viewModel.currentModal).toBe('simple-modal');
			expect(viewModel.modalData).toBe(null);
		});

		it('should handle complex modal data objects', () => {
			const complexData = {
				form: { name: '', email: '', settings: { theme: 'dark' } },
				callbacks: {
					onSave: vi.fn(),
					onCancel: vi.fn(),
					onChange: vi.fn()
				},
				metadata: { created: Date.now(), version: '1.0.0' }
			};

			viewModel.openModal('settings', complexData);

			expect(viewModel.modalData).toEqual(complexData);
			expect(viewModel.modalData.form.settings.theme).toBe('dark');
		});

		it('should preserve data integrity across modal operations', () => {
			const data1 = { modal: 1, shared: 'value' };
			const data2 = { modal: 2, different: 'data' };

			viewModel.openModal('first', data1);
			viewModel.openModal('second', data2);

			// Current should be second
			expect(viewModel.modalData).toEqual(data2);

			viewModel.closeModal();

			// Should revert to first modal's data
			expect(viewModel.modalData).toEqual(data1);
		});
	});

	describe('Keyboard Event Handling', () => {
		it('should set up keyboard event listener when first modal opens', () => {
			viewModel.openModal('test-modal');

			expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
		});

		it('should remove keyboard event listener when last modal closes', () => {
			viewModel.openModal('test-modal');
			viewModel.closeModal();

			expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
		});

		it('should not add duplicate keyboard listeners for multiple modals', () => {
			viewModel.openModal('modal-1');
			viewModel.openModal('modal-2');

			// Should only be called once
			expect(document.addEventListener).toHaveBeenCalledTimes(1);
		});

		it('should close modal on Escape key press', () => {
			viewModel.openModal('test-modal');

			// Simulate Escape key press
			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			const keyHandler = mockEventListeners.get('keydown');

			expect(keyHandler).toBeDefined();
			keyHandler(escapeEvent);

			expect(viewModel.isModalOpen).toBe(false);
		});

		it('should only close topmost modal on Escape', () => {
			viewModel.openModal('base-modal');
			viewModel.openModal('top-modal');

			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			const keyHandler = mockEventListeners.get('keydown');
			keyHandler(escapeEvent);

			expect(viewModel.modalStack).toHaveLength(1);
			expect(viewModel.currentModal).toBe('base-modal');
		});

		it('should ignore non-Escape keys', () => {
			viewModel.openModal('test-modal');

			const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
			const keyHandler = mockEventListeners.get('keydown');
			keyHandler(enterEvent);

			expect(viewModel.isModalOpen).toBe(true);
		});
	});

	describe('Specific Modal Type Helpers', () => {
		it('should open confirmation modal with proper structure', () => {
			const onConfirm = vi.fn();
			const onCancel = vi.fn();

			viewModel.openConfirmationModal('Delete item?', onConfirm, onCancel);

			expect(viewModel.currentModal).toBe('confirmation');
			expect(viewModel.modalData.message).toBe('Delete item?');
			expect(viewModel.modalData.onConfirm).toBe(onConfirm);
			expect(viewModel.modalData.onCancel).toBe(onCancel);
		});

		it('should open settings modal', () => {
			const settings = { theme: 'dark', notifications: true };
			const onSave = vi.fn();

			viewModel.openSettingsModal(settings, onSave);

			expect(viewModel.currentModal).toBe('settings');
			expect(viewModel.modalData.settings).toEqual(settings);
			expect(viewModel.modalData.onSave).toBe(onSave);
		});

		it('should open create session modal', () => {
			const workspaceOptions = { path: '/test', type: 'pty' };
			const onCreate = vi.fn();

			viewModel.openCreateSessionModal(workspaceOptions, onCreate);

			expect(viewModel.currentModal).toBe('create-session');
			expect(viewModel.modalData.workspaceOptions).toEqual(workspaceOptions);
			expect(viewModel.modalData.onCreate).toBe(onCreate);
		});
	});

	describe('Modal State Queries', () => {
		it('should check if specific modal type is open', () => {
			expect(viewModel.isModalOfType('confirmation')).toBe(false);

			viewModel.openModal('confirmation', { message: 'Test' });

			expect(viewModel.isModalOfType('confirmation')).toBe(true);
			expect(viewModel.isModalOfType('settings')).toBe(false);
		});

		it('should check if modal is in stack', () => {
			viewModel.openModal('base');
			viewModel.openModal('overlay');

			expect(viewModel.isModalInStack('base')).toBe(true);
			expect(viewModel.isModalInStack('overlay')).toBe(true);
			expect(viewModel.isModalInStack('nonexistent')).toBe(false);
		});

		it('should get modal position in stack', () => {
			viewModel.openModal('first');
			viewModel.openModal('second');
			viewModel.openModal('third');

			expect(viewModel.getModalPosition('first')).toBe(0);
			expect(viewModel.getModalPosition('second')).toBe(1);
			expect(viewModel.getModalPosition('third')).toBe(2);
			expect(viewModel.getModalPosition('nonexistent')).toBe(-1);
		});
	});

	describe('Modal Data Management', () => {
		it('should update modal data for current modal', () => {
			viewModel.openModal('editable', { name: 'Initial' });

			viewModel.updateModalData({ name: 'Updated', email: 'test@example.com' });

			expect(viewModel.modalData.name).toBe('Updated');
			expect(viewModel.modalData.email).toBe('test@example.com');
		});

		it('should not update data when no modal is open', () => {
			expect(() => {
				viewModel.updateModalData({ test: 'data' });
			}).not.toThrow();

			expect(viewModel.modalData).toBe(null);
		});

		it('should merge data instead of replacing', () => {
			viewModel.openModal('form', {
				name: 'John',
				email: 'john@example.com',
				settings: { theme: 'dark' }
			});

			viewModel.updateModalData({
				name: 'Jane',
				settings: { ...viewModel.modalData.settings, notifications: true }
			});

			expect(viewModel.modalData.name).toBe('Jane');
			expect(viewModel.modalData.email).toBe('john@example.com'); // preserved
			expect(viewModel.modalData.settings.theme).toBe('dark'); // preserved
			expect(viewModel.modalData.settings.notifications).toBe(true); // added
		});
	});

	describe('Error Handling and Edge Cases', () => {
		it('should handle rapid modal operations', () => {
			// Rapidly open and close modals
			for (let i = 0; i < 10; i++) {
				viewModel.openModal(`modal-${i}`);
			}
			expect(viewModel.modalCount).toBe(10);

			for (let i = 0; i < 10; i++) {
				viewModel.closeModal();
			}
			expect(viewModel.modalCount).toBe(0);
		});

		it('should handle modal operations during keyboard events', () => {
			viewModel.openModal('test');

			// Try to manipulate modals while handling keyboard event
			const keyHandler = mockEventListeners.get('keydown');
			expect(() => {
				viewModel.openModal('another');
				keyHandler(new KeyboardEvent('keydown', { key: 'Escape' }));
				viewModel.closeModal();
			}).not.toThrow();
		});

		it('should clean up properly on multiple close operations', () => {
			viewModel.openModal('test');

			// Multiple close attempts
			viewModel.closeModal();
			viewModel.closeModal(); // Second call should not throw
			viewModel.closeAllModals(); // Should not throw

			expect(viewModel.isModalOpen).toBe(false);
			expect(viewModel.modalStack).toHaveLength(0);
		});
	});

	describe('Integration Scenarios', () => {
		it('should work with complex workflow scenarios', () => {
			// Open settings modal
			viewModel.openSettingsModal({ theme: 'light' }, vi.fn());
			expect(viewModel.currentModal).toBe('settings');

			// Open confirmation modal on top
			viewModel.openConfirmationModal('Save changes?', vi.fn(), vi.fn());
			expect(viewModel.currentModal).toBe('confirmation');
			expect(viewModel.modalCount).toBe(2);

			// Close confirmation (back to settings)
			viewModel.closeModal();
			expect(viewModel.currentModal).toBe('settings');

			// Update settings data
			viewModel.updateModalData({ theme: 'dark', notifications: true });
			expect(viewModel.modalData.theme).toBe('dark');

			// Close all
			viewModel.closeAllModals();
			expect(viewModel.isModalOpen).toBe(false);
		});

		it('should maintain consistent state across component re-renders', () => {
			// Simulate component state that depends on modal state
			let componentState = {
				showBackdrop: viewModel.isModalOpen,
				modalType: viewModel.currentModal,
				modalLevel: viewModel.modalCount
			};

			expect(componentState.showBackdrop).toBe(false);

			viewModel.openModal('test');

			// Update component state (simulating reactive dependency)
			componentState = {
				showBackdrop: viewModel.isModalOpen,
				modalType: viewModel.currentModal,
				modalLevel: viewModel.modalCount
			};

			expect(componentState.showBackdrop).toBe(true);
			expect(componentState.modalType).toBe('test');
			expect(componentState.modalLevel).toBe(1);
		});
	});
});