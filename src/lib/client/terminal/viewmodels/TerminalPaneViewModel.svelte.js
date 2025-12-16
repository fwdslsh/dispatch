/**
 * TerminalPaneViewModel.svelte.js
 *
 * ViewModel for terminal pane business logic using Svelte 5 runes.
 * Handles session attachment, authentication, event handling, and state management.
 *
 * ARCHITECTURE PRINCIPLES:
 * - Pure business logic (no UI/DOM concerns)
 * - Reactive state management via $state and $derived runes
 * - Single responsibility (terminal session lifecycle)
 * - Testable independently of UI components
 */

import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
import { createLogger } from '$lib/client/shared/utils/logger.js';

const log = createLogger('terminal:viewmodel');

export class TerminalPaneViewModel {
	/**
	 * @param {Object} config - Configuration options
	 * @param {string} config.sessionId - Terminal session ID
	 * @param {string} config.authKey - Authentication key
	 * @param {boolean} [config.shouldResume=false] - Whether to resume with backlog
	 */
	constructor(config) {
		this.sessionId = config.sessionId;
		this.authKey = config.authKey;
		this.shouldResume = config.shouldResume ?? false;

		// Reactive state
		this.isAttached = $state(false);
		this.isCatchingUp = $state(false);
		this.connectionError = $state(null);

		// Event handler reference (set during initialize)
		this.eventHandler = null;

		// Cleanup timeout reference
		this.catchUpTimeoutId = null;
	}

	// =================================================================
	// INITIALIZATION AND LIFECYCLE
	// =================================================================

	/**
	 * Initialize terminal session connection
	 * @param {Function} onEvent - Event handler callback for terminal events
	 * @returns {Promise<{success: boolean, error?: string}>}
	 */
	async initialize(onEvent) {
		// Validate sessionId
		if (!this.sessionId || this.sessionId === 'undefined') {
			const error = 'Invalid sessionId, cannot initialize terminal';
			log.error(error);
			this.connectionError = error;
			return { success: false, error };
		}

		// Store event handler
		this.eventHandler = onEvent;

		try {
			// Authenticate if not already done
			if (!runSessionClient.getStatus().authenticated) {
				log.info('Authenticating with server');
				await runSessionClient.authenticate(this.authKey);
			}

			// Set catching up state if resuming
			this.isCatchingUp = this.shouldResume;

			// Attach to the run session and get backlog
			log.info('Attaching to run session', this.sessionId);
			const result = await runSessionClient.attachToRunSession(
				this.sessionId,
				this._handleRunEvent.bind(this),
				0 // Start from sequence 0 to get all backlog
			);

			this.isAttached = true;
			log.info('Successfully attached to run session', result);

			// Clear catching up state after a delay if no messages arrived
			if (this.shouldResume) {
				this.catchUpTimeoutId = setTimeout(() => {
					if (this.isCatchingUp) {
						this.isCatchingUp = false;
						log.info('Timeout reached, clearing catching up state');
					}
				}, 2000);
			}

			return { success: true };
		} catch (error) {
			log.error('Failed to attach to run session', error);
			const errorMessage = `Failed to connect: ${error.message}`;
			this.connectionError = errorMessage;
			this.isCatchingUp = false;
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Cleanup resources and detach from session
	 */
	cleanup() {
		// Clear timeout if active
		if (this.catchUpTimeoutId) {
			clearTimeout(this.catchUpTimeoutId);
			this.catchUpTimeoutId = null;
		}

		// Detach from run session
		if (this.isAttached && this.sessionId) {
			try {
				runSessionClient.detachFromRunSession(this.sessionId);
				log.info('Detached from run session', this.sessionId);
			} catch (error) {
				log.error('Failed to detach from run session', error);
			}
		}

		// Reset state
		this.isAttached = false;
		this.isCatchingUp = false;
		this.connectionError = null;
	}

	// =================================================================
	// EVENT HANDLING
	// =================================================================

	/**
	 * Handle run events from RunSessionClient
	 * @private
	 * @param {Object} event - Run event object
	 */
	_handleRunEvent(event) {
		try {
			// If we receive output while catching up, clear the flag
			if (this.isCatchingUp) {
				this.isCatchingUp = false;
				log.info('Received output from active session - caught up');
			}

			log.debug('Event received', event);

			// Handle different event channels
			if (event.channel === 'pty:stdout' || event.channel === 'pty:stderr') {
				const data = event.payload;
				if (data && this.eventHandler) {
					// Convert Uint8Array to string if needed
					const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
					this.eventHandler({ type: 'data', data: text });
				}
			} else if (event.channel === 'pty:exit') {
				log.info('Terminal exited with code', event.payload?.exitCode);
				this.isCatchingUp = false;
				if (this.eventHandler) {
					this.eventHandler({ type: 'exit', exitCode: event.payload?.exitCode });
				}
			}
		} catch (error) {
			log.error('Error handling run event', error);
		}
	}

	// =================================================================
	// TERMINAL OPERATIONS
	// =================================================================

	/**
	 * Send input to terminal session
	 * @param {string} data - Input data to send
	 */
	sendInput(data) {
		if (!this.isAttached) {
			log.warn('Cannot send input - not attached to session');
			return;
		}

		try {
			log.debug('Sending input to session', this.sessionId);
			runSessionClient.sendInput(this.sessionId, data);
		} catch (error) {
			log.error('Failed to send input', error);
		}
	}

	/**
	 * Resize terminal session
	 * @param {number} cols - Number of columns
	 * @param {number} rows - Number of rows
	 */
	resizeTerminal(cols, rows) {
		if (!this.isAttached) {
			log.debug('Cannot resize - not attached to session');
			return;
		}

		if (!runSessionClient.getStatus().connected) {
			log.debug('Cannot resize - not connected to server');
			return;
		}

		try {
			runSessionClient.resizeTerminal(this.sessionId, cols, rows);
		} catch (error) {
			log.error('Failed to resize terminal', error);
		}
	}

	// =================================================================
	// STATE QUERIES
	// =================================================================

	/**
	 * Get current connection status
	 * @returns {Object} Status object with connected, authenticated flags
	 */
	getConnectionStatus() {
		return runSessionClient.getStatus();
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			sessionId: this.sessionId,
			isAttached: this.isAttached,
			isCatchingUp: this.isCatchingUp,
			connectionError: this.connectionError,
			shouldResume: this.shouldResume,
			connectionStatus: this.getConnectionStatus()
		};
	}
}
