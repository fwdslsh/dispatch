/**
 * KeyboardService - Service for keyboard shortcut management and mobile keyboard detection
 * Handles key sequence generation, configuration persistence, and keyboard visibility detection
 * Provides platform-specific keyboard detection for mobile devices
 */
export class KeyboardService {
	constructor(options = {}) {
		this.options = {
			storageKey: 'keyboardToolbarConfig',
			configVersion: 1,
			keyboardThreshold: 150, // Height difference threshold for keyboard detection
			modifierTimeout: 5000, // Modifier key timeout in ms
			maxSequenceLength: 10,
			...options
		};

		this.listeners = [];
		this.detectionCleanup = null;
		this.isDisposed = false;
		this.cleanupCallbacks = [];
	}

	// ========================================
	// Configuration Management
	// ========================================

	/**
	 * Get default keyboard toolbar configuration
	 * @returns {Array} - Default button configuration
	 */
	getDefaultConfiguration() {
		return [
			{ key: 'cmd-palette', label: 'Cmd', code: 'F1', symbol: '⌘', isSpecial: true },
			{ key: 'Escape', label: 'Esc', code: 'Escape', symbol: '⎋' },
			{ key: 'Tab', label: 'Tab', code: 'Tab', symbol: '↹' },
			{ key: 'Control', label: 'Ctrl', code: 'ControlLeft', symbol: '^', isModifier: true },
			{ key: 'Alt', label: 'Alt', code: 'AltLeft', symbol: '⌥', isModifier: true },
			{ key: 'ArrowUp', label: '↑', code: 'ArrowUp', symbol: '↑' },
			{ key: 'ArrowDown', label: '↓', code: 'ArrowDown', symbol: '↓' },
			{ key: 'ArrowLeft', label: '←', code: 'ArrowLeft', symbol: '←' },
			{ key: 'ArrowRight', label: '→', code: 'ArrowRight', symbol: '→' },
			{ key: 'ctrl+c', label: 'Ctrl+C', code: 'KeyC', ctrlKey: true, symbol: '^C' },
			{ key: 'ctrl+z', label: 'Ctrl+Z', code: 'KeyZ', ctrlKey: true, symbol: '^Z' },
			{ key: 'pipe', label: '|', code: 'Backslash', shiftKey: true, symbol: '|' },
			{ key: 'tilde', label: '~', code: 'Backquote', shiftKey: true, symbol: '~' }
		];
	}

	/**
	 * Load configuration from localStorage
	 * @returns {Array|null} - Loaded configuration or null if not found
	 */
	loadConfiguration() {
		if (typeof localStorage === 'undefined') return null;

		try {
			const stored = localStorage.getItem(this.options.storageKey);
			if (!stored) return null;

			const config = JSON.parse(stored);
			if (config.version === this.options.configVersion && Array.isArray(config.buttons)) {
				return config.buttons;
			}
		} catch (error) {
			console.warn('Failed to load keyboard toolbar config:', error);
		}
		
		return null;
	}

	/**
	 * Save configuration to localStorage
	 * @param {Array} configuration - Button configuration to save
	 */
	async saveConfiguration(configuration) {
		if (this.isDisposed || typeof localStorage === 'undefined') return;

		try {
			const configData = {
				buttons: configuration,
				version: this.options.configVersion,
				timestamp: Date.now()
			};

			localStorage.setItem(this.options.storageKey, JSON.stringify(configData));
		} catch (error) {
			console.warn('Failed to save keyboard toolbar config:', error);
			throw new Error('Failed to save keyboard configuration');
		}
	}

	/**
	 * Validate configuration structure
	 * @param {Array} configuration - Configuration to validate
	 * @returns {Object} - Validation result
	 */
	validateConfiguration(configuration) {
		if (!Array.isArray(configuration)) {
			return { isValid: false, error: 'Configuration must be an array' };
		}

		for (let i = 0; i < configuration.length; i++) {
			const button = configuration[i];
			
			if (!button || typeof button !== 'object') {
				return { isValid: false, error: `Button at index ${i} must be an object` };
			}

			if (!button.key || typeof button.key !== 'string') {
				return { isValid: false, error: `Button at index ${i} must have a valid key` };
			}

			if (!button.label || typeof button.label !== 'string') {
				return { isValid: false, error: `Button at index ${i} must have a valid label` };
			}
		}

		return { isValid: true };
	}

	// ========================================
	// Key Sequence Generation
	// ========================================

	/**
	 * Generate key sequence string for terminal input
	 * @param {Object} button - Button configuration
	 * @returns {string} - Terminal key sequence
	 */
	generateKeySequence(button) {
		if (!button || !button.key) return '';

		// Handle custom sequences first
		if (button.customSequence) {
			return button.customSequence;
		}

		// Handle special keys
		if (button.isSpecial) {
			return button.key || '';
		}

		// Handle standard key mappings
		switch (button.key) {
			case 'Escape':
				return '\u001b'; // ESC
			case 'Tab':
				return '\t';
			case 'ArrowUp':
				return '\u001b[A';
			case 'ArrowDown':
				return '\u001b[B';
			case 'ArrowRight':
				return '\u001b[C';
			case 'ArrowLeft':
				return '\u001b[D';
			case 'ctrl+c':
				return '\u0003'; // Ctrl+C
			case 'ctrl+z':
				return '\u001a'; // Ctrl+Z
			case 'pipe':
				return '|';
			case 'tilde':
				return '~';
			case 'ctrl+a':
				return '\u0001'; // Ctrl+A (beginning of line)
			case 'ctrl+e':
				return '\u0005'; // Ctrl+E (end of line)
			case 'ctrl+u':
				return '\u0015'; // Ctrl+U (clear line)
			case 'ctrl+k':
				return '\u000b'; // Ctrl+K (clear to end)
			case 'ctrl+l':
				return '\u000c'; // Ctrl+L (clear screen)
			case 'ctrl+d':
				return '\u0004'; // Ctrl+D (EOF)
			default:
				// Handle generic control combinations
				if (button.ctrlKey && button.code && button.code.startsWith('Key')) {
					const char = button.code.replace('Key', '').toLowerCase();
					const charCode = char.charCodeAt(0) - 96; // Convert to control character
					if (charCode >= 1 && charCode <= 26) {
						return String.fromCharCode(charCode);
					}
				}

				// Handle modifier keys (return empty string as they're just state)
				if (button.isModifier) {
					return '';
				}

				// Default to the key itself
				return button.key;
		}
	}

	/**
	 * Parse key code to extract key information
	 * @param {string} keyCode - Key code to parse
	 * @returns {Object} - Parsed key information
	 */
	parseKeyCode(keyCode) {
		const parts = keyCode.toLowerCase().split('+');
		const result = {
			key: parts[parts.length - 1],
			code: keyCode,
			ctrlKey: parts.includes('ctrl') || parts.includes('control'),
			altKey: parts.includes('alt'),
			shiftKey: parts.includes('shift'),
			metaKey: parts.includes('meta') || parts.includes('cmd')
		};

		return result;
	}

	/**
	 * Check if a key is a modifier key
	 * @param {string} key - Key to check
	 * @returns {boolean} - True if modifier key
	 */
	isModifierKey(key) {
		const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'ControlLeft', 'ControlRight', 
		                      'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'];
		return modifierKeys.includes(key);
	}

	// ========================================
	// Keyboard Detection
	// ========================================

	/**
	 * Setup keyboard visibility detection for mobile devices
	 * @param {Object} options - Detection options
	 * @returns {Function} - Cleanup function
	 */
	setupKeyboardDetection(options = {}) {
		if (this.isDisposed || typeof window === 'undefined') {
			return () => {};
		}

		const {
			isMobile = true,
			threshold = this.options.keyboardThreshold,
			method = 'auto',
			onVisibilityChange = () => {}
		} = options;

		if (!isMobile) {
			return () => {};
		}

		// Determine detection method
		let detectionMethod = method;
		if (method === 'auto') {
			detectionMethod = window.visualViewport ? 'visualViewport' : 'windowResize';
		}

		// Clean up previous detection
		if (this.detectionCleanup) {
			this.detectionCleanup();
		}

		let keyboardVisible = false;

		if (detectionMethod === 'visualViewport' && window.visualViewport) {
			// Visual Viewport API (preferred method for iOS)
			const handleViewportChange = () => {
				const heightDiff = window.innerHeight - window.visualViewport.height;
				const wasVisible = keyboardVisible;
				keyboardVisible = heightDiff > threshold;

				if (keyboardVisible !== wasVisible) {
					onVisibilityChange(keyboardVisible, heightDiff);

					// Update body class for CSS targeting
					if (keyboardVisible) {
						document.body.classList.add('keyboard-toolbar-visible');
					} else {
						document.body.classList.remove('keyboard-toolbar-visible');
					}
				}
			};

			window.visualViewport.addEventListener('resize', handleViewportChange);

			this.detectionCleanup = () => {
				window.visualViewport.removeEventListener('resize', handleViewportChange);
				document.body.classList.remove('keyboard-toolbar-visible');
			};

		} else {
			// Fallback to window resize detection (for Android)
			const initialHeight = window.innerHeight;

			const handleWindowResize = () => {
				const currentHeight = window.innerHeight;
				const heightDiff = initialHeight - currentHeight;
				const wasVisible = keyboardVisible;
				keyboardVisible = heightDiff > threshold;

				if (keyboardVisible !== wasVisible) {
					onVisibilityChange(keyboardVisible, heightDiff);

					if (keyboardVisible) {
						document.body.classList.add('keyboard-toolbar-visible');
					} else {
						document.body.classList.remove('keyboard-toolbar-visible');
					}
				}
			};

			window.addEventListener('resize', handleWindowResize);

			this.detectionCleanup = () => {
				window.removeEventListener('resize', handleWindowResize);
				document.body.classList.remove('keyboard-toolbar-visible');
			};
		}

		return this.detectionCleanup;
	}

	/**
	 * Detect if keyboard is currently visible
	 * @returns {Promise<boolean>} - Promise resolving to keyboard visibility
	 */
	async detectKeyboardVisibility() {
		if (typeof window === 'undefined') return false;

		if (window.visualViewport) {
			const heightDiff = window.innerHeight - window.visualViewport.height;
			return heightDiff > this.options.keyboardThreshold;
		}

		// Fallback detection method
		return false;
	}

	// ========================================
	// Event Management
	// ========================================

	/**
	 * Add keyboard event listener
	 * @param {string} eventType - Event type to listen for
	 * @param {EventListener} handler - Event handler function
	 * @returns {Function} - Cleanup function
	 */
	addKeyboardListener(eventType, handler) {
		if (this.isDisposed || typeof window === 'undefined') {
			return () => {};
		}

		const listener = { eventType, handler };
		this.listeners.push(listener);

		window.addEventListener(eventType, handler);

		return () => {
			window.removeEventListener(eventType, handler);
			const index = this.listeners.indexOf(listener);
			if (index > -1) {
				this.listeners.splice(index, 1);
			}
		};
	}

	/**
	 * Remove specific keyboard event listener
	 * @param {string} eventType - Event type
	 * @param {EventListener} handler - Handler function to remove
	 */
	removeKeyboardListener(eventType, handler) {
		if (typeof window === 'undefined') return;

		window.removeEventListener(eventType, handler);

		this.listeners = this.listeners.filter(
			listener => !(listener.eventType === eventType && listener.handler === handler)
		);
	}

	// ========================================
	// Configuration and Setup
	// ========================================

	/**
	 * Update service options
	 * @param {Object} newOptions - New option values
	 */
	updateOptions(newOptions) {
		if (this.isDisposed) return;
		
		this.options = {
			...this.options,
			...newOptions
		};
	}

	/**
	 * Add cleanup callback
	 * @param {Function} callback - Cleanup function
	 */
	addCleanup(callback) {
		if (typeof callback === 'function') {
			this.cleanupCallbacks.push(callback);
		}
	}

	// ========================================
	// Service Disposal
	// ========================================

	/**
	 * Dispose service and clean up resources
	 */
	dispose() {
		if (this.isDisposed) return;

		this.isDisposed = true;

		// Clean up keyboard detection
		if (this.detectionCleanup) {
			this.detectionCleanup();
			this.detectionCleanup = null;
		}

		// Remove all event listeners
		this.listeners.forEach(listener => {
			if (typeof window !== 'undefined') {
				window.removeEventListener(listener.eventType, listener.handler);
			}
		});
		this.listeners = [];

		// Run cleanup callbacks
		this.cleanupCallbacks.forEach((callback) => {
			try {
				callback();
			} catch (error) {
				console.error('Keyboard service cleanup callback failed:', error);
			}
		});
		this.cleanupCallbacks = [];

		// Clear references
		this.options = null;
	}
}