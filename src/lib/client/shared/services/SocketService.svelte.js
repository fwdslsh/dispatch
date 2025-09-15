/**
 * SocketService.js
 *
 * Centralized Socket.IO management service.
 * Provides unified socket connection, event handling, and session management.
 */

import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

/**
 * @typedef {Object} SocketConfig
 * @property {string} url - Socket.IO server URL
 * @property {string} socketUrl - Alternative URL property
 * @property {string} apiBaseUrl - API base URL
 * @property {string} authTokenKey - Auth token key
 * @property {boolean} debug - Debug flag
 * @property {Object} options - Socket.IO connection options
 * @property {boolean} autoReconnect - Auto-reconnect on failure
 * @property {number} reconnectAttempts - Maximum reconnect attempts
 * @property {number} reconnectDelay - Delay between reconnect attempts
 */

export class SocketService {
	/**
	 * @param {Partial<SocketConfig>} [config]
	 */
	constructor(config = {}) {
		this.config = {
			url: '',
			options: {},
			autoReconnect: true,
			reconnectAttempts: 5,
			reconnectDelay: 1000,
			...config
		};

		// Socket state
		this.socket = null;
		this.connected = $state(false);
		this.connecting = $state(false);
		this.authenticated = $state(false);

		// Connection info
		this.connectionId = $state(null);
		this.reconnectAttempt = $state(0);
		this.lastError = $state(null);

		// Event handlers
		this.eventHandlers = new Map();
		this.sessionHandlers = new Map(); // sessionId -> handlers

		// Message queues for offline/reconnect scenarios
		this.messageQueue = [];
		this.maxQueueSize = 100;
	}

	/**
	 * Connect to the socket server
	 * @param {Object} options - Connection options
	 */
	async connect(options = {}) {
		if (this.socket?.connected) {
			return this.socket;
		}

		this.connecting = true;
		this.lastError = null;

		try {
			// Create socket connection
			this.socket = io(this.config.url, {
				...this.config.options,
				...options,
				autoConnect: false,
				reconnection: this.config.autoReconnect,
				reconnectionAttempts: this.config.reconnectAttempts,
				reconnectionDelay: this.config.reconnectDelay
			});

			// Setup core event handlers
			this.setupCoreHandlers();

			// Connect
			this.socket.connect();

			// Wait for connection
			await this.waitForConnection();

			return this.socket;
		} catch (error) {
			this.lastError = error.message;
			this.connecting = false;
			throw error;
		}
	}

	/**
	 * Disconnect from the socket server
	 */
	disconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}

		this.connected = false;
		this.connecting = false;
		this.authenticated = false;
		this.connectionId = null;
		this.reconnectAttempt = 0;
	}

	/**
	 * Setup core socket event handlers
	 */
	setupCoreHandlers() {
		if (!this.socket) return;

		// Connection events
		this.socket.on('connect', () => {
			console.log('[SocketService] Connected:', this.socket.id);
			this.connected = true;
			this.connecting = false;
			this.connectionId = this.socket.id;
			this.reconnectAttempt = 0;

			// Process queued messages
			this.processMessageQueue();
		});

		this.socket.on('disconnect', (reason) => {
			console.log('[SocketService] Disconnected:', reason);
			this.connected = false;
			this.authenticated = false;
			this.connectionId = null;
		});

		this.socket.on('connect_error', (error) => {
			console.error('[SocketService] Connection error:', error);
			this.lastError = error.message;
			this.connecting = false;
		});

		// Reconnection events
		this.socket.on('reconnect', (attemptNumber) => {
			console.log('[SocketService] Reconnected after', attemptNumber, 'attempts');
			this.reconnectAttempt = 0;
		});

		this.socket.on('reconnect_attempt', (attemptNumber) => {
			console.log('[SocketService] Reconnect attempt:', attemptNumber);
			this.reconnectAttempt = attemptNumber;
		});

		this.socket.on('reconnect_failed', () => {
			console.error('[SocketService] Reconnection failed');
			this.lastError = 'Reconnection failed';
		});

		// Error handling
		this.socket.on('error', (error) => {
			console.error('[SocketService] Socket error:', error);
			this.lastError = error.message || 'Socket error';
		});
	}

	/**
	 * Wait for socket connection
	 * @returns {Promise}
	 */
	waitForConnection() {
		return new Promise((resolve, reject) => {
			if (this.socket?.connected) {
				resolve(this.socket);
				return;
			}

			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error('Connection timeout'));
			}, 10000);

			const onConnect = () => {
				cleanup();
				resolve(this.socket);
			};

			const onError = (error) => {
				cleanup();
				reject(error);
			};

			const cleanup = () => {
				clearTimeout(timeout);
				this.socket?.off('connect', onConnect);
				this.socket?.off('connect_error', onError);
			};

			this.socket?.on('connect', onConnect);
			this.socket?.on('connect_error', onError);
		});
	}

	/**
	 * Authenticate with the server
	 * @param {string} key - Authentication key
	 * @returns {Promise<boolean>}
	 */
	async authenticate(key) {
		if (!this.socket?.connected) {
			throw new Error('Socket not connected');
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Authentication timeout'));
			}, 5000);

			this.socket.emit('auth', key, (response) => {
				clearTimeout(timeout);

				if (response?.success) {
					this.authenticated = true;
					resolve(true);
				} else {
					this.authenticated = false;
					reject(new Error(response?.error || 'Authentication failed'));
				}
			});
		});
	}

	/**
	 * Send a message to the server
	 * @param {string} event - Event name
	 * @param {*} data - Data to send
	 * @param {Function} callback - Optional callback
	 */
	emit(event, data, callback) {
		if (!this.socket?.connected) {
			// Queue message for later if not connected
			this.queueMessage(event, data, callback);
			return;
		}

		if (callback) {
			this.socket.emit(event, data, callback);
		} else {
			this.socket.emit(event, data);
		}
	}

	/**
	 * Listen for server events
	 * @param {string} event - Event name
	 * @param {(...args: any[]) => void} handler - Event handler
	 * @returns {Function} Cleanup function
	 */
	on(event, handler) {
		if (!this.socket) return () => {};

		this.socket.on(event, handler);

		// Store handler for cleanup
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}
		this.eventHandlers.get(event).add(handler);

		// Return cleanup function
		return () => {
			this.off(event, handler);
		};
	}

	/**
	 * Remove event listener
	 * @param {string} event - Event name
	 * @param {(...args: any[]) => void} handler - Event handler
	 */
	off(event, handler) {
		if (this.socket) {
			this.socket.off(event, handler);
		}

		// Remove from stored handlers
		if (this.eventHandlers.has(event)) {
			this.eventHandlers.get(event).delete(handler);
		}
	}

	/**
	 * Listen for events once
	 * @param {string} event - Event name
	 * @param {(...args: any[]) => void} handler - Event handler
	 */
	once(event, handler) {
		if (this.socket) {
			this.socket.once(event, handler);
		}
	}

	/**
	 * Register session-specific event handlers
	 * @param {string} sessionId - Session ID
	 * @param {Object} handlers - Event handlers object
	 * @returns {Function} Cleanup function
	 */
	registerSessionHandlers(sessionId, handlers) {
		const cleanupFunctions = [];

		// Register each handler
		for (const [event, handler] of Object.entries(handlers)) {
			const wrappedHandler = (data) => {
				// Only call handler if data is for this session
				if (data?.sessionId === sessionId) {
					handler(data);
				}
			};

			const cleanup = this.on(event, wrappedHandler);
			cleanupFunctions.push(cleanup);
		}

		// Store cleanup functions
		this.sessionHandlers.set(sessionId, cleanupFunctions);

		// Return cleanup function for all handlers
		return () => {
			this.unregisterSessionHandlers(sessionId);
		};
	}

	/**
	 * Unregister session-specific event handlers
	 * @param {string} sessionId - Session ID
	 */
	unregisterSessionHandlers(sessionId) {
		const cleanupFunctions = this.sessionHandlers.get(sessionId);
		if (cleanupFunctions) {
			cleanupFunctions.forEach((cleanup) => cleanup());
			this.sessionHandlers.delete(sessionId);
		}
	}

	/**
	 * Queue message for sending when connection is available
	 * @param {string} event - Event name
	 * @param {*} data - Data to send
	 * @param {Function} callback - Optional callback
	 */
	queueMessage(event, data, callback) {
		if (this.messageQueue.length >= this.maxQueueSize) {
			// Remove oldest message
			this.messageQueue.shift();
		}

		this.messageQueue.push({
			event,
			data,
			callback,
			timestamp: Date.now()
		});
	}

	/**
	 * Process queued messages
	 */
	processMessageQueue() {
		const queue = [...this.messageQueue];
		this.messageQueue = [];

		// Filter out old messages (older than 30 seconds)
		const now = Date.now();
		const validMessages = queue.filter((msg) => now - msg.timestamp < 30000);

		// Send valid messages
		for (const msg of validMessages) {
			this.emit(msg.event, msg.data, msg.callback);
		}
	}

	/**
	 * Get connection status
	 * @returns {Object}
	 */
	getStatus() {
		return {
			connected: this.connected,
			connecting: this.connecting,
			authenticated: this.authenticated,
			connectionId: this.connectionId,
			reconnectAttempt: this.reconnectAttempt,
			lastError: this.lastError,
			queuedMessages: this.messageQueue.length
		};
	}

	/**
	 * Check if socket is ready for communication
	 * @returns {boolean}
	 */
	isReady() {
		return this.connected && this.authenticated;
	}

	/**
	 * Force reconnection
	 */
	reconnect() {
		if (this.socket) {
			this.socket.disconnect();
			this.socket.connect();
		}
	}

	/**
	 * Clear all event handlers
	 */
	clearAllHandlers() {
		// Clear session handlers
		for (const cleanupFunctions of this.sessionHandlers.values()) {
			cleanupFunctions.forEach((cleanup) => cleanup());
		}
		this.sessionHandlers.clear();

		// Clear regular handlers
		if (this.socket) {
			for (const [event, handlers] of this.eventHandlers.entries()) {
				for (const handler of handlers) {
					this.socket.off(event, handler);
				}
			}
		}
		this.eventHandlers.clear();
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.clearAllHandlers();
		this.disconnect();
		this.messageQueue = [];
	}
}
