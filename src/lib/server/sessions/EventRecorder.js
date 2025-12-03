/**
 * EventRecorder - Event persistence and emission with buffering
 * @file Handles event recording to database and real-time emission
 * Implements buffering logic from RunSessionManager to prevent race conditions during initialization
 */

// eslint-disable-next-line no-unused-vars -- Needed for JSDoc type annotations
import { EventStore } from '../database/EventStore.js';

import { EventEmitter } from 'events';
import { logger } from '../shared/utils/logger.js';

export class EventRecorder {
	#eventStore;
	#eventEmitter = new EventEmitter();
	#buffers = new Map(); // sessionId -> { initializing, eventBuffer, eventQueue }

	/**
	 * @param {EventStore} eventStore - Event store repository
	 */
	constructor(eventStore) {
		if (!eventStore) {
			throw new Error('EventStore is required');
		}
		this.#eventStore = eventStore;
	}

	/**
	 * Get EventStore instance (for SessionOrchestrator)
	 * @returns {EventStore} Event store instance
	 */
	get eventStore() {
		return this.#eventStore;
	}

	/**
	 * Start buffering events for a session during initialization
	 * @param {string} sessionId - Session ID
	 * @returns {void}
	 */
	startBuffering(sessionId) {
		this.#buffers.set(sessionId, {
			initializing: true,
			eventBuffer: [],
			eventQueue: Promise.resolve()
		});
	}

	/**
	 * Flush buffered events and switch to live mode
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<void>}
	 */
	async flushBuffer(sessionId) {
		const buffer = this.#buffers.get(sessionId);
		if (!buffer) {
			return;
		}

		// Process all buffered events in order
		for (const event of buffer.eventBuffer) {
			await this.#persistAndEmit(sessionId, event);
		}

		// Clear buffer and mark as live
		buffer.initializing = false;
		buffer.eventBuffer = [];
	}

	/**
	 * Clear buffer for a session (cleanup)
	 * @param {string} sessionId - Session ID
	 * @returns {void}
	 */
	clearBuffer(sessionId) {
		this.#buffers.delete(sessionId);
	}

	/**
	 * Record event with buffering and serialization
	 * This is the main method adapters call via onEvent callback
	 * @param {string} sessionId - Session ID
	 * @param {Object} event - Event data
	 * @param {string} event.channel - Event channel
	 * @param {string} event.type - Event type
	 * @param {Object|Uint8Array} event.payload - Event payload
	 * @returns {Promise<void>}
	 */
	async recordEvent(sessionId, event) {
		const buffer = this.#buffers.get(sessionId);

		logger.debug('EVENTS', `recordEvent for ${sessionId}:`, {
			hasBuffer: !!buffer,
			initializing: buffer?.initializing,
			channel: event.channel,
			type: event.type
		});

		if (!buffer) {
			// Not a live session - record directly
			logger.debug('EVENTS', `No buffer for ${sessionId} - recording directly`);
			return await this.#persistAndEmit(sessionId, event);
		}

		if (buffer.initializing) {
			// Buffer during initialization
			logger.debug('EVENTS', `Buffering event for ${sessionId} (still initializing)`);
			buffer.eventBuffer.push(event);
			return;
		}

		// Serialize async operations to prevent race conditions
		// Chain the operation but return a clean promise to caller
		logger.debug('EVENTS', `Queueing event for ${sessionId}`);

		// Use async/await for cleaner flow control
		const operation = (async () => {
			try {
				await buffer.eventQueue;
				return await this.#persistAndEmit(sessionId, event);
			} catch (err) {
				logger.error('EVENTS', `Event queue error for ${sessionId}:`, err);
				// Emit error event for monitoring
				this.#eventEmitter.emit('error', { sessionId, error: err, event });
				// Re-throw to propagate error to caller
				throw err;
			}
		})();

		// Update queue to continue from this operation (swallow error to prevent chain poisoning)
		buffer.eventQueue = operation.catch(() => {
			// Error already logged/emitted above, swallow to keep queue healthy
		});

		return operation; // Return the operation itself so caller gets the error
	}

	/**
	 * Internal method to persist and emit event
	 * @param {string} sessionId - Session ID
	 * @param {Object} event - Event data
	 * @returns {Promise<Object>} Persisted event row
	 */
	async #persistAndEmit(sessionId, event) {
		logger.debug('EVENTS', `Persisting event for ${sessionId}:`, event.channel, event.type);
		try {
			// Persist to database
			const row = await this.#eventStore.append(sessionId, event);
			logger.debug('EVENTS', `Event persisted with seq:`, row.seq);

			// Emit to listeners (for real-time Socket.IO broadcast)
			this.#eventEmitter.emit('event', {
				sessionId,
				...row
			});

			return row;
		} catch (error) {
			logger.error('EVENTS', `Failed to persist event for ${sessionId}:`, error);
			throw error;
		}
	}

	/**
	 * Get events since a sequence number
	 * @param {string} sessionId - Session ID
	 * @param {number} fromSeq - Starting sequence number
	 * @returns {Promise<Array>} Events array
	 */
	async getEvents(sessionId, fromSeq = 0) {
		return await this.#eventStore.getEvents(sessionId, fromSeq);
	}

	/**
	 * Subscribe to event stream
	 * @param {string} eventName - Event name (typically 'event')
	 * @param {(...args: any[]) => void} listener - Event listener (event) => void
	 * @returns {void}
	 */
	subscribe(eventName, listener) {
		this.#eventEmitter.on(eventName, listener);
	}

	/**
	 * Unsubscribe listener
	 * @param {string} eventName - Event name
	 * @param {(...args: any[]) => void} listener - Event listener to remove
	 * @returns {void}
	 */
	unsubscribe(eventName, listener) {
		this.#eventEmitter.off(eventName, listener);
	}

	/**
	 * Remove all listeners (useful for cleanup)
	 * @returns {void}
	 */
	removeAllListeners() {
		this.#eventEmitter.removeAllListeners('event');
		this.#eventEmitter.removeAllListeners('error');
	}

	/**
	 * Get listener count (useful for debugging)
	 * @returns {number} Number of active listeners
	 */
	getListenerCount() {
		return this.#eventEmitter.listenerCount('event');
	}
}
