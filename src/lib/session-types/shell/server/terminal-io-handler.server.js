/**
 * TerminalIOHandler - Manages terminal input/output operations
 *
 * Handles terminal input, output, and resize operations that were previously
 * mixed with session management in socket-handler.js
 */

import {
	createSuccessResponse,
	createErrorResponse,
	ErrorHandler
} from '../../../shared/utils/error-handling.js';
import { RateLimiter } from '../../../shared/utils/validation.js';
import { TerminalManager } from './terminal.server.js';

/**
 * Terminal I/O handler for socket events
 */
export class TerminalIOHandler {
	/**
	 * @param {Object} dependencies Injected dependencies
	 * @param {TerminalManager} dependencies.terminalManager Terminal manager instance
	 * @param {Map} dependencies.socketSessions Map of socket to session associations
	 */
	constructor({ terminalManager, socketSessions }) {
		this.terminalManager = terminalManager || new TerminalManager();
		this.socketSessions = socketSessions || new Map();

		// Rate limiter for input events (per socket)
		this.inputRateLimiter = new RateLimiter(1000, 50); // 50 inputs per second per socket
	}

	/**
	 * Handle terminal input
	 * @param {Socket} socket Socket.IO socket
	 * @param {string|Object} data Input data
	 * @param {string} sessionId Optional explicit session ID
	 */
	async input(socket, data, sessionId) {
		try {
			// Rate limiting check
			if (!this.inputRateLimiter.checkRate(socket.id)) {
				console.warn(`Rate limit exceeded for socket ${socket.id}`);
				return;
			}

			// Determine which session to send input to
			let targetSessionId = sessionId;

			if (!targetSessionId) {
				// Find the first active session for this socket
				const sessions = this.socketSessions.get(socket.id);
				if (sessions && sessions.size > 0) {
					targetSessionId = sessions.values().next().value;
				}
			}

			if (!targetSessionId) {
				console.warn(`No active session found for socket ${socket.id}`);
				return;
			}

			// Handle different data formats
			let inputData;
			if (typeof data === 'string') {
				inputData = data;
			} else if (data && typeof data.data === 'string') {
				inputData = data.data;
			} else {
				console.warn('Invalid input data format:', data);
				return;
			}

			// Validate that input is not a login command (these should be handled elsewhere)
			const trimmedData = inputData.trim();
			const loginCommands = ['/login', '/auth', '/help'];
			if (loginCommands.includes(trimmedData)) {
				console.log('Login command received, ignoring in terminal input');
				return;
			}

			// Send input to terminal
			await this.terminalManager.write(targetSessionId, inputData);
		} catch (error) {
			console.error('Error handling terminal input:', error);
		}
	}

	/**
	 * Handle terminal resize
	 * @param {Socket} socket Socket.IO socket
	 * @param {Object} dims Resize dimensions
	 */
	async resize(socket, dims) {
		try {
			const { cols, rows } = dims || {};

			if (!cols || !rows || cols <= 0 || rows <= 0) {
				console.warn('Invalid resize dimensions:', dims);
				return;
			}

			// Find active sessions for this socket and resize them
			const sessions = this.socketSessions.get(socket.id);
			if (sessions && sessions.size > 0) {
				for (const sessionId of sessions) {
					try {
						await this.terminalManager.resize(sessionId, cols, rows);
					} catch (resizeError) {
						console.error(`Failed to resize session ${sessionId}:`, resizeError);
					}
				}
			} else {
				console.warn(`No active sessions to resize for socket ${socket.id}`);
			}
		} catch (error) {
			console.error('Error handling terminal resize:', error);
		}
	}

	/**
	 * Set up output handlers for a session
	 * @param {Socket} socket Socket.IO socket
	 * @param {string} sessionId Session ID
	 * @returns {Function} Unsubscribe function
	 */
	setupOutputHandler(socket, sessionId) {
		try {
			const callback = (data) => {
				socket.emit('output', data);
			};

			this.terminalManager.subscribeToSession(sessionId, callback);

			// Return unsubscribe function
			return () => {
				this.terminalManager.unsubscribeFromSession(sessionId, callback);
			};
		} catch (error) {
			console.error('Failed to setup output handler:', error);
			return () => {}; // Return no-op unsubscribe function
		}
	}

	/**
	 * Set up session end handlers
	 * @param {Socket} socket Socket.IO socket
	 * @param {string} sessionId Session ID
	 * @param {Function} onEndCallback Callback when session ends
	 */
	setupSessionEndHandler(socket, sessionId, onEndCallback) {
		try {
			const onSessionEnd = ({ exitCode, signal }) => {
				socket.emit('ended', { exitCode, signal });

				// Call the provided callback for cleanup
				if (typeof onEndCallback === 'function') {
					onEndCallback(sessionId);
				}
			};

			// Session end events are not available in TerminalManager\n      // Handle cleanup through other means
		} catch (error) {
			console.error('Failed to setup session end handler:', error);
		}
	}

	/**
	 * Get input rate limit status for a socket
	 * @param {string} socketId Socket ID
	 * @returns {Object} Rate limit status
	 */
	getInputRateStatus(socketId) {
		return this.inputRateLimiter.getStatus(socketId);
	}

	/**
	 * Check if session has active terminal
	 * @param {string} sessionId Session ID
	 * @returns {boolean} True if session has active terminal
	 */
	async hasActiveTerminal(sessionId) {
		try {
			return await this.terminalManager.hasSession(sessionId);
		} catch (error) {
			console.error('Error checking terminal status:', error);
			return false;
		}
	}

	/**
	 * Send data directly to a specific session
	 * @param {string} sessionId Session ID
	 * @param {string} data Data to send
	 * @returns {Promise<void>}
	 */
	async writeToSession(sessionId, data) {
		try {
			await this.terminalManager.write(sessionId, data);
		} catch (error) {
			console.error(`Error writing to session ${sessionId}:`, error);
			throw error;
		}
	}

	/**
	 * Get terminal information for a session
	 * @param {string} sessionId Session ID
	 * @returns {Object|null} Terminal info or null if not found
	 */
	async getTerminalInfo(sessionId) {
		try {
			return await this.terminalManager.getSessionInfo(sessionId);
		} catch (error) {
			console.error(`Error getting terminal info for ${sessionId}:`, error);
			return null;
		}
	}

	/**
	 * Clean up terminal I/O resources for a socket
	 * @param {Socket} socket Socket.IO socket
	 */
	handleDisconnect(socket) {
		try {
			// Clear rate limiting for this socket
			this.inputRateLimiter.clearSocket(socket.id);

			console.log('Terminal I/O handler cleaned up for socket:', socket.id);
		} catch (error) {
			console.error('Error during terminal I/O disconnect:', error);
		}
	}

	/**
	 * Update socket sessions reference
	 * @param {Map} socketSessions New socket sessions map
	 */
	updateSocketSessions(socketSessions) {
		this.socketSessions = socketSessions;
	}

	/**
	 * Get statistics about terminal I/O
	 * @returns {Object} I/O statistics
	 */
	getStats() {
		return {
			rateLimiterStats: this.inputRateLimiter.getStats(),
			activeSocketCount: this.socketSessions.size,
			totalActiveSessions: Array.from(this.socketSessions.values()).reduce(
				(total, sessions) => total + sessions.size,
				0
			)
		};
	}

	/**
	 * Create TerminalIOHandler with default dependencies
	 * @param {Object} options Creation options
	 * @param {Map} options.socketSessions Socket sessions map reference
	 * @returns {TerminalIOHandler} Configured TerminalIOHandler
	 */
	static create(options = {}) {
		return new TerminalIOHandler({
			terminalManager: new TerminalManager(),
			socketSessions: options.socketSessions || new Map()
		});
	}
}
