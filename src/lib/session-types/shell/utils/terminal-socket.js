/**
 * Terminal Socket Service
 * Handles Socket.IO connections, authentication, and socket events for terminals
 */

import { TERMINAL_CONFIG } from '$lib/session-types/shell/config.js';
import { ErrorHandler } from '$lib/shared/utils/error-handling.js';

export class TerminalSocketService {
	constructor() {
		this.socket = null;
		this.isConnected = false;
		this.isAuthenticated = false;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.eventListeners = new Map();
		this.cleanup = null;
	}

	/**
	 * Initialize socket connection
	 * @param {string} authKey - Authentication key
	 * @returns {Promise<boolean>} Success status
	 */
	async connect(authKey = '') {
		try {
			// Import io here to avoid issues if not available
			const { io } = await import('socket.io-client');

			// Create socket connection
			this.socket = io({
				transports: ['websocket', 'polling'],
				reconnection: true,
				reconnectionAttempts: this.maxReconnectAttempts,
				reconnectionDelay: 1000
			});

			// Set up connection event handlers
			this.setupConnectionHandlers();

			// Authenticate
			return await this.authenticate(authKey);
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalSocketService.connect');
			return false;
		}
	}

	/**
	 * Authenticate with the server
	 * @param {string} authKey - Authentication key
	 * @returns {Promise<boolean>} Authentication success
	 */
	async authenticate(authKey) {
		return new Promise((resolve) => {
			if (!this.socket) {
				resolve(false);
				return;
			}

			this.socket.emit('auth', authKey, (response) => {
				if (response && response.ok) {
					this.isAuthenticated = true;
					console.debug('TerminalSocketService: Authentication successful');
					resolve(true);
				} else {
					console.error('TerminalSocketService: Authentication failed:', response);
					resolve(false);
				}
			});
		});
	}

	/**
	 * Create a new session
	 * @param {Object} sessionOptions - Session creation options
	 * @returns {Promise<Object|null>} Session creation response
	 */
	async createSession(sessionOptions = {}) {
		return new Promise((resolve) => {
			if (!this.socket || !this.isAuthenticated) {
				resolve(null);
				return;
			}

			const defaultOptions = {
				mode: 'shell',
				...TERMINAL_CONFIG.DEFAULT_DIMENSIONS
			};

			const options = { ...defaultOptions, ...sessionOptions };

			this.socket.emit('create', options, (response) => {
				if (response && response.ok) {
					console.debug('TerminalSocketService: Session created:', response.sessionId);
					resolve(response);
				} else {
					console.error('TerminalSocketService: Session creation failed:', response);
					resolve(null);
				}
			});
		});
	}

	/**
	 * Create a session within a project
	 * @param {string} projectId - Project ID
	 * @param {Object} sessionOptions - Session creation options
	 * @returns {Promise<Object|null>} Session creation response
	 */
	async createSessionInProject(projectId, sessionOptions = {}) {
		return new Promise((resolve) => {
			if (!this.socket || !this.isAuthenticated) {
				resolve(null);
				return;
			}

			const options = {
				projectId,
				mode: 'shell',
				...TERMINAL_CONFIG.DEFAULT_DIMENSIONS,
				...sessionOptions
			};

			this.socket.emit('create-session-in-project', options, (response) => {
				if (response && response.success) {
					console.debug('TerminalSocketService: Session created in project:', response.sessionId);
					resolve(response);
				} else {
					console.error('TerminalSocketService: Project session creation failed:', response);
					resolve(null);
				}
			});
		});
	}

	/**
	 * Attach to an existing session
	 * @param {string} sessionId - Session ID to attach to
	 * @param {Object} dimensions - Terminal dimensions
	 * @returns {Promise<boolean>} Attach success
	 */
	async attachToSession(sessionId, dimensions = {}) {
		return new Promise((resolve) => {
			if (!this.socket || !this.isAuthenticated) {
				resolve(false);
				return;
			}

			const attachOptions = {
				sessionId,
				...TERMINAL_CONFIG.DEFAULT_DIMENSIONS,
				...dimensions
			};

			this.socket.emit('attach', attachOptions, (response) => {
				if (response && (response.ok || response.success)) {
					console.debug('TerminalSocketService: Attached to session:', sessionId);
					resolve(response);
				} else {
					console.error('TerminalSocketService: Attach failed:', response);
					resolve({ success: false, error: response?.error || 'Attach failed' });
				}
			});
		});
	}

	/**
	 * Send input to session
	 * @param {string} data - Input data
	 * @param {string} sessionId - Session ID
	 */
	sendInput(data, sessionId) {
		if (this.socket && this.isAuthenticated && sessionId) {
			this.socket.emit('input', data, sessionId);
		}
	}

	/**
	 * Resize session terminal
	 * @param {number} cols - Columns
	 * @param {number} rows - Rows
	 */
	resizeSession(cols, rows) {
		if (this.socket && this.isAuthenticated) {
			this.socket.emit('resize', { cols, rows });
		}
	}

	/**
	 * End a session
	 * @param {string} sessionId - Session ID to end
	 */
	endSession(sessionId) {
		if (this.socket && this.isAuthenticated && sessionId) {
			this.socket.emit('end', sessionId);
		}
	}

	/**
	 * Listen for socket events
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 * @returns {Function} Unsubscribe function
	 */
	on(event, handler) {
		if (!this.socket) {
			return () => {};
		}

		this.socket.on(event, handler);

		// Store for cleanup
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event).add(handler);

		// Return unsubscribe function
		return () => {
			if (this.socket) {
				this.socket.off(event, handler);
			}
			const handlers = this.eventListeners.get(event);
			if (handlers) {
				handlers.delete(handler);
			}
		};
	}

	/**
	 * Setup connection event handlers
	 */
	setupConnectionHandlers() {
		if (!this.socket) return;

		this.socket.on('connect', () => {
			this.isConnected = true;
			this.reconnectAttempts = 0;
			console.debug('TerminalSocketService: Connected');
		});

		this.socket.on('disconnect', (reason) => {
			this.isConnected = false;
			this.isAuthenticated = false;
			console.debug('TerminalSocketService: Disconnected:', reason);
		});

		this.socket.on('connect_error', (error) => {
			console.error('TerminalSocketService: Connection error:', error);
			this.reconnectAttempts++;
		});

		this.socket.on('reconnect', (attempt) => {
			console.debug('TerminalSocketService: Reconnected after', attempt, 'attempts');
		});

		this.socket.on('reconnect_failed', () => {
			console.error(
				'TerminalSocketService: Reconnection failed after',
				this.maxReconnectAttempts,
				'attempts'
			);
		});
	}

	/**
	 * Get connection status
	 * @returns {Object} Connection status
	 */
	getStatus() {
		return {
			isConnected: this.isConnected,
			isAuthenticated: this.isAuthenticated,
			reconnectAttempts: this.reconnectAttempts,
			socketId: this.socket?.id || null
		};
	}

	/**
	 * Disconnect and cleanup
	 */
	disconnect() {
		if (this.socket) {
			// Remove all event listeners
			for (const [event, handlers] of this.eventListeners.entries()) {
				for (const handler of handlers) {
					this.socket.off(event, handler);
				}
			}
			this.eventListeners.clear();

			// Disconnect socket
			this.socket.disconnect();
			this.socket = null;
		}

		this.isConnected = false;
		this.isAuthenticated = false;
		this.reconnectAttempts = 0;

		console.debug('TerminalSocketService: Disconnected and cleaned up');
	}

	/**
	 * Set external socket (for use with externally managed socket connections)
	 * @param {Object} socket - External socket instance
	 */
	setSocket(socket) {
		if (this.socket && this.socket !== socket) {
			// Clean up existing socket
			this.disconnect();
		}

		this.socket = socket;
		this.isConnected = socket?.connected || false;
		this.isAuthenticated = true; // Assume external socket is already authenticated

		console.debug('TerminalSocketService: Using external socket:', socket?.id);
	}

	/**
	 * Get the raw socket instance (use with caution)
	 * @returns {Socket|null} Socket instance
	 */
	getSocket() {
		return this.socket;
	}
}
