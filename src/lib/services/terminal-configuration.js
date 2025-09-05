/**
 * Terminal Configuration Service
 * Handles terminal initialization, addons, theming, and configuration
 */

import { TERMINAL_CONFIG } from '../config/constants.js';
import { ErrorHandler } from '../utils/error-handling.js';

export class TerminalConfigurationService {
	constructor() {
		this.terminal = null;
		this.fitAddon = null;
		this.resizeObserver = null;
		this.inputDisposable = null;
		this.isInitialized = false;
	}

	/**
	 * Get default terminal options
	 * @returns {Object} Terminal options
	 */
	getDefaultOptions() {
		return {
			convertEol: true,
			cursorBlink: true,
			fontFamily: 'Courier New, monospace',
			scrollback: 10000,
			disableStdin: false,
			theme: {
				background: '#0a0a0a',
				foreground: '#ffffff',
				cursor: '#00ff88',
				cursorAccent: '#0a0a0a',
				selectionBackground: 'rgba(0, 255, 136, 0.3)',
				black: '#0a0a0a',
				red: '#ff6b6b',
				green: '#00ff88',
				yellow: '#ffeb3b',
				blue: '#2196f3',
				magenta: '#e91e63',
				cyan: '#00bcd4',
				white: '#ffffff',
				brightBlack: '#666666',
				brightRed: '#ff5252',
				brightGreen: '#69f0ae',
				brightYellow: '#ffff00',
				brightBlue: '#448aff',
				brightMagenta: '#ff4081',
				brightCyan: '#18ffff',
				brightWhite: '#ffffff'
			}
		};
	}

	/**
	 * Initialize terminal with configuration
	 * @param {Object} terminal - Terminal instance
	 * @param {Object} customOptions - Custom terminal options
	 * @returns {Promise<boolean>} Success status
	 */
	async initialize(terminal, customOptions = {}) {
		try {
			this.terminal = terminal;

			// Just setup the basic addons - no complex configuration
			await this.setupAddons();

			// Basic resize handling
			this.setupResizeHandling();

			this.isInitialized = true;
			console.debug('TerminalConfigurationService: Initialized');
			return true;
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalConfigurationService.initialize');
			return false;
		}
	}

	/**
	 * Setup terminal addons
	 */
	async setupAddons() {
		try {
			if (!this.terminal) {
				throw new Error('Terminal not set');
			}

			// Import and setup FitAddon
			const { XtermAddon } = await import('@battlefieldduck/xterm-svelte');
			const FitAddon = (await XtermAddon.FitAddon()).FitAddon;

			this.fitAddon = new FitAddon();
			this.terminal.loadAddon(this.fitAddon);

			// Store fitAddon reference for keyboard handling
			this.terminal._fitAddon = this.fitAddon;

			// Ensure the terminal fits after DOM is ready
			setTimeout(() => {
				if (this.fitAddon) {
					this.fitAddon.fit();
				}
			}, TERMINAL_CONFIG.FIT_DELAY_MS || 100);

			console.debug('TerminalConfigurationService: Addons loaded');
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalConfigurationService.setupAddons');
		}
	}

	/**
	 * Setup resize handling for the terminal
	 */
	setupResizeHandling() {
		if (!this.terminal || !this.fitAddon) {
			return;
		}

		const resize = () => {
			if (this.fitAddon) {
				try {
					this.fitAddon.fit();
				} catch (error) {
					console.warn('Error during terminal fit:', error);
				}
			}
		};

		// ResizeObserver for container changes
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(resize);
			const terminalElement = this.terminal.element?.parentElement;
			if (terminalElement) {
				this.resizeObserver.observe(terminalElement);
			}
		}

		console.debug('TerminalConfigurationService: Resize handling setup');
	}

	/**
	 * Fit terminal to container
	 */
	fit() {
		if (this.fitAddon) {
			try {
				this.fitAddon.fit();
			} catch (error) {
				console.warn('Error during terminal fit:', error);
			}
		}
	}

	/**
	 * Get terminal dimensions
	 * @returns {Object} Terminal dimensions
	 */
	getDimensions() {
		if (this.terminal) {
			return {
				cols: this.terminal.cols,
				rows: this.terminal.rows
			};
		}
		return TERMINAL_CONFIG.DEFAULT_DIMENSIONS;
	}

	/**
	 * Resize terminal
	 * @param {number} cols - Columns
	 * @param {number} rows - Rows
	 */
	resize(cols, rows) {
		if (this.terminal) {
			try {
				this.terminal.resize(cols, rows);
			} catch (error) {
				console.warn('Error during terminal resize:', error);
			}
		}
	}

	/**
	 * Write data to terminal
	 * @param {string} data - Data to write
	 */
	write(data) {
		if (this.terminal) {
			try {
				this.terminal.write(data);
			} catch (error) {
				console.warn('Error writing to terminal:', error);
			}
		}
	}

	/**
	 * Write line to terminal
	 * @param {string} data - Data to write as a line
	 */
	writeln(data) {
		if (this.terminal) {
			try {
				this.terminal.writeln(data);
			} catch (error) {
				console.warn('Error writing line to terminal:', error);
			}
		}
	}

	/**
	 * Clear terminal
	 */
	clear() {
		if (this.terminal) {
			try {
				this.terminal.clear();
			} catch (error) {
				console.warn('Error clearing terminal:', error);
			}
		}
	}

	/**
	 * Focus terminal
	 */
	focus() {
		if (this.terminal) {
			try {
				this.terminal.focus();
			} catch (error) {
				console.warn('Error focusing terminal:', error);
			}
		}
	}

	/**
	 * Setup input handler
	 * @param {Function} onDataHandler - Data handler function
	 * @returns {Function} Disposable function
	 */
	setupInputHandler(onDataHandler) {
		if (!this.terminal || typeof onDataHandler !== 'function') {
			console.warn('TerminalConfigurationService: No terminal or invalid handler provided');
			return () => {};
		}

		try {
			// CRITICAL: Clean up any existing input handler first to prevent duplication
			if (this.inputDisposable) {
				if (typeof this.inputDisposable.dispose === 'function') {
					this.inputDisposable.dispose();
				}
				this.inputDisposable = null;
			}

			// Set up onData event handler for user input
			this.inputDisposable = this.terminal.onData((data) => {
				console.debug(
					'Terminal received input data:',
					JSON.stringify(data),
					'length:',
					data.length
				);
				// Send the data to PTY via the handler
				onDataHandler(data);
			});

			console.debug(
				'TerminalConfigurationService: Input handler setup complete - terminal ready for input'
			);

			return () => {
				if (this.inputDisposable && typeof this.inputDisposable.dispose === 'function') {
					this.inputDisposable.dispose();
					this.inputDisposable = null;
				}
			};
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalConfigurationService.setupInputHandler');
			return () => {};
		}
	}

	/**
	 * Get terminal buffer content
	 * @returns {string} Buffer content
	 */
	getBufferContent() {
		if (!this.terminal || !this.terminal.buffer) {
			return '';
		}

		try {
			const buffer = this.terminal.buffer.active;
			if (!buffer) return '';

			let content = '';
			for (let i = 0; i < buffer.length; i++) {
				const line = buffer.getLine(i);
				if (line) {
					content += line.translateToString(true) + '\n';
				}
			}
			return content;
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalConfigurationService.getBufferContent', false);
			return '';
		}
	}

	/**
	 * Apply theme to terminal
	 * @param {Object} theme - Theme object
	 */
	applyTheme(theme) {
		if (this.terminal && theme) {
			try {
				this.terminal.options.theme = { ...this.terminal.options.theme, ...theme };
			} catch (error) {
				console.warn('Error applying theme:', error);
			}
		}
	}

	/**
	 * Set terminal font
	 * @param {string} fontFamily - Font family
	 * @param {number} fontSize - Font size
	 */
	setFont(fontFamily, fontSize) {
		if (this.terminal) {
			try {
				if (fontFamily) {
					this.terminal.options.fontFamily = fontFamily;
				}
				if (fontSize) {
					this.terminal.options.fontSize = fontSize;
				}
			} catch (error) {
				console.warn('Error setting font:', error);
			}
		}
	}

	/**
	 * Get terminal instance
	 * @returns {Object|null} Terminal instance
	 */
	getTerminal() {
		return this.terminal;
	}

	/**
	 * Check if terminal is initialized
	 * @returns {boolean} Initialization status
	 */
	isTerminalInitialized() {
		return this.isInitialized && this.terminal !== null;
	}

	/**
	 * Cleanup resources
	 */
	cleanup() {
		// Cleanup input handler
		if (this.inputDisposable) {
			if (typeof this.inputDisposable.dispose === 'function') {
				this.inputDisposable.dispose();
			}
			this.inputDisposable = null;
		}

		// Cleanup resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		// Cleanup fit addon
		this.fitAddon = null;

		// Reset terminal reference
		this.terminal = null;
		this.isInitialized = false;

		console.debug('TerminalConfigurationService: Cleaned up');
	}

	/**
	 * Destroy the service
	 */
	destroy() {
		this.cleanup();
		console.debug('TerminalConfigurationService: Destroyed');
	}
}
