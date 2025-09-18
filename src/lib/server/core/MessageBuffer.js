/**
 * MessageBuffer.js
 *
 * Unified message buffering service that consolidates all duplicate buffering systems.
 * Replaces SessionRouter.messageBuffers, emitWithBuffer utility, and socket-emit wrappers.
 *
 * ARCHITECTURAL PRINCIPLES:
 * - Single responsibility (message buffering and replay)
 * - Unified buffer management across all session types
 * - Simple API for reliable message delivery
 * - Automatic cleanup and TTL management
 */

import { logger } from '../utils/logger.js';

export class MessageBuffer {
	constructor() {
		// Message buffers per session
		this.buffers = new Map(); // sessionId -> message array
		this.bufferTimestamps = new Map(); // sessionId -> last update timestamp

		// Configuration
		this.maxBufferSize = 100; // Maximum messages per session
		this.bufferTTL = 5 * 60 * 1000; // 5 minutes
		this.cleanupInterval = 60 * 1000; // Cleanup every minute

		// Start periodic cleanup
		this.cleanupTimer = setInterval(() => {
			this.cleanupExpiredBuffers();
		}, this.cleanupInterval);

		logger.info('MESSAGE_BUFFER', 'Initialized with TTL:', this.bufferTTL);
	}

	/**
	 * Add a message to the buffer for a session
	 * @param {string} sessionId Session identifier
	 * @param {string} eventType Event type (e.g., 'terminal.output', 'claude.message.delta')
	 * @param {any} data Message data
	 * @param {object} options Additional options
	 */
	addMessage(sessionId, eventType, data, options = {}) {
		// Initialize buffer if needed
		if (!this.buffers.has(sessionId)) {
			this.buffers.set(sessionId, []);
		}

		const buffer = this.buffers.get(sessionId);
		const message = {
			eventType,
			data,
			timestamp: Date.now(),
			sequence: buffer.length,
			sessionId,
			...options
		};

		// Add to buffer
		buffer.push(message);

		// Trim if exceeds max size
		if (buffer.length > this.maxBufferSize) {
			buffer.shift(); // Remove oldest
		}

		// Update timestamp
		this.bufferTimestamps.set(sessionId, Date.now());

		logger.debug('MESSAGE_BUFFER', `Buffered ${eventType} for session ${sessionId}, size: ${buffer.length}`);
	}

	/**
	 * Get buffered messages for a session
	 * @param {string} sessionId Session identifier
	 * @param {number} sinceTimestamp Optional timestamp filter
	 * @param {number} maxMessages Optional limit on number of messages
	 * @returns {Array} Array of buffered messages
	 */
	getMessages(sessionId, sinceTimestamp = 0, maxMessages = null) {
		const buffer = this.buffers.get(sessionId);
		if (!buffer || buffer.length === 0) {
			return [];
		}

		// Check if buffer has expired
		const bufferTimestamp = this.bufferTimestamps.get(sessionId) || 0;
		if (Date.now() - bufferTimestamp > this.bufferTTL) {
			this.clearBuffer(sessionId);
			return [];
		}

		// Filter by timestamp if specified
		let messages = buffer;
		if (sinceTimestamp > 0) {
			messages = buffer.filter(msg => msg.timestamp > sinceTimestamp);
		}

		// Limit number of messages if specified
		if (maxMessages && messages.length > maxMessages) {
			messages = messages.slice(-maxMessages); // Take most recent
		}

		return [...messages]; // Return copy
	}

	/**
	 * Get all messages for replay (used for session reconnection)
	 * @param {string} sessionId Session identifier
	 * @returns {Array} All buffered messages for the session
	 */
	getReplayMessages(sessionId) {
		return this.getMessages(sessionId, 0, null);
	}

	/**
	 * Get messages since a specific sequence number
	 * @param {string} sessionId Session identifier
	 * @param {number} sinceSequence Sequence number to start from
	 * @returns {Array} Messages since sequence number
	 */
	getMessagesSinceSequence(sessionId, sinceSequence) {
		const buffer = this.buffers.get(sessionId);
		if (!buffer || buffer.length === 0) {
			return [];
		}

		return buffer.filter(msg => msg.sequence > sinceSequence);
	}

	/**
	 * Clear buffer for a specific session
	 * @param {string} sessionId Session identifier
	 */
	clearBuffer(sessionId) {
		this.buffers.delete(sessionId);
		this.bufferTimestamps.delete(sessionId);
		logger.debug('MESSAGE_BUFFER', `Cleared buffer for session ${sessionId}`);
	}

	/**
	 * Clear all buffers (useful for testing or reset)
	 */
	clearAllBuffers() {
		const sessionCount = this.buffers.size;
		this.buffers.clear();
		this.bufferTimestamps.clear();
		logger.info('MESSAGE_BUFFER', `Cleared all buffers (${sessionCount} sessions)`);
	}

	/**
	 * Get buffer statistics for a session
	 * @param {string} sessionId Session identifier
	 * @returns {object} Buffer statistics
	 */
	getBufferStats(sessionId) {
		const buffer = this.buffers.get(sessionId);
		const timestamp = this.bufferTimestamps.get(sessionId);

		if (!buffer) {
			return {
				exists: false,
				messageCount: 0,
				lastUpdate: null,
				expired: false
			};
		}

		const now = Date.now();
		const lastUpdate = timestamp || 0;
		const expired = lastUpdate > 0 && (now - lastUpdate) > this.bufferTTL;

		return {
			exists: true,
			messageCount: buffer.length,
			lastUpdate: new Date(lastUpdate).toISOString(),
			expired,
			ageMs: now - lastUpdate
		};
	}

	/**
	 * Get statistics for all buffers
	 * @returns {object} Overall buffer statistics
	 */
	getAllBufferStats() {
		const totalSessions = this.buffers.size;
		let totalMessages = 0;
		let expiredSessions = 0;
		const now = Date.now();

		for (const [sessionId, buffer] of this.buffers.entries()) {
			totalMessages += buffer.length;

			const timestamp = this.bufferTimestamps.get(sessionId) || 0;
			if (timestamp > 0 && (now - timestamp) > this.bufferTTL) {
				expiredSessions++;
			}
		}

		return {
			totalSessions,
			totalMessages,
			expiredSessions,
			maxBufferSize: this.maxBufferSize,
			bufferTTL: this.bufferTTL
		};
	}

	/**
	 * Check if a session has any buffered messages
	 * @param {string} sessionId Session identifier
	 * @returns {boolean} True if session has buffered messages
	 */
	hasMessages(sessionId) {
		const buffer = this.buffers.get(sessionId);
		return buffer && buffer.length > 0;
	}

	/**
	 * Check if a session buffer has expired
	 * @param {string} sessionId Session identifier
	 * @returns {boolean} True if buffer has expired
	 */
	isBufferExpired(sessionId) {
		const timestamp = this.bufferTimestamps.get(sessionId);
		if (!timestamp) return true;

		return (Date.now() - timestamp) > this.bufferTTL;
	}

	/**
	 * Cleanup expired buffers
	 */
	cleanupExpiredBuffers() {
		const now = Date.now();
		let cleanedCount = 0;

		for (const [sessionId, timestamp] of this.bufferTimestamps.entries()) {
			if (now - timestamp > this.bufferTTL) {
				this.clearBuffer(sessionId);
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			logger.debug('MESSAGE_BUFFER', `Cleaned up ${cleanedCount} expired buffers`);
		}
	}

	/**
	 * Update configuration
	 * @param {object} config Configuration updates
	 */
	configure(config) {
		if (config.maxBufferSize !== undefined) {
			this.maxBufferSize = config.maxBufferSize;
		}
		if (config.bufferTTL !== undefined) {
			this.bufferTTL = config.bufferTTL;
		}
		if (config.cleanupInterval !== undefined) {
			// Restart cleanup timer with new interval
			clearInterval(this.cleanupTimer);
			this.cleanupInterval = config.cleanupInterval;
			this.cleanupTimer = setInterval(() => {
				this.cleanupExpiredBuffers();
			}, this.cleanupInterval);
		}

		logger.info('MESSAGE_BUFFER', 'Configuration updated:', {
			maxBufferSize: this.maxBufferSize,
			bufferTTL: this.bufferTTL,
			cleanupInterval: this.cleanupInterval
		});
	}

	/**
	 * Cleanup resources (call on shutdown)
	 */
	dispose() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		this.clearAllBuffers();
		logger.info('MESSAGE_BUFFER', 'Disposed');
	}

	/**
	 * Emit message with buffering
	 * This replaces the emitWithBuffer utility pattern
	 * @param {object} socket Socket.IO socket instance
	 * @param {string} sessionId Session identifier
	 * @param {string} eventType Event type
	 * @param {any} data Message data
	 * @param {object} options Additional options
	 */
	emitWithBuffer(socket, sessionId, eventType, data, options = {}) {
		// Always buffer the message first
		this.addMessage(sessionId, eventType, data, options);

		// Then emit if socket is available and connected
		if (socket && socket.connected) {
			socket.emit(eventType, data);
		} else {
			logger.debug('MESSAGE_BUFFER', `Socket not available for ${eventType}, message buffered for session ${sessionId}`);
		}
	}

	/**
	 * Replay buffered messages to a socket
	 * @param {object} socket Socket.IO socket instance
	 * @param {string} sessionId Session identifier
	 * @param {number} sinceTimestamp Optional timestamp filter
	 */
	replayMessages(socket, sessionId, sinceTimestamp = 0) {
		if (!socket || !socket.connected) {
			logger.warn('MESSAGE_BUFFER', `Cannot replay messages - socket not available for session ${sessionId}`);
			return;
		}

		const messages = this.getMessages(sessionId, sinceTimestamp);
		if (messages.length === 0) {
			logger.debug('MESSAGE_BUFFER', `No messages to replay for session ${sessionId}`);
			return;
		}

		logger.info('MESSAGE_BUFFER', `Replaying ${messages.length} messages for session ${sessionId}`);

		// Emit each buffered message
		for (const message of messages) {
			socket.emit(message.eventType, message.data);
		}
	}
}