import { io } from 'socket.io-client';

/**
 * SessionSocketManager - Manages socket connections per session pane
 * Ensures each session pane has its own socket context and proper cleanup
 */
class SessionSocketManager {
	constructor() {
		this.sockets = new Map(); // sessionId -> socket instance
		this.activeSession = null;
	}

	/**
	 * Get or create a socket connection for a specific session
	 * @param {string} sessionId - The session identifier
	 * @param {Object} options - Socket connection options
	 * @returns {Socket} Socket.IO client instance
	 */
	getSocket(sessionId, options = {}) {
		if (this.sockets.has(sessionId)) {
			return this.sockets.get(sessionId);
		}

		console.log(`Creating new socket for session: ${sessionId}`);
		const socket = io({
			...options,
			// Add session context to socket
			query: {
				sessionId,
				...options.query
			}
		});

		// Track connection status
		socket.sessionId = sessionId;
		socket.isActive = false;

		socket.on('connect', () => {
			console.log(`Socket connected for session ${sessionId}`);
			socket.isActive = true;
		});

		socket.on('disconnect', (reason) => {
			console.log(`Socket disconnected for session ${sessionId}:`, reason);
			socket.isActive = false;
		});

		socket.on('error', (error) => {
			console.error(`Socket error for session ${sessionId}:`, error);
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
		return socket && socket.isActive;
	}

	/**
	 * Get connection status for all sessions
	 * @returns {Object} Map of sessionId to connection status
	 */
	getConnectionStatus() {
		const status = {};
		for (const [sessionId, socket] of this.sockets.entries()) {
			status[sessionId] = {
				connected: socket.isActive,
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
		if (socket && !socket.isActive) {
			this.reconnectSession(sessionId);
		}
	}
}

// Create global singleton instance
const sessionSocketManager = new SessionSocketManager();

export default sessionSocketManager;