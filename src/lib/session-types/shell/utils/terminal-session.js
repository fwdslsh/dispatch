/**
 * Terminal Session Service
 * Manages terminal session lifecycle, state, and coordination
 */

import { TERMINAL_CONFIG } from '../config.js';
import { STORAGE_CONFIG } from '$lib/shared/utils/constants.js';
import { ErrorHandler, SafeStorage } from '$lib/shared/utils/error-handling.js';
import { TerminalHistoryService } from './terminal-history.js';

export class TerminalSessionService {
	constructor(socketService) {
		this.socketService = socketService;
		this.sessionId = null;
		this.projectId = null;
		this.isOwnSession = false; // Track if we created our own session
		this.historyService = null;
		this.status = 'disconnected'; // disconnected, connecting, connected, attached
		this.sessionInfo = null;
		this.eventSubscriptions = [];
	}

	/**
	 * Create a new session
	 * @param {Object} options - Session creation options
	 * @returns {Promise<boolean>} Success status
	 */
	async createSession(options = {}) {
		try {
			this.status = 'connecting';

			const response = await this.socketService.createSession(options);

			if (response && response.sessionId) {
				this.sessionId = response.sessionId;
				this.isOwnSession = true;
				this.status = 'connected';
				this.sessionInfo = response;

				// Initialize history service
				this.initializeHistoryService();

				// Store session ID for persistence
				this.storeSessionId();

				console.debug('TerminalSessionService: Session created:', this.sessionId);
				return true;
			} else {
				this.status = 'disconnected';
				return false;
			}
		} catch (error) {
			this.status = 'disconnected';
			ErrorHandler.handle(error, 'TerminalSessionService.createSession');
			return false;
		}
	}

	/**
	 * Create a session within a project
	 * @param {string} projectId - Project ID
	 * @param {Object} options - Session creation options
	 * @returns {Promise<boolean>} Success status
	 */
	async createSessionInProject(projectId, options = {}) {
		try {
			this.status = 'connecting';
			this.projectId = projectId;

			const response = await this.socketService.createSessionInProject(projectId, options);

			if (response && response.sessionId) {
				this.sessionId = response.sessionId;
				this.isOwnSession = true;
				this.status = 'connected';
				this.sessionInfo = response;

				// Initialize history service
				this.initializeHistoryService();

				// Store session ID for persistence
				this.storeSessionId();

				console.debug(
					'TerminalSessionService: Session created in project:',
					this.sessionId,
					'project:',
					projectId
				);
				return true;
			} else {
				this.status = 'disconnected';
				return false;
			}
		} catch (error) {
			this.status = 'disconnected';
			ErrorHandler.handle(error, 'TerminalSessionService.createSessionInProject');
			return false;
		}
	}

	/**
	 * Attach to an existing session
	 * @param {string} sessionId - Session ID to attach to
	 * @param {Object} dimensions - Terminal dimensions
	 * @returns {Promise<boolean>} Success status
	 */
	async attachToSession(sessionId, dimensions = {}) {
		try {
			this.status = 'connecting';

			const success = await this.socketService.attachToSession(sessionId, dimensions);

			if (success) {
				this.sessionId = sessionId;
				this.isOwnSession = false;
				this.status = 'attached';

				// Initialize history service
				this.initializeHistoryService();

				console.debug('TerminalSessionService: Attached to session:', sessionId);
				return true;
			} else {
				this.status = 'disconnected';
				return false;
			}
		} catch (error) {
			this.status = 'disconnected';
			ErrorHandler.handle(error, 'TerminalSessionService.attachToSession');
			return false;
		}
	}

	/**
	 * Use an externally provided session and attach to it
	 * @param {string} sessionId - Session ID
	 * @param {string} projectId - Project ID (optional)
	 * @returns {Promise<boolean>} Success status
	 */
	async useExternalSession(sessionId, projectId = null) {
		try {
			this.sessionId = sessionId;
			this.projectId = projectId;
			this.isOwnSession = false;
			this.status = 'connecting';

			// Actually attach to the existing PTY session via socket
			const response = await this.socketService.attachToSession(sessionId, { cols: 80, rows: 24 });

			if (response && (response.success || response.ok)) {
				this.status = 'connected';
				this.sessionInfo = response;

				// Initialize history service
				this.initializeHistoryService();

				console.debug('TerminalSessionService: Attached to external session:', sessionId);
				return true;
			} else {
				this.status = 'disconnected';
				console.error(
					'TerminalSessionService: Failed to attach to external session:',
					response?.error
				);
				return false;
			}
		} catch (error) {
			this.status = 'disconnected';
			console.error('TerminalSessionService: Error attaching to external session:', error);
			return false;
		}
	}

	/**
	 * Initialize history service for the current session
	 */
	initializeHistoryService() {
		if (this.sessionId && !this.historyService) {
			this.historyService = new TerminalHistoryService(this.sessionId);
			console.debug(
				'TerminalSessionService: History service initialized for session:',
				this.sessionId
			);
		}
	}

	/**
	 * Send input to the session
	 * @param {string} data - Input data
	 */
	sendInput(data) {
		if (this.sessionId && this.socketService) {
			this.socketService.sendInput(data, this.sessionId);

			// Add to history
			if (this.historyService) {
				this.historyService.addEntry(data, 'input');
			}
		}
	}

	/**
	 * Resize the session terminal
	 * @param {number} cols - Columns
	 * @param {number} rows - Rows
	 */
	resize(cols, rows) {
		if (this.socketService) {
			this.socketService.resizeSession(cols, rows);
		}
	}

	/**
	 * End the session
	 */
	endSession() {
		if (this.sessionId && this.socketService && this.isOwnSession) {
			this.socketService.endSession(this.sessionId);
		}
		this.cleanup();
	}

	/**
	 * Store session ID for persistence
	 */
	storeSessionId() {
		if (this.sessionId) {
			SafeStorage.setItem(STORAGE_CONFIG.SESSION_ID_KEY, this.sessionId);
		}
	}

	/**
	 * Load stored session ID
	 * @returns {string|null} Stored session ID
	 */
	loadStoredSessionId() {
		return SafeStorage.getItem(STORAGE_CONFIG.SESSION_ID_KEY, null);
	}

	/**
	 * Clear stored session ID
	 */
	clearStoredSessionId() {
		SafeStorage.removeItem(STORAGE_CONFIG.SESSION_ID_KEY);
	}

	/**
	 * Get session history
	 * @returns {string} Session history
	 */
	getHistory() {
		if (this.historyService) {
			const history = this.historyService.load();
			console.debug(
				`TerminalSessionService: Loaded ${history.length} chars from history for session ${this.sessionId}`
			);
			return history;
		}
		console.debug(`TerminalSessionService: No history service for session ${this.sessionId}`);
		return '';
	}

	/**
	 * Add output to history
	 * @param {string} data - Output data
	 */
	addToHistory(data) {
		if (this.historyService && data && data.length > 0) {
			this.historyService.addEntry(data, 'output');
			console.debug(
				`TerminalSessionService: Added ${data.length} chars to history for session ${this.sessionId}`
			);
		} else if (!this.historyService) {
			console.warn(`TerminalSessionService: No history service for session ${this.sessionId}`);
		}
	}

	/**
	 * Update terminal buffer in history
	 * @param {Object} terminal - Terminal instance
	 */
	updateBuffer(terminal) {
		if (this.historyService) {
			this.historyService.updateBuffer(terminal);
		}
	}

	/**
	 * Get current buffer content
	 * @returns {string} Current buffer content
	 */
	getCurrentBuffer() {
		return this.historyService ? this.historyService.getCurrentBuffer() : '';
	}

	/**
	 * Clear session history
	 */
	clearHistory() {
		if (this.historyService) {
			this.historyService.clear();
		}
	}

	/**
	 * Get session statistics
	 * @returns {Object} Session statistics
	 */
	getStats() {
		const historyStats = this.historyService ? this.historyService.getStats() : {};

		return {
			sessionId: this.sessionId,
			projectId: this.projectId,
			status: this.status,
			isOwnSession: this.isOwnSession,
			socketStatus: this.socketService.getStatus(),
			...historyStats
		};
	}

	/**
	 * Get session info
	 * @returns {Object} Session information
	 */
	getSessionInfo() {
		return {
			sessionId: this.sessionId,
			projectId: this.projectId,
			status: this.status,
			isOwnSession: this.isOwnSession,
			sessionInfo: this.sessionInfo
		};
	}

	/**
	 * Subscribe to socket events
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 * @returns {Function} Unsubscribe function
	 */
	onSocketEvent(event, handler) {
		const unsubscribe = this.socketService.on(event, handler);
		this.eventSubscriptions.push(unsubscribe);
		return unsubscribe;
	}

	/**
	 * Check if session is active
	 * @returns {boolean} Whether session is active
	 */
	isActive() {
		return this.status === 'connected' || this.status === 'attached';
	}

	/**
	 * Check if session is connected
	 * @returns {boolean} Whether session is connected
	 */
	isConnected() {
		return this.status === 'connected';
	}

	/**
	 * Check if session is attached
	 * @returns {boolean} Whether session is attached
	 */
	isAttached() {
		return this.status === 'attached';
	}

	/**
	 * Cleanup resources
	 */
	cleanup() {
		// Unsubscribe from socket events
		this.eventSubscriptions.forEach((unsubscribe) => unsubscribe());
		this.eventSubscriptions = [];

		// Cleanup history service
		if (this.historyService) {
			this.historyService.destroy();
			this.historyService = null;
		}

		// Clear stored session ID if we own the session
		if (this.isOwnSession) {
			this.clearStoredSessionId();
		}

		// Reset state
		this.sessionId = null;
		this.projectId = null;
		this.isOwnSession = false;
		this.status = 'disconnected';
		this.sessionInfo = null;

		console.debug('TerminalSessionService: Cleaned up');
	}

	/**
	 * Destroy the service
	 */
	destroy() {
		this.cleanup();
		console.debug('TerminalSessionService: Destroyed');
	}
}
