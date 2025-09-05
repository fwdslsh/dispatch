/**
 * SocketService
 * Wrapper around Socket.IO client with error handling, reconnection, and event management
 */

import { io } from 'socket.io-client';

export class SocketService {
	/**
	 * Create a SocketService
	 * @param {string} [namespace='/'] - Socket.IO namespace
	 * @param {Object} [options] - Configuration options
	 */
	constructor(namespace = '/', options = {}) {
		this.namespace = namespace;
		this.options = {
			autoConnect: true,
			maxReconnectAttempts: 5,
			reconnectDelay: 1000,
			emitTimeout: 5000,
			...options
		};

		// Internal state
		this._socket = null;
		this._connected = false;
		this._connecting = false;
		this._authenticated = false;
		this.connectionAttempts = 0;
		this._lastError = null;
		this._eventHandlers = new Map();

		// Auto-connect if enabled
		if (this.options.autoConnect) {
			this.connect().catch(error => {
				console.warn('Auto-connect failed:', error);
			});
		}
	}

	/**
	 * Connect to the socket server
	 * @returns {Promise<void>}
	 */
	async connect() {
		if (this._connected || this._connecting) {
			return Promise.resolve();
		}

		this._connecting = true;
		this.connectionAttempts++;

		try {
			if (!this._socket) {
				this._socket = io(this.namespace, {
					autoConnect: false,
					forceNew: true,
					...this.options.socketOptions
				});

				this._setupEventHandlers();
			}

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(this._createError('CONNECTION_TIMEOUT', 'Connection timeout'));
				}, this.options.emitTimeout);

				this._socket.once('connect', () => {
					clearTimeout(timeout);
					this._connected = true;
					this._connecting = false;
					this.connectionAttempts = 0;
					this._lastError = null;
					resolve();
				});

				this._socket.once('connect_error', (error) => {
					clearTimeout(timeout);
					this._connecting = false;
					this._lastError = error;
					reject(error);
				});

				this._socket.connect();
			});
		} catch (error) {
			this._connecting = false;
			this._lastError = error;
			throw error;
		}
	}

	/**
	 * Disconnect from the socket server
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		if (!this._socket) {
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			this._socket.once('disconnect', () => {
				this._connected = false;
				this._authenticated = false;
				resolve();
			});

			this._socket.disconnect();
		});
	}

	/**
	 * Emit an event and wait for response
	 * @param {string} event - Event name
	 * @param {*} data - Data to send
	 * @returns {Promise<*>} Response from server
	 */
	async emit(event, data) {
		if (!this._connected) {
			throw this._createError('NOT_CONNECTED', 'Socket not connected');
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(this._createError('EMIT_TIMEOUT', 'Emit timeout'));
			}, this.options.emitTimeout);

			this._socket.emit(event, data, (response) => {
				clearTimeout(timeout);
				resolve(response);
			});
		});
	}

	/**
	 * Emit an event without waiting for response
	 * @param {string} event - Event name
	 * @param {*} data - Data to send
	 */
	emitNoResponse(event, data) {
		if (!this._connected) {
			throw this._createError('NOT_CONNECTED', 'Socket not connected');
		}

		this._socket.emit(event, data);
	}

	/**
	 * Add event listener
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 */
	on(event, handler) {
		if (!this._socket) {
			throw this._createError('NO_SOCKET', 'Socket not initialized');
		}

		// Wrap handler to track it
		const wrappedHandler = (...args) => handler(...args);
		
		// Store reference for cleanup
		if (!this._eventHandlers.has(event)) {
			this._eventHandlers.set(event, new Set());
		}
		this._eventHandlers.get(event).add({ original: handler, wrapped: wrappedHandler });

		this._socket.on(event, wrappedHandler);
	}

	/**
	 * Add one-time event listener
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 */
	once(event, handler) {
		if (!this._socket) {
			throw this._createError('NO_SOCKET', 'Socket not initialized');
		}

		this._socket.once(event, handler);
	}

	/**
	 * Remove event listener
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler
	 */
	off(event, handler) {
		if (!this._socket) {
			return;
		}

		// Find and remove the wrapped handler
		const eventHandlers = this._eventHandlers.get(event);
		if (eventHandlers) {
			for (const handlerPair of eventHandlers) {
				if (handlerPair.original === handler) {
					this._socket.off(event, handlerPair.wrapped);
					eventHandlers.delete(handlerPair);
					break;
				}
			}

			if (eventHandlers.size === 0) {
				this._eventHandlers.delete(event);
			}
		}
	}

	/**
	 * Remove all listeners for an event
	 * @param {string} [event] - Event name, or all events if not specified
	 */
	removeAllListeners(event) {
		if (!this._socket) {
			return;
		}

		if (event) {
			this._socket.removeAllListeners(event);
			this._eventHandlers.delete(event);
		} else {
			this._socket.removeAllListeners();
			this._eventHandlers.clear();
		}
	}

	/**
	 * Authenticate with the server
	 * @param {string} key - Authentication key
	 * @returns {Promise<Object>} Authentication response
	 */
	async auth(key) {
		const response = await this.emit('auth', key);
		this._authenticated = response.success || response.ok || false;
		return response;
	}

	/**
	 * Perform health check
	 * @returns {Promise<boolean>} True if healthy
	 */
	async healthCheck() {
		if (!this._connected) {
			return false;
		}

		try {
			const response = await this.emit('ping');
			return response === 'pong';
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get connection status
	 * @returns {Object} Status object
	 */
	getStatus() {
		return {
			connected: this._connected,
			connecting: this._connecting,
			authenticated: this._authenticated,
			connectionAttempts: this.connectionAttempts,
			lastError: this._lastError
		};
	}

	/**
	 * Setup internal event handlers
	 * @private
	 */
	_setupEventHandlers() {
		this._socket.on('connect', () => {
			this._connected = true;
			this._connecting = false;
			this.connectionAttempts = 0;
			this._lastError = null;
		});

		this._socket.on('disconnect', (reason) => {
			this._connected = false;
			this._authenticated = false;

			// Attempt reconnection on unexpected disconnects
			if (reason === 'io server disconnect' || reason === 'transport close') {
				this._attemptReconnect();
			}
		});

		this._socket.on('connect_error', (error) => {
			this._connecting = false;
			this._lastError = error;
			this._emitError(error);
		});

		this._socket.on('error', (error) => {
			this._lastError = error;
			this._emitError(error);
		});
	}

	/**
	 * Attempt to reconnect
	 * @private
	 */
	_attemptReconnect() {
		if (this.connectionAttempts >= this.options.maxReconnectAttempts) {
			this._emitError(this._createError('MAX_RECONNECT_ATTEMPTS', 'Max reconnection attempts reached'));
			return;
		}

		setTimeout(() => {
			this.connect().catch(error => {
				console.warn('Reconnection failed:', error);
			});
		}, this.options.reconnectDelay);
	}

	/**
	 * Emit error to listeners
	 * @private
	 */
	_emitError(error) {
		// Find error event handlers and call them
		const errorHandlers = this._eventHandlers.get('error');
		if (errorHandlers) {
			errorHandlers.forEach(({ original }) => {
				try {
					original(error);
				} catch (handlerError) {
					console.error('Error handler threw:', handlerError);
				}
			});
		}
	}

	/**
	 * Create a structured error
	 * @private
	 */
	_createError(code, message) {
		const error = new Error(message);
		error.code = code;
		error.timestamp = new Date();
		return error;
	}

	/**
	 * Clean up all resources
	 */
	dispose() {
		if (this._socket) {
			this._socket.removeAllListeners();
			this._socket.disconnect();
			this._socket = null;
		}

		this._eventHandlers.clear();
		this._connected = false;
		this._connecting = false;
		this._authenticated = false;
	}

	// Getters for public API
	get isConnected() {
		return this._connected;
	}

	get isConnecting() {
		return this._connecting;
	}

	get isAuthenticated() {
		return this._authenticated;
	}

	get socket() {
		return this._socket;
	}
}