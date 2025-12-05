import { logger } from '../shared/utils/logger.js';
import { EventEmitter } from 'node:events';
import { SESSION_TYPE } from '../../shared/session-types.js';

/**
 * Web View adapter for web browsing sessions
 * Provides a simple adapter interface for embedding web content in an iframe
 */
export class WebViewAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory (not used but required for adapter interface)
	 * @param {Object} [params.options={}] - Web view options
	 * @param {string} [params.options.initialUrl] - Initial URL to load
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		const workingDirectory = cwd || process.env.WORKSPACES_ROOT || process.env.HOME;

		const proc = new WebViewProcess({
			cwd: workingDirectory,
			options,
			onEvent
		});

		await proc.initialize();

		// Return adapter interface matching the expected structure
		return {
			kind: SESSION_TYPE.WEB_VIEW,
			input: {
				write(data) {
					// Web view receives URL navigation commands via input
					proc.handleInput(data);
				}
			},
			close() {
				proc.close();
			},
			getCwd() {
				return proc.getCwd();
			},
			isAlive() {
				return proc.isAlive();
			},
			// Expose the process for any direct access needed
			getProcess() {
				return proc;
			}
		};
	}
}

/**
 * Web View process that handles navigation events
 */
class WebViewProcess extends EventEmitter {
	constructor({ cwd, options, onEvent }) {
		super();
		this.cwd = cwd;
		this.options = options;
		this.onEvent = onEvent;
		this.isActive = false;
		this.currentUrl = options.initialUrl || '';
	}

	async initialize() {
		this.isActive = true;

		// Emit initialization event with error handling
		try {
			this.onEvent({
				channel: 'web-view:system',
				type: 'initialized',
				payload: {
					cwd: this.cwd,
					initialUrl: this.currentUrl,
					timestamp: Date.now()
				}
			});
		} catch (error) {
			logger.error('WEB_VIEW_ADAPTER', 'Error in initialize event handler:', error);
		}

		logger.info('WEB_VIEW_ADAPTER', `Web view session initialized with URL: ${this.currentUrl}`);
	}

	/**
	 * Handle input data - expects URL navigation commands
	 * @param {string|Uint8Array} data - Input data (URL to navigate to)
	 */
	handleInput(data) {
		if (!this.isActive) return;

		// Convert to string if needed
		const text = typeof data === 'string' ? data : new TextDecoder().decode(data);

		try {
			// Parse input as JSON command or treat as URL string
			let url = text.trim();

			// Try parsing as JSON command first
			try {
				const command = JSON.parse(text);
				if (command && typeof command === 'object' && command.type === 'navigate') {
					if (typeof command.url !== 'string' || !command.url) {
						throw new Error('Invalid URL in navigate command');
					}
					url = command.url;

					// Validate URL format and protocol
					const parsed = new URL(url);
					if (!['http:', 'https:'].includes(parsed.protocol)) {
						throw new Error('Only HTTP and HTTPS protocols are allowed');
					}
				}
			} catch (parseError) {
				// Not JSON or invalid JSON, treat as plain URL - but still validate it
				if (url && parseError.message !== 'Invalid URL in navigate command') {
					const testUrl = url.startsWith('http') ? url : `http://${url}`;
					const parsed = new URL(testUrl);
					if (!['http:', 'https:'].includes(parsed.protocol)) {
						throw new Error('Only HTTP and HTTPS protocols are allowed');
					}
					url = parsed.href;
				}
			}

			if (url) {
				this.currentUrl = url;

				// Emit navigation event
				this.onEvent({
					channel: 'web-view:navigation',
					type: 'url-changed',
					payload: {
						url: this.currentUrl,
						timestamp: Date.now()
					}
				});

				logger.debug('WEB_VIEW_ADAPTER', `Navigated to: ${this.currentUrl}`);
			}
		} catch (error) {
			logger.error('WEB_VIEW_ADAPTER', 'Error in handleInput:', error);
			this.sendError(error);
		}
	}

	/**
	 * Send error
	 * @param {Object} error - Error data
	 */
	sendError(error) {
		if (!this.isActive) return;

		try {
			this.onEvent({
				channel: 'web-view:error',
				type: 'error',
				payload: {
					message: error.message || 'Unknown error',
					stack: error.stack,
					timestamp: Date.now()
				}
			});
		} catch (eventError) {
			logger.error('WEB_VIEW_ADAPTER', 'Error in sendError event handler:', eventError);
		}
	}

	/**
	 * Close the web view session
	 */
	close() {
		if (!this.isActive) return;

		this.isActive = false;
		try {
			this.onEvent({
				channel: 'web-view:system',
				type: 'closed',
				payload: {
					timestamp: Date.now()
				}
			});
		} catch (error) {
			logger.error('WEB_VIEW_ADAPTER', 'Error in close event handler:', error);
		}

		this.removeAllListeners();
		logger.info('WEB_VIEW_ADAPTER', 'Web view session closed');
	}

	/**
	 * Get current working directory
	 */
	getCwd() {
		return this.cwd;
	}

	/**
	 * Check if session is active
	 */
	isAlive() {
		return this.isActive;
	}
}
