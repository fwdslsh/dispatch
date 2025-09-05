/**
 * KeyboardToolbarViewModel Unit Tests
 * Tests keyboard shortcut management, toolbar state, configuration persistence, and key event handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardToolbarViewModel } from '../../viewmodels/KeyboardToolbarViewModel.svelte.js';

describe('KeyboardToolbarViewModel', () => {
	let mockModel;
	let mockKeyboardService;
	let mockServices;
	let viewModel;
	let mockLocalStorage;

	beforeEach(() => {
		// Mock localStorage
		mockLocalStorage = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn()
		};
		global.localStorage = mockLocalStorage;

		// Mock model with keyboard toolbar state
		mockModel = {
			state: {
				visible: false,
				isMobile: true,
				keyboardHeight: 0,
				toolbarConfig: [],
				isCustomizing: false,
				activeModifiers: {
					ctrl: false,
					alt: false,
					shift: false,
					meta: false
				},
				keySequenceBuffer: [],
				detectionMethod: 'visualViewport'
			},
			onChange: null,
			dispose: vi.fn()
		};

		// Mock keyboard service
		mockKeyboardService = {
			detectKeyboardVisibility: vi.fn().mockResolvedValue(false),
			getDefaultConfiguration: vi.fn().mockReturnValue([
				{ key: 'Escape', label: 'Esc', code: 'Escape', symbol: '⎋' },
				{ key: 'Tab', label: 'Tab', code: 'Tab', symbol: '↹' },
				{ key: 'ctrl+c', label: 'Ctrl+C', code: 'KeyC', ctrlKey: true, symbol: '^C' }
			]),
			loadConfiguration: vi.fn().mockReturnValue(null),
			saveConfiguration: vi.fn(),
			generateKeySequence: vi.fn().mockReturnValue('\u001b'),
			validateConfiguration: vi.fn().mockReturnValue({ isValid: true }),
			setupKeyboardDetection: vi.fn().mockReturnValue(() => {}),
			addKeyboardListener: vi.fn().mockReturnValue(() => {}),
			removeKeyboardListener: vi.fn(),
			isModifierKey: vi.fn().mockReturnValue(false),
			parseKeyCode: vi.fn().mockImplementation((key) => ({ key, code: key }))
		};

		// Mock services
		mockServices = {
			keyboardService: mockKeyboardService,
			validationService: { validate: vi.fn() }
		};

		// Create ViewModel instance
		viewModel = new KeyboardToolbarViewModel(mockModel, mockServices);
	});

	afterEach(() => {
		if (viewModel && !viewModel.isDisposed) {
			viewModel.dispose();
		}
		delete global.localStorage;
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with model and keyboard service', () => {
			expect(viewModel.model).toBe(mockModel);
			expect(viewModel.services.keyboardService).toBe(mockKeyboardService);
			expect(viewModel.isDisposed).toBe(false);
		});

		it('should initialize reactive state from model', () => {
			expect(viewModel.state.visible).toBe(false);
			expect(viewModel.state.isMobile).toBe(true);
			expect(viewModel.state.keyboardHeight).toBe(0);
			expect(viewModel.state.toolbarConfig).toEqual([]);
		});

		it('should initialize derived state', () => {
			expect(viewModel.hasConfiguration).toBe(false);
			expect(viewModel.buttonCount).toBe(0);
			expect(viewModel.isKeyboardVisible).toBe(false);
			expect(viewModel.hasActiveModifiers).toBe(false);
		});

		it('should throw error without keyboard service', () => {
			expect(() => {
				new KeyboardToolbarViewModel(mockModel, {});
			}).toThrow('KeyboardService is required for KeyboardToolbarViewModel');
		});

		it('should load default configuration on initialization', () => {
			expect(mockKeyboardService.getDefaultConfiguration).toHaveBeenCalled();
			expect(mockKeyboardService.loadConfiguration).toHaveBeenCalled();
		});
	});

	describe('Configuration Management', () => {
		const testConfig = [
			{ key: 'Escape', label: 'Esc', symbol: '⎋' },
			{ key: 'Tab', label: 'Tab', symbol: '↹' },
			{ key: 'ctrl+c', label: 'Ctrl+C', ctrlKey: true, symbol: '^C' }
		];

		it('should load toolbar configuration', async () => {
			mockKeyboardService.loadConfiguration.mockReturnValue(testConfig);

			await viewModel.loadConfiguration();

			expect(viewModel.state.toolbarConfig).toEqual(testConfig);
			expect(mockKeyboardService.loadConfiguration).toHaveBeenCalled();
		});

		it('should save toolbar configuration', async () => {
			viewModel.state.toolbarConfig = testConfig;

			await viewModel.saveConfiguration();

			expect(mockKeyboardService.saveConfiguration).toHaveBeenCalledWith(testConfig);
		});

		it('should reset to default configuration', async () => {
			const defaultConfig = mockKeyboardService.getDefaultConfiguration();

			await viewModel.resetToDefault();

			expect(viewModel.state.toolbarConfig).toEqual(defaultConfig);
			expect(mockKeyboardService.saveConfiguration).toHaveBeenCalledWith(defaultConfig);
		});

		it('should validate configuration before saving', async () => {
			const invalidConfig = [{ key: '', label: '' }];
			mockKeyboardService.validateConfiguration.mockReturnValue({
				isValid: false,
				error: 'Invalid configuration'
			});

			await viewModel.updateConfiguration(invalidConfig);

			expect(viewModel.error).toBe('Invalid configuration');
			expect(viewModel.state.toolbarConfig).not.toEqual(invalidConfig);
		});

		it('should add button to configuration', async () => {
			const newButton = { key: 'F1', label: 'F1', symbol: 'F1' };

			await viewModel.addButton(newButton);

			expect(viewModel.state.toolbarConfig).toContain(newButton);
			expect(mockKeyboardService.saveConfiguration).toHaveBeenCalled();
		});

		it('should remove button from configuration', async () => {
			viewModel.state.toolbarConfig = testConfig;

			await viewModel.removeButton('Tab');

			expect(viewModel.state.toolbarConfig).not.toContain(
				expect.objectContaining({ key: 'Tab' })
			);
			expect(mockKeyboardService.saveConfiguration).toHaveBeenCalled();
		});

		it('should reorder buttons in configuration', async () => {
			viewModel.state.toolbarConfig = [...testConfig];

			await viewModel.reorderButtons(0, 2); // Move first to last

			expect(viewModel.state.toolbarConfig[2].key).toBe('Escape');
			expect(mockKeyboardService.saveConfiguration).toHaveBeenCalled();
		});
	});

	describe('Keyboard Detection', () => {
		it('should setup keyboard detection on mobile', async () => {
			await viewModel.setupKeyboardDetection();

			expect(mockKeyboardService.setupKeyboardDetection).toHaveBeenCalledWith({
				isMobile: true,
				threshold: 150,
				onVisibilityChange: expect.any(Function)
			});
		});

		it('should handle keyboard visibility change', async () => {
			const onVisibilityChange = vi.fn();
			mockKeyboardService.setupKeyboardDetection.mockImplementation((options) => {
				options.onVisibilityChange(true, 300);
				return () => {};
			});

			await viewModel.setupKeyboardDetection();

			expect(viewModel.state.visible).toBe(true);
			expect(viewModel.state.keyboardHeight).toBe(300);
		});

		it('should detect keyboard via Visual Viewport API', async () => {
			viewModel.state.detectionMethod = 'visualViewport';
			const mockCleanup = vi.fn();
			mockKeyboardService.setupKeyboardDetection.mockReturnValue(mockCleanup);

			await viewModel.setupKeyboardDetection();

			expect(mockKeyboardService.setupKeyboardDetection).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'visualViewport'
				})
			);
		});

		it('should fallback to window resize detection', async () => {
			viewModel.state.detectionMethod = 'windowResize';

			await viewModel.setupKeyboardDetection();

			expect(mockKeyboardService.setupKeyboardDetection).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'windowResize'
				})
			);
		});

		it('should not setup detection on desktop', async () => {
			viewModel.state.isMobile = false;

			await viewModel.setupKeyboardDetection();

			expect(mockKeyboardService.setupKeyboardDetection).not.toHaveBeenCalled();
		});
	});

	describe('Key Event Handling', () => {
		beforeEach(() => {
			viewModel.state.toolbarConfig = [
				{ key: 'Escape', label: 'Esc', symbol: '⎋' },
				{ key: 'ctrl+c', label: 'Ctrl+C', ctrlKey: true, symbol: '^C' },
				{ key: 'ArrowUp', label: '↑', symbol: '↑' }
			];
		});

		it('should handle button press for simple key', async () => {
			const button = { key: 'Escape', label: 'Esc', symbol: '⎋' };
			const mockCallback = vi.fn();
			mockKeyboardService.generateKeySequence.mockReturnValue('\u001b');

			await viewModel.handleButtonPress(button, mockCallback);

			expect(mockKeyboardService.generateKeySequence).toHaveBeenCalledWith(button);
			expect(mockCallback).toHaveBeenCalledWith('\u001b');
		});

		it('should handle button press for key combination', async () => {
			const button = { key: 'ctrl+c', label: 'Ctrl+C', ctrlKey: true, symbol: '^C' };
			const mockCallback = vi.fn();
			mockKeyboardService.generateKeySequence.mockReturnValue('\u0003');

			await viewModel.handleButtonPress(button, mockCallback);

			expect(mockKeyboardService.generateKeySequence).toHaveBeenCalledWith(button);
			expect(mockCallback).toHaveBeenCalledWith('\u0003');
		});

		it('should handle special keys', async () => {
			const button = { key: 'cmd-palette', label: 'Cmd', isSpecial: true };
			const mockCallback = vi.fn();

			await viewModel.handleButtonPress(button, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({ type: 'special', key: 'cmd-palette' });
		});

		it('should handle modifier keys', async () => {
			const button = { key: 'Control', label: 'Ctrl', isModifier: true };

			await viewModel.handleModifierPress(button);

			expect(viewModel.state.activeModifiers.ctrl).toBe(true);
		});

		it('should clear modifiers after timeout', async () => {
			await viewModel.handleModifierPress({ key: 'Control', isModifier: true });
			expect(viewModel.state.activeModifiers.ctrl).toBe(true);

			// Fast-forward time
			vi.useFakeTimers();
			vi.advanceTimersByTime(5000);

			expect(viewModel.state.activeModifiers.ctrl).toBe(false);
			vi.useRealTimers();
		});

		it('should generate key sequences for arrow keys', async () => {
			const button = { key: 'ArrowUp', symbol: '↑' };
			mockKeyboardService.generateKeySequence.mockReturnValue('\u001b[A');

			const sequence = await viewModel.generateKeySequence(button);

			expect(sequence).toBe('\u001b[A');
			expect(mockKeyboardService.generateKeySequence).toHaveBeenCalledWith(button);
		});

		it('should handle custom key mappings', async () => {
			const customButton = { 
				key: 'custom', 
				label: 'Custom', 
				customSequence: '\u001b[1;5D' 
			};

			const sequence = await viewModel.generateKeySequence(customButton);

			expect(mockKeyboardService.generateKeySequence).toHaveBeenCalledWith(customButton);
		});
	});

	describe('Toolbar State Management', () => {
		it('should show toolbar', () => {
			viewModel.showToolbar();

			expect(viewModel.state.visible).toBe(true);
		});

		it('should hide toolbar', () => {
			viewModel.state.visible = true;

			viewModel.hideToolbar();

			expect(viewModel.state.visible).toBe(false);
		});

		it('should toggle toolbar visibility', () => {
			expect(viewModel.state.visible).toBe(false);

			viewModel.toggleToolbar();
			expect(viewModel.state.visible).toBe(true);

			viewModel.toggleToolbar();
			expect(viewModel.state.visible).toBe(false);
		});

		it('should enter customization mode', () => {
			viewModel.enterCustomizationMode();

			expect(viewModel.state.isCustomizing).toBe(true);
		});

		it('should exit customization mode', () => {
			viewModel.state.isCustomizing = true;

			viewModel.exitCustomizationMode();

			expect(viewModel.state.isCustomizing).toBe(false);
		});

		it('should set mobile mode', () => {
			viewModel.setMobileMode(false);

			expect(viewModel.state.isMobile).toBe(false);
		});

		it('should update keyboard height', () => {
			viewModel.updateKeyboardHeight(250);

			expect(viewModel.state.keyboardHeight).toBe(250);
		});
	});

	describe('Derived State', () => {
		it('should correctly compute hasConfiguration', () => {
			expect(viewModel.hasConfiguration).toBe(false);

			viewModel.updateField('toolbarConfig', [{ key: 'test' }]);
			expect(viewModel.hasConfiguration).toBe(true);
		});

		it('should correctly compute buttonCount', () => {
			expect(viewModel.buttonCount).toBe(0);

			viewModel.updateField('toolbarConfig', [
				{ key: 'key1' }, 
				{ key: 'key2' }
			]);
			expect(viewModel.buttonCount).toBe(2);
		});

		it('should correctly compute isKeyboardVisible', () => {
			viewModel.updateField('keyboardHeight', 0);
			expect(viewModel.isKeyboardVisible).toBe(false);

			viewModel.updateField('keyboardHeight', 200);
			expect(viewModel.isKeyboardVisible).toBe(true);
		});

		it('should correctly compute hasActiveModifiers', () => {
			expect(viewModel.hasActiveModifiers).toBe(false);

			viewModel.updateField('activeModifiers', { ctrl: true, alt: false, shift: false, meta: false });
			expect(viewModel.hasActiveModifiers).toBe(true);
		});
	});

	describe('Key Sequence Processing', () => {
		it('should buffer key sequences', () => {
			viewModel.addToSequenceBuffer('ctrl');
			viewModel.addToSequenceBuffer('c');

			expect(viewModel.state.keySequenceBuffer).toEqual(['ctrl', 'c']);
		});

		it('should clear sequence buffer', () => {
			viewModel.state.keySequenceBuffer = ['ctrl', 'c'];

			viewModel.clearSequenceBuffer();

			expect(viewModel.state.keySequenceBuffer).toEqual([]);
		});

		it('should process complete sequence', async () => {
			viewModel.state.keySequenceBuffer = ['ctrl', 'c'];
			const mockCallback = vi.fn();
			mockKeyboardService.generateKeySequence.mockReturnValue('\u0003');

			await viewModel.processSequence(mockCallback);

			expect(mockCallback).toHaveBeenCalledWith('\u0003');
			expect(viewModel.state.keySequenceBuffer).toEqual([]);
		});

		it('should handle incomplete sequences', async () => {
			viewModel.state.keySequenceBuffer = ['ctrl'];
			const mockCallback = vi.fn();

			await viewModel.processSequence(mockCallback);

			expect(mockCallback).not.toHaveBeenCalled();
			expect(viewModel.state.keySequenceBuffer).toEqual(['ctrl']);
		});
	});

	describe('Error Handling', () => {
		it('should handle configuration loading errors', async () => {
			const error = new Error('Failed to load configuration');
			mockKeyboardService.loadConfiguration.mockImplementation(() => {
				throw error;
			});

			await viewModel.loadConfiguration();

			expect(viewModel.error).toBe('Failed to load configuration');
		});

		it('should handle configuration saving errors', async () => {
			const error = new Error('Failed to save configuration');
			mockKeyboardService.saveConfiguration.mockRejectedValue(error);

			await viewModel.saveConfiguration();

			expect(viewModel.error).toBe('Failed to save configuration');
		});

		it('should handle key detection errors', async () => {
			const error = new Error('Keyboard detection failed');
			mockKeyboardService.setupKeyboardDetection.mockImplementation(() => {
				throw error;
			});

			await viewModel.setupKeyboardDetection();

			expect(viewModel.error).toBe('Keyboard detection failed');
		});
	});

	describe('Integration with BaseViewModel', () => {
		it('should inherit BaseViewModel functionality', () => {
			expect(viewModel.isValid).toBe(true);
			expect(viewModel.loading).toBe(false);
			expect(typeof viewModel.isDirty).toBe('boolean');
			expect(typeof viewModel.hasErrors).toBe('boolean');
		});

		it('should use withLoading for async operations', async () => {
			const testOperation = vi.fn().mockResolvedValue('success');

			await viewModel.withLoading(testOperation);

			expect(testOperation).toHaveBeenCalled();
		});

		it('should handle validation when available', async () => {
			const mockValidation = {
				validate: vi.fn().mockReturnValue({ isValid: true, errors: [] })
			};
			viewModel.services.validationService = mockValidation;

			await viewModel.validate();

			expect(mockValidation.validate).toHaveBeenCalledWith(viewModel.state);
		});
	});

	describe('Disposal and Cleanup', () => {
		it('should dispose properly', () => {
			const cleanup = vi.fn();
			viewModel.addCleanup(cleanup);
			
			expect(viewModel.isDisposed).toBe(false);

			viewModel.dispose();

			expect(viewModel.isDisposed).toBe(true);
			expect(cleanup).toHaveBeenCalled();
			expect(mockModel.dispose).toHaveBeenCalled();
		});

		it('should handle operations after disposal', () => {
			viewModel.dispose();

			// These should not throw or cause issues
			expect(() => {
				viewModel.showToolbar();
				viewModel.loadConfiguration();
				viewModel.handleButtonPress({});
			}).not.toThrow();

			// Verify disposed state
			expect(viewModel.isDisposed).toBe(true);
		});

		it('should clean up event listeners', () => {
			const mockCleanup = vi.fn();
			mockKeyboardService.setupKeyboardDetection.mockReturnValue(mockCleanup);

			viewModel.setupKeyboardDetection();
			viewModel.dispose();

			expect(mockCleanup).toHaveBeenCalled();
		});
	});

	describe('Platform-Specific Behavior', () => {
		it('should handle iOS keyboard detection', async () => {
			viewModel.state.detectionMethod = 'visualViewport';
			Object.defineProperty(window, 'visualViewport', {
				value: { addEventListener: vi.fn(), removeEventListener: vi.fn() }
			});

			await viewModel.setupKeyboardDetection();

			expect(mockKeyboardService.setupKeyboardDetection).toHaveBeenCalledWith(
				expect.objectContaining({ method: 'visualViewport' })
			);
		});

		it('should handle Android keyboard detection', async () => {
			viewModel.state.detectionMethod = 'windowResize';
			Object.defineProperty(window, 'visualViewport', { value: undefined });

			await viewModel.setupKeyboardDetection();

			expect(mockKeyboardService.setupKeyboardDetection).toHaveBeenCalledWith(
				expect.objectContaining({ method: 'windowResize' })
			);
		});

		it('should disable toolbar on desktop', async () => {
			viewModel.setMobileMode(false);
			await viewModel.setupKeyboardDetection();

			expect(viewModel.state.visible).toBe(false);
			expect(mockKeyboardService.setupKeyboardDetection).not.toHaveBeenCalled();
		});
	});
});