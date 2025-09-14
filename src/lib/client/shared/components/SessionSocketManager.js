import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

/**
 * @typedef {Object} SocketMetadata
 * @property {string} sessionId - Session identifier
 * @property {boolean} isActive - Whether socket is active
 */

/**
 * SessionSocketManager - Manages socket connections per session pane
 * Ensures each session pane has its own socket context and proper cleanup
 */
class SessionSocketManager {
	constructor() {
		this.sockets = new Map(); // sessionId -> socket instance
		this.socketMetadata = new WeakMap(); // socket -> SocketMetadata
		this.activeSession = null;
	}

	/**
	 * Get or create a socket connection for a specific session
	 * @param {string} sessionId - The session identifier
	 * @param {Object} options - Socket connection options
	 * @returns {import('socket.io-client').Socket} Socket.IO client instance
	 */
	getSocket(sessionId, options = {}) {
		if (this.sockets.has(sessionId)) {
			const existingSocket = this.sockets.get(sessionId);
			// If we're getting an existing socket for an active session,
			// ensure it's connected or reconnecting
			if (!existingSocket.connected && !existingSocket.connecting) {
				console.log(`Existing socket for session ${sessionId} is disconnected, reconnecting...`);
				existingSocket.connect();
			}
			return existingSocket;
		}

		console.log(`Creating new socket for session: ${sessionId}`);
		const socket = io({
			...options,
			// Add session context to socket
			query: {
				sessionId,
				...options.query
			},
			// Ensure immediate connection for active sessions
			autoConnect: true,
			// Reconnection settings for better resilience
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000
		});

		// Track metadata using WeakMap instead of attaching to socket
		this.socketMetadata.set(socket, {
			sessionId,
			isActive: false
		});

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			console.log(`Socket connected for session ${sessionId}`);
			const metadata = this.socketMetadata.get(socket);
			if (metadata) {
				metadata.isActive = true;
			}
		});

		socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
			console.log(`Socket disconnected for session ${sessionId}:`, reason);
			const metadata = this.socketMetadata.get(socket);
			if (metadata) {
				metadata.isActive = false;
			}
		});

		socket.on(SOCKET_EVENTS.ERROR, (error) => {
			console.error(`Socket error for session ${sessionId}:`, error);
		});

		// Add reconnection attempt handler
		socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attemptNumber) => {
			console.log(`Socket reconnection attempt ${attemptNumber} for session ${sessionId}`);
		});

		socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
			console.log(
				`Socket successfully reconnected for session ${sessionId} after ${attemptNumber} attempts`
			);
			const metadata = this.socketMetadata.get(socket);
			if (metadata) {
				metadata.isActive = true;
			}
		});

		this.sockets.set(sessionId, socket);
		return socket;
	}

	/**
	 * Set the active session - this helps with UI focus management
	 * @param {string} sessionId - The session to make active
	 */
	setActiveSession(sessionId) {
		this.activeSession = sessionId;
		console.log(`Active session changed to: ${sessionId}`);
	}

	/**
	 * Get the currently active session ID
	 * @returns {string|null} Active session ID
	 */
	getActiveSession() {
		return this.activeSession;
	}

	/**
	 * Disconnect and cleanup a specific session socket
	 * @param {string} sessionId - The session to cleanup
	 */
	disconnectSession(sessionId) {
		const socket = this.sockets.get(sessionId);
		if (socket) {
			console.log(`Disconnecting socket for session: ${sessionId}`);
			socket.removeAllListeners();
			socket.disconnect();
			this.sockets.delete(sessionId);
		}

		if (this.activeSession === sessionId) {
			this.activeSession = null;
		}
	}

	/**
	 * Cleanup all socket connections
	 */
	disconnectAll() {
		console.log('Disconnecting all session sockets');
		for (const [sessionId, socket] of this.sockets.entries()) {
			socket.removeAllListeners();
			socket.disconnect();
		}
		this.sockets.clear();
		this.activeSession = null;
	}

	/**
	 * Check if a session has an active socket connection
	 * @param {string} sessionId - The session to check
	 * @returns {boolean} True if socket is connected
	 */
	isConnected(sessionId) {
		const socket = this.sockets.get(sessionId);
		if (!socket) return false;

		const metadata = this.socketMetadata.get(socket);
		return socket.connected && (metadata ? metadata.isActive : false);
	}

	/**
	 * Get connection status for all sessions
	 * @returns {Object} Map of sessionId to connection status
	 */
	getConnectionStatus() {
		const status = {};
		for (const [sessionId, socket] of this.sockets.entries()) {
			const metadata = this.socketMetadata.get(socket);
			status[sessionId] = {
				connected: metadata ? metadata.isActive : false,
				id: socket.id
			};
		}
		return status;
	}

	/**
	 * Reconnect a specific session socket
	 * @param {string} sessionId - The session to reconnect
	 */
	reconnectSession(sessionId) {
		const socket = this.sockets.get(sessionId);
		if (socket) {
			console.log(`Reconnecting socket for session: ${sessionId}`);
			socket.connect();
		}
	}

	/**
	 * Handle session focus change - ensures proper socket context
	 * @param {string} sessionId - The session that gained focus
	 */
	handleSessionFocus(sessionId) {
		this.setActiveSession(sessionId);

		// Ensure socket is connected
		const socket = this.sockets.get(sessionId);
		if (socket) {
			if (!socket.connected && !socket.connecting) {
				console.log(
					`Session ${sessionId} gained focus but socket is disconnected, reconnecting...`
				);
				this.reconnectSession(sessionId);
			} else if (socket.connected) {
				console.log(`Session ${sessionId} gained focus and socket is already connected`);
				// Emit a catch-up event to request any missed messages
				// This is useful for active sessions that might have been processing
				const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
				socket.emit(SOCKET_EVENTS.SESSION_CATCHUP, {
					key,
					sessionId,
					timestamp: Date.now()
				});
			} else if (socket.connecting) {
				console.log(`Session ${sessionId} gained focus and socket is connecting...`);
			}
		}
	}

	/**
	 * Check if a session might have pending messages
	 * @param {string} sessionId - The session to check
	 * @returns {Promise<boolean>} True if there might be pending messages
	 */
	async checkForPendingMessages(sessionId) {
		const socket = this.sockets.get(sessionId);
		if (socket && socket.connected) {
			return new Promise((resolve) => {
				const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
				socket.emit(SOCKET_EVENTS.SESSION_STATUS, { key, sessionId }, (response) => {
					resolve(response?.hasPendingMessages || false);
				});
			});
		}
		return false;
	}
}

// Create global singleton instance
const sessionSocketManager = new SessionSocketManager();

export default sessionSocketManager;
