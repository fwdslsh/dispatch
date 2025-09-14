/**
 * Socket.IO event name constants and emission helpers
 * Provides single source of truth for all socket event names
 */

import { SOCKET_EVENTS } from '$lib/shared/socket-events';

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
