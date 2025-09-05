/**
 * KeyboardToolbarViewModel - ViewModel for keyboard toolbar functionality
 * Extends BaseViewModel with keyboard shortcut management, configuration persistence, and mobile keyboard detection
 * Uses Svelte 5 runes for reactive state management
 */
import { BaseViewModel } from '../$lib/shared/contexts/BaseViewModel.svelte.js';

export class KeyboardToolbarViewModel extends BaseViewModel {
	constructor(model, services = {}) {
		super(model, services);

		// Ensure we have a keyboard service
		if (!services.keyboardService) {
			throw new Error('KeyboardService is required for KeyboardToolbarViewModel');
		}

		// Initialize derived state for keyboard toolbar specific functionality
		this.hasConfiguration = $derived(this.state.toolbarConfig?.length > 0);
		this.buttonCount = $derived(this.state.toolbarConfig?.length || 0);
		this.isKeyboardVisible = $derived(this.state.keyboardHeight > 0);
		this.hasActiveModifiers = $derived(
			Object.values(this.state.activeModifiers || {}).some(active => active)
		);
		this.canCustomize = $derived(!this.state.isCustomizing);
		this.shouldShowToolbar = $derived(this.state.isMobile && this.state.visible);

		// Set up reactive effects
		this._setupEffects();

		// Initialize configuration
		this._initializeConfiguration();
	}

	// ========================================
	// Configuration Management
	// ========================================

	/**
	 * Initialize toolbar configuration from storage or defaults
	 * @private
	 */
	async _initializeConfiguration() {
		if (this.isDisposed) return;

		try {
			// Try to load from storage first
			const stored = this.services.keyboardService.loadConfiguration();
			
			let config;
			if (stored && stored.length > 0) {
				config = stored;
			} else {
				// Fall back to default configuration
				config = this.services.keyboardService.getDefaultConfiguration();
			}

			this.updateField('toolbarConfig', config);
		} catch (error) {
			console.error('Failed to initialize keyboard configuration:', error);
			// Use default config as fallback
			const defaultConfig = this.services.keyboardService.getDefaultConfiguration();
			this.updateField('toolbarConfig', defaultConfig);
		}
	}

	/**
	 * Load toolbar configuration from storage
	 */
	async loadConfiguration() {
		if (this.isDisposed) return;

		return this.withLoading(async () => {
			try {
				this.clearError();

				const config = this.services.keyboardService.loadConfiguration();
				if (config) {
					this.updateField('toolbarConfig', config);
				} else {
					// Load default configuration
					const defaultConfig = this.services.keyboardService.getDefaultConfiguration();
					this.updateField('toolbarConfig', defaultConfig);
				}
			} catch (error) {
				console.error('Configuration loading failed:', error);
				this.setError(error);
			}
		});
	}

	/**
	 * Save current toolbar configuration to storage
	 */
	async saveConfiguration() {
		if (this.isDisposed) return;

		return this.withLoading(async () => {
			try {
				this.clearError();

				const config = this.state.toolbarConfig || [];
				await this.services.keyboardService.saveConfiguration(config);
			} catch (error) {
				console.error('Configuration saving failed:', error);
				this.setError(error);
			}
		});
	}

	/**
	 * Reset configuration to defaults
	 */
	async resetToDefault() {
		if (this.isDisposed) return;

		return this.withLoading(async () => {
			try {
				this.clearError();

				const defaultConfig = this.services.keyboardService.getDefaultConfiguration();
				this.updateField('toolbarConfig', defaultConfig);
				
				await this.services.keyboardService.saveConfiguration(defaultConfig);
			} catch (error) {
				console.error('Configuration reset failed:', error);
				this.setError(error);
			}
		});
	}

	/**
	 * Update toolbar configuration with validation
	 * @param {Array} config - New configuration
	 */
	async updateConfiguration(config) {
		if (this.isDisposed) return;

		try {
			this.clearError();

			// Validate configuration
			const validation = this.services.keyboardService.validateConfiguration(config);
			if (!validation.isValid) {
				this.setError(validation.error);
				return;
			}

			// Update state and save
			this.updateField('toolbarConfig', config);
			await this.saveConfiguration();
		} catch (error) {
			console.error('Configuration update failed:', error);
			this.setError(error);
		}
	}

	/**
	 * Add button to configuration
	 * @param {Object} button - Button configuration
	 */
	async addButton(button) {
		if (this.isDisposed || !button) return;

		const currentConfig = [...(this.state.toolbarConfig || [])];
		
		// Check if button already exists
		const exists = currentConfig.some(btn => btn.key === button.key);
		if (exists) {
			this.setError('Button already exists in configuration');
			return;
		}

		currentConfig.push(button);
		await this.updateConfiguration(currentConfig);
	}

	/**
	 * Remove button from configuration
	 * @param {string} buttonKey - Key of button to remove
	 */
	async removeButton(buttonKey) {
		if (this.isDisposed || !buttonKey) return;

		const currentConfig = [...(this.state.toolbarConfig || [])];
		const updatedConfig = currentConfig.filter(btn => btn.key !== buttonKey);
		
		await this.updateConfiguration(updatedConfig);
	}

	/**
	 * Reorder buttons in configuration
	 * @param {number} fromIndex - Source index
	 * @param {number} toIndex - Target index
	 */
	async reorderButtons(fromIndex, toIndex) {
		if (this.isDisposed) return;

		const config = [...(this.state.toolbarConfig || [])];
		
		if (fromIndex < 0 || fromIndex >= config.length || 
		    toIndex < 0 || toIndex >= config.length) {
			return;
		}

		// Move button from fromIndex to toIndex
		const [removed] = config.splice(fromIndex, 1);
		config.splice(toIndex, 0, removed);

		await this.updateConfiguration(config);
	}

	// ========================================
	// Keyboard Detection
	// ========================================

	/**
	 * Setup keyboard visibility detection
	 */
	async setupKeyboardDetection() {
		if (this.isDisposed) return;

		try {
			this.clearError();

			// Only setup detection on mobile
			if (!this.state.isMobile) {
				this.updateField('visible', false);
				return;
			}

			const cleanup = this.services.keyboardService.setupKeyboardDetection({
				isMobile: this.state.isMobile,
				threshold: 150,
				method: this.state.detectionMethod || 'auto',
				onVisibilityChange: (visible, height) => {
					if (this.isDisposed) return;
					
					this.updateFields({
						visible,
						keyboardHeight: height || 0
					});
				}
			});

			// Store cleanup function
			this.addCleanup(cleanup);

		} catch (error) {
			console.error('Keyboard detection setup failed:', error);
			this.setError(error);
		}
	}

	/**
	 * Detect current keyboard visibility
	 */
	async detectKeyboardVisibility() {
		if (this.isDisposed) return false;

		try {
			return await this.services.keyboardService.detectKeyboardVisibility();
		} catch (error) {
			console.error('Keyboard visibility detection failed:', error);
			return false;
		}
	}

	// ========================================
	// Key Event Handling
	// ========================================

	/**
	 * Handle button press and generate key sequence
	 * @param {Object} button - Button configuration
	 * @param {Function} [onKeySequence] - Callback for key sequence
	 */
	async handleButtonPress(button, onKeySequence = null) {
		if (this.isDisposed || !button) return;

		try {
			this.clearError();

			// Handle special keys
			if (button.isSpecial) {
				if (typeof onKeySequence === 'function') {
					onKeySequence({ type: 'special', key: button.key });
				}
				return;
			}

			// Handle modifier keys
			if (button.isModifier) {
				await this.handleModifierPress(button);
				return;
			}

			// Generate key sequence
			const sequence = this.services.keyboardService.generateKeySequence(button);
			
			if (sequence && typeof onKeySequence === 'function') {
				onKeySequence(sequence);
			}

			// Update active modifiers if this was a key combination
			if (button.ctrlKey || button.altKey || button.shiftKey || button.metaKey) {
				this._updateActiveModifiers(button);
			}

		} catch (error) {
			console.error('Button press handling failed:', error);
			this.setError(error);
		}
	}

	/**
	 * Handle modifier key press
	 * @param {Object} button - Modifier button configuration
	 */
	async handleModifierPress(button) {
		if (this.isDisposed || !button || !button.isModifier) return;

		const modifiers = { ...this.state.activeModifiers };

		// Toggle modifier state
		switch (button.key) {
			case 'Control':
			case 'ControlLeft':
			case 'ControlRight':
				modifiers.ctrl = !modifiers.ctrl;
				break;
			case 'Alt':
			case 'AltLeft':
			case 'AltRight':
				modifiers.alt = !modifiers.alt;
				break;
			case 'Shift':
			case 'ShiftLeft':
			case 'ShiftRight':
				modifiers.shift = !modifiers.shift;
				break;
			case 'Meta':
			case 'MetaLeft':
			case 'MetaRight':
				modifiers.meta = !modifiers.meta;
				break;
		}

		this.updateField('activeModifiers', modifiers);

		// Set timeout to clear modifier
		setTimeout(() => {
			if (this.isDisposed) return;
			
			const currentModifiers = { ...this.state.activeModifiers };
			switch (button.key) {
				case 'Control':
				case 'ControlLeft':
				case 'ControlRight':
					currentModifiers.ctrl = false;
					break;
				case 'Alt':
				case 'AltLeft':
				case 'AltRight':
					currentModifiers.alt = false;
					break;
				case 'Shift':
				case 'ShiftLeft':
				case 'ShiftRight':
					currentModifiers.shift = false;
					break;
				case 'Meta':
				case 'MetaLeft':
				case 'MetaRight':
					currentModifiers.meta = false;
					break;
			}
			this.updateField('activeModifiers', currentModifiers);
		}, 5000); // 5 second timeout
	}

	/**
	 * Generate key sequence for button
	 * @param {Object} button - Button configuration
	 * @returns {Promise<string>} - Generated key sequence
	 */
	async generateKeySequence(button) {
		if (this.isDisposed || !button) return '';

		try {
			return this.services.keyboardService.generateKeySequence(button);
		} catch (error) {
			console.error('Key sequence generation failed:', error);
			return '';
		}
	}

	/**
	 * Update active modifiers based on button
	 * @param {Object} button - Button with modifier keys
	 * @private
	 */
	_updateActiveModifiers(button) {
		const modifiers = {
			ctrl: button.ctrlKey || false,
			alt: button.altKey || false,
			shift: button.shiftKey || false,
			meta: button.metaKey || false
		};

		this.updateField('activeModifiers', modifiers);

		// Clear modifiers after timeout
		setTimeout(() => {
			if (this.isDisposed) return;
			this.updateField('activeModifiers', { ctrl: false, alt: false, shift: false, meta: false });
		}, 1000); // 1 second timeout for combinations
	}

	// ========================================
	// Toolbar State Management
	// ========================================

	/**
	 * Show toolbar
	 */
	showToolbar() {
		if (this.isDisposed) return;
		this.updateField('visible', true);
	}

	/**
	 * Hide toolbar
	 */
	hideToolbar() {
		if (this.isDisposed) return;
		this.updateField('visible', false);
	}

	/**
	 * Toggle toolbar visibility
	 */
	toggleToolbar() {
		if (this.isDisposed) return;
		this.updateField('visible', !this.state.visible);
	}

	/**
	 * Enter customization mode
	 */
	enterCustomizationMode() {
		if (this.isDisposed) return;
		this.updateField('isCustomizing', true);
	}

	/**
	 * Exit customization mode
	 */
	exitCustomizationMode() {
		if (this.isDisposed) return;
		this.updateField('isCustomizing', false);
	}

	/**
	 * Set mobile mode
	 * @param {boolean} isMobile - Whether device is mobile
	 */
	setMobileMode(isMobile) {
		if (this.isDisposed) return;

		this.updateField('isMobile', !!isMobile);

		// Hide toolbar on desktop
		if (!isMobile) {
			this.updateField('visible', false);
		}
	}

	/**
	 * Update keyboard height
	 * @param {number} height - Keyboard height in pixels
	 */
	updateKeyboardHeight(height) {
		if (this.isDisposed) return;
		this.updateField('keyboardHeight', Math.max(0, height || 0));
	}

	// ========================================
	// Key Sequence Processing
	// ========================================

	/**
	 * Add key to sequence buffer
	 * @param {string} key - Key to add
	 */
	addToSequenceBuffer(key) {
		if (this.isDisposed || !key) return;

		const buffer = [...(this.state.keySequenceBuffer || [])];
		buffer.push(key);

		// Limit buffer size
		if (buffer.length > 10) {
			buffer.shift();
		}

		this.updateField('keySequenceBuffer', buffer);
	}

	/**
	 * Clear sequence buffer
	 */
	clearSequenceBuffer() {
		if (this.isDisposed) return;
		this.updateField('keySequenceBuffer', []);
	}

	/**
	 * Process complete key sequence
	 * @param {Function} [onSequence] - Callback for processed sequence
	 */
	async processSequence(onSequence = null) {
		if (this.isDisposed) return;

		const buffer = this.state.keySequenceBuffer || [];
		if (buffer.length === 0) return;

		try {
			// Check if we have a complete sequence
			if (buffer.length >= 2) {
				// Create synthetic button for sequence
				const button = {
					key: buffer.join('+'),
					sequence: buffer
				};

				const sequence = this.services.keyboardService.generateKeySequence(button);
				
				if (sequence && typeof onSequence === 'function') {
					onSequence(sequence);
				}

				this.clearSequenceBuffer();
			}
		} catch (error) {
			console.error('Sequence processing failed:', error);
		}
	}

	// ========================================
	// State Validation and Effects
	// ========================================

	/**
	 * Setup reactive effects for keyboard toolbar
	 * @protected
	 */
	_setupEffects() {
		super._setupEffects();

		// Effect for handling mobile mode changes
		$effect(() => {
			if (this.isDisposed) return;

			// Track mobile mode changes
			const isMobile = this.state.isMobile;
			
			// Setup or teardown keyboard detection based on mobile mode
			if (isMobile) {
				this.setupKeyboardDetection();
			} else {
				this.hideToolbar();
			}
		});

		// Effect for auto-saving configuration changes
		$effect(() => {
			if (this.isDisposed) return;

			// Track configuration changes
			this.state.toolbarConfig;

			// Debounced save
			const timeoutId = setTimeout(() => {
				if (!this.isDisposed && this.state.toolbarConfig?.length > 0) {
					this.saveConfiguration();
				}
			}, 1000);

			this.addCleanup(() => clearTimeout(timeoutId));
		});
	}

	/**
	 * Validate keyboard toolbar state
	 * @returns {boolean} - True if state is valid
	 */
	validateState() {
		if (this.isDisposed) return false;

		const state = this.state;

		// Validate basic state structure
		if (typeof state.visible !== 'boolean') {
			this.setValidationError('visible', 'visible must be a boolean');
			return false;
		}

		if (typeof state.isMobile !== 'boolean') {
			this.setValidationError('isMobile', 'isMobile must be a boolean');
			return false;
		}

		if (!Number.isInteger(state.keyboardHeight) || state.keyboardHeight < 0) {
			this.setValidationError('keyboardHeight', 'keyboardHeight must be a non-negative integer');
			return false;
		}

		if (!Array.isArray(state.toolbarConfig)) {
			this.setValidationError('toolbarConfig', 'toolbarConfig must be an array');
			return false;
		}

		if (state.activeModifiers && typeof state.activeModifiers !== 'object') {
			this.setValidationError('activeModifiers', 'activeModifiers must be an object');
			return false;
		}

		return true;
	}

	// ========================================
	// Disposal and Cleanup
	// ========================================

	/**
	 * Dispose ViewModel and clean up resources
	 */
	dispose() {
		if (this.isDisposed) return;

		// Save configuration before disposal
		if (this.state.toolbarConfig?.length > 0) {
			this.saveConfiguration().catch(console.error);
		}

		// Clear any active sequences
		this.clearSequenceBuffer();

		// Call parent disposal
		super.dispose();
	}
}