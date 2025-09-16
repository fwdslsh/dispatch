/**
 * Socket.IO event name constants and emission helpers
 * Provides single source of truth for all socket event names
 */

import { SOCKET_EVENTS } from '../../shared/socket-events.js';

/**
 * Emit a message delta event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {string} content - Message content delta
 * @param {Object} metadata - Additional metadata
 */
export function emitMessageDelta(socket, sessionId, content, metadata = {}) {
	socket.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA, {
		sessionId,
		content,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit a message complete event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {Object} message - Complete message object
 * @param {Object} metadata - Additional metadata
 */
export function emitMessageComplete(socket, sessionId, message, metadata = {}) {
	socket.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE, {
		sessionId,
		message,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit an error event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {Error|string} error - Error object or message
 * @param {Object} metadata - Additional metadata
 */
export function emitError(socket, sessionId, error, metadata = {}) {
	const errorData =
		error instanceof Error
			? {
					message: error.message,
					stack: error.stack,
					name: error.name
				}
			: { message: String(error) };

	socket.emit(SOCKET_EVENTS.CLAUDE_ERROR, {
		sessionId,
		error: errorData,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit available tools event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {Array} tools - Available tools array
 * @param {Object} metadata - Additional metadata
 */
export function emitToolsAvailable(socket, sessionId, tools, metadata = {}) {
	socket.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
		sessionId,
		tools,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit session status event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {string} status - Session status
 * @param {Object} metadata - Additional metadata
 */
export function emitSessionStatus(socket, sessionId, status, metadata = {}) {
	socket.emit(SOCKET_EVENTS.SESSION_STATUS, {
		sessionId,
		status,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit terminal output event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {string} data - Terminal output data
 * @param {Object} metadata - Additional metadata
 */
export function emitTerminalOutput(socket, sessionId, data, metadata = {}) {
	socket.emit(SOCKET_EVENTS.TERMINAL_OUTPUT, {
		sessionId,
		data,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit public URL response event
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {boolean} ok - Whether URL was found
 * @param {string|null} url - Public URL if available
 * @param {Object} metadata - Additional metadata
 */
export function emitPublicUrlResponse(socket, ok, url = null, metadata = {}) {
	socket.emit(SOCKET_EVENTS.PUBLIC_URL_RESPONSE, {
		ok,
		url,
		timestamp: Date.now(),
		...metadata
	});
}

/**
 * Emit an event with automatic buffering for session history
 * @param {import('socket.io').Socket} socket - Socket instance (can be null for buffering only)
 * @param {string} eventType - Event type constant from SOCKET_EVENTS
 * @param {Object} data - Event data including sessionId
 * @param {import('../core/SessionRouter.js').SessionRouter} sessionRouter - Session router for buffering
 */
export function emitWithBuffer(socket, eventType, data, sessionRouter) {
	// Always buffer the message if we have a sessionRouter and sessionId
	if (sessionRouter && data.sessionId) {
		sessionRouter.bufferMessage(data.sessionId, eventType, data);
	}

	// Emit to socket if available
	if (socket) {
		try {
			socket.emit(eventType, data);
		} catch (error) {
			// Socket might be disconnected, but we've already buffered the message
			console.debug('Failed to emit to socket, message buffered:', error.message);
		}
	}
}

/**
 * Send buffered messages to a client
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {string} sessionId - Session identifier
 * @param {number} sinceTimestamp - Timestamp to get messages since (optional)
 * @param {import('../core/SessionRouter.js').SessionRouter} sessionRouter - Session router for buffering
 */
export function sendBufferedMessages(socket, sessionId, sinceTimestamp, sessionRouter) {
	if (!sessionRouter || !socket) return;

	const messages = sessionRouter.getBufferedMessages(sessionId, sinceTimestamp);

	if (messages.length > 0) {
		// Send each buffered message in order
		for (const message of messages) {
			try {
				socket.emit(message.eventType, message.data);
			} catch (error) {
				console.debug('Failed to send buffered message:', error.message);
			}
		}

		// Emit a catchup complete event
		socket.emit(SOCKET_EVENTS.SESSION_CATCHUP_COMPLETE, {
			sessionId,
			messageCount: messages.length,
			timestamp: Date.now()
		});
	}
}
