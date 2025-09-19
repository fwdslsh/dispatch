import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

/**
 * SessionSocketManager - Simplified socket management with single shared connection
 * All sessions use the same socket connection with session-based message routing
 */
class SessionSocketManager {
	constructor() {
		this.socket = null; // Single shared socket
		this.activeSessions = new Set(); // Set of active session IDs
		this.activeSession = null; // Currently focused session
		this.lastMessageTimestamps = new Map(); // sessionId -> timestamp
		this.historyLoadPromises = new Map(); // sessionId -> Promise
		this._isConnected = false;
		this._isConnecting = false;
	}

	/**
	 * Get the shared socket connection, creating it if necessary
	 * Automatically associates the session with the socket
	 * @param {string} sessionId - The session identifier to associate
	 * @param {Object} [options] - Socket connection options (only used for initial creation)
	 * @returns {import('socket.io-client').Socket} Socket.IO client instance
	 */
	getSocket(sessionId, options = {}) {
		console.log(`Getting socket for session: ${sessionId}`);

		// Associate this session with the socket
		this.activeSessions.add(sessionId);

		// If we already have a socket, return it
		if (this.socket) {
			console.log(`Using existing shared socket for session ${sessionId}`);

			// Ensure socket is connected
			if (!this.socket.connected && !this._isConnecting) {
				console.log(`Shared socket is disconnected, reconnecting...`);
				this.socket.connect();
			}
			return this.socket;
		}

		// Create the shared socket
		console.log(`Creating shared socket (first session: ${sessionId})`);
		this.socket = io({
			...options,
			// No need to pass sessionId in query since we'll send it with messages
			// Ensure immediate connection
			autoConnect: true,
			// Reconnection settings for better resilience
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000
		});

		// Set up socket event handlers once
		this._setupSocketHandlers();

		return this.socket;
	}

	/**
	 * Set up socket event handlers for the shared connection
	 * @private
	 */
	_setupSocketHandlers() {
		if (!this.socket) return;

		this.socket.on(SOCKET_EVENTS.CONNECTION, () => {
			console.log('Shared socket connected');
			this._isConnected = true;
			this._isConnecting = false;
		});

		this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
			console.log('Shared socket disconnected:', reason);
			this._isConnected = false;
			this._isConnecting = false;
		});

		this.socket.on(SOCKET_EVENTS.ERROR, (error) => {
			console.error('Shared socket error:', error);
		});

		this.socket.on('connecting', () => {
			console.log('Shared socket connecting...');
			this._isConnecting = true;
		});

		this.socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attemptNumber) => {
			console.log(`Shared socket reconnection attempt ${attemptNumber}`);
			this._isConnecting = true;
		});

		this.socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
			console.log(`Shared socket successfully reconnected after ${attemptNumber} attempts`);
			this._isConnected = true;
			this._isConnecting = false;
		});
	}


	/**
	 * Set the active session - this helps with UI focus management
	 * @param {string} sessionId - The session to make active
	 */
	setActiveSession(sessionId) {
		if (this.activeSession !== sessionId) {
			this.activeSession = sessionId;
			console.log(`Active session changed to: ${sessionId}`);
		}
	}

	/**
	 * Get the currently active session ID
	 * @returns {string|null} Active session ID
	 */
	getActiveSession() {
		return this.activeSession;
	}

	/**
	 * Remove a session from the active sessions set
	 * If no sessions remain, disconnect the shared socket
	 * @param {string} sessionId - The session to remove
	 */
	disconnectSession(sessionId) {
		console.log(`Removing session ${sessionId} from active sessions`);

		this.activeSessions.delete(sessionId);

		if (this.activeSession === sessionId) {
			this.activeSession = null;
		}

		// If no sessions remain, disconnect the shared socket
		if (this.activeSessions.size === 0 && this.socket) {
			console.log('No active sessions remain, disconnecting shared socket');
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
			this._isConnected = false;
			this._isConnecting = false;
		}
	}

	/**
	 * Cleanup all sessions and disconnect the shared socket
	 */
	disconnectAll() {
		console.log('Disconnecting all sessions and shared socket');
		this.activeSessions.clear();
		this.activeSession = null;

		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
			this._isConnected = false;
			this._isConnecting = false;
		}
	}

	/**
	 * Check if a session has access to the shared socket connection
	 * @param {string} sessionId - The session to check
	 * @returns {boolean} True if socket is connected and session is active
	 */
	isConnected(sessionId) {
		return this.activeSessions.has(sessionId) && this._isConnected;
	}

	/**
	 * Reconnect the shared socket (affects all sessions)
	 * @param {string} sessionId - The session requesting reconnection (for logging)
	 */
	reconnectSession(sessionId) {
		if (this.socket) {
			console.log(`Reconnecting shared socket (requested by session ${sessionId})`);
			this.socket.connect();
		} else {
			console.log(`No shared socket exists, session ${sessionId} may need to call getSocket()`);
		}
	}

	/**
	 * Handle session focus change - ensures proper socket context
	 * @param {string} sessionId - The session that gained focus
	 */
	handleSessionFocus(sessionId) {
		const wasActiveSession = this.activeSession === sessionId;
		this.setActiveSession(sessionId);

		// Ensure session is registered
		this.activeSessions.add(sessionId);

		// Only do socket work if this is a new active session
		if (!wasActiveSession) {
			// Ensure shared socket is connected
			if (this.socket) {
				if (!this._isConnected && !this._isConnecting) {
					console.log(`Session ${sessionId} gained focus but socket is disconnected, reconnecting...`);
					this.reconnectSession(sessionId);
				} else if (this._isConnected) {
					console.log(`Session ${sessionId} gained focus and socket is already connected`);
					// Emit a catch-up event to request any missed messages
					const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
					this.socket.emit(SOCKET_EVENTS.SESSION_CATCHUP, {
						key,
						sessionId,
						timestamp: Date.now()
					});
				} else if (this._isConnecting) {
					console.log(`Session ${sessionId} gained focus and socket is connecting...`);
				}
			} else {
				console.log(`No socket exists for session ${sessionId} - will be created when needed`);
			}
		}
	}

	/**
	 * Check if a session might have pending messages
	 * @param {string} sessionId - The session to check
	 * @returns {Promise<boolean>} True if there might be pending messages
	 */
	async checkForPendingMessages(sessionId) {
		if (this.socket && this._isConnected) {
			return new Promise((resolve) => {
				const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
				this.socket.emit(SOCKET_EVENTS.SESSION_STATUS, { key, sessionId }, (response) => {
					resolve(response?.hasPendingMessages || false);
				});
			});
		}
		return false;
	}

	/**
	 * Load session history from server buffers
	 * @param {string} sessionId - The session to load history for
	 * @param {number} [sinceTimestamp] - Optional timestamp to load messages since
	 * @returns {Promise<Array>} Array of buffered messages
	 */
	async loadSessionHistory(sessionId, sinceTimestamp = null) {
		// Prevent duplicate history loads for the same session
		if (this.historyLoadPromises.has(sessionId)) {
			console.log(`History load already in progress for session ${sessionId}`);
			return this.historyLoadPromises.get(sessionId);
		}

		if (!this.socket || !this._isConnected) {
			console.warn(`Cannot load history for session ${sessionId}: shared socket not connected`);
			return [];
		}

		const loadPromise = new Promise((resolve, reject) => {
			const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
			const lastTimestamp = sinceTimestamp || this.lastMessageTimestamps.get(sessionId) || 0;

			console.log(`Loading history for session ${sessionId} since timestamp ${lastTimestamp}`);

			// Set up timeout in case server doesn't respond
			const timeout = setTimeout(() => {
				this.historyLoadPromises.delete(sessionId);
				reject(new Error('History load timeout'));
			}, 10000);

			// Request buffered messages from server
			this.socket.emit(
				SOCKET_EVENTS.SESSION_HISTORY_LOAD,
				{
					key,
					sessionId,
					sinceTimestamp: lastTimestamp,
					replay: true // Request messages to be replayed through normal channels
				},
				(response) => {
					clearTimeout(timeout);
					this.historyLoadPromises.delete(sessionId);

					if (response?.error) {
						console.error(`Failed to load history for session ${sessionId}:`, response.error);
						reject(new Error(response.error));
					} else {
						console.log(`Loaded ${response?.messageCount || 0} messages for session ${sessionId}`);
						// Update last timestamp if messages were loaded
						if (response?.messages && response.messages.length > 0) {
							const lastMsg = response.messages[response.messages.length - 1];
							if (lastMsg.timestamp) {
								this.updateLastTimestamp(sessionId, lastMsg.timestamp);
							}
						}
						resolve(response?.messages || []);
					}
				}
			);
		});

		this.historyLoadPromises.set(sessionId, loadPromise);

		try {
			return await loadPromise;
		} catch (error) {
			console.error(`Error loading history for session ${sessionId}:`, error);
			return [];
		}
	}

	/**
	 * Update the last received message timestamp for a session
	 * @param {string} sessionId - The session ID
	 * @param {number} timestamp - The timestamp to update
	 */
	updateLastTimestamp(sessionId, timestamp) {
		const current = this.lastMessageTimestamps.get(sessionId) || 0;
		if (timestamp > current) {
			this.lastMessageTimestamps.set(sessionId, timestamp);
		}
	}

	/**
	 * Automatically associate a session with the shared socket
	 * Creates the socket if it doesn't exist
	 * @param {string} sessionId - The session to register
	 * @param {Object} [options] - Socket options (only used if creating new socket)
	 * @returns {import('socket.io-client').Socket} The shared socket instance
	 */
	registerSession(sessionId, options = {}) {
		console.log(`Registering session ${sessionId} with socket manager`);

		// This is the same as getSocket but with a clearer name for automatic registration
		return this.getSocket(sessionId, options);
	}

	/**
	 * Get all currently active session IDs
	 * @returns {Set<string>} Set of active session IDs
	 */
	getActiveSessions() {
		return new Set(this.activeSessions);
	}

	/**
	 * Check if the shared socket exists and is connected
	 * @returns {boolean} True if socket is connected
	 */
	isSocketConnected() {
		return this.socket && this._isConnected;
	}

}

// Create global singleton instance
const sessionSocketManager = new SessionSocketManager();

export default sessionSocketManager;
