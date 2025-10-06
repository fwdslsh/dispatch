/**
 * EventRecorder - Event persistence and emission with buffering
 * @file Handles event recording to database and real-time emission
 * Implements buffering logic from RunSessionManager to prevent race conditions during initialization
 */

import { EventStore } from '../database/EventStore.js';

import { EventEmitter } from 'events';

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

		if (!buffer) {
			// Not a live session - record directly
			return await this.#persistAndEmit(sessionId, event);
		}

		if (buffer.initializing) {
			// Buffer during initialization
			buffer.eventBuffer.push(event);
			return;
		}

		// Serialize async operations to prevent race conditions
		buffer.eventQueue = buffer.eventQueue
			.then(async () => {
				return await this.#persistAndEmit(sessionId, event);
			})
			.catch((/** @type {Error} */ err) => {
				console.error(`Event queue error for ${sessionId}:`, err);
				// Emit error event for monitoring
				this.#eventEmitter.emit('error', { sessionId, error: err, event });
				// Re-throw to propagate error to caller
				throw err;
			});

		return buffer.eventQueue;
	}

	/**
	 * Internal method to persist and emit event
	 * @param {string} sessionId - Session ID
	 * @param {Object} event - Event data
	 * @returns {Promise<Object>} Persisted event row
	 */
	async #persistAndEmit(sessionId, event) {
		// Persist to database
		const row = await this.#eventStore.append(sessionId, event);

		// Emit to listeners (for real-time Socket.IO broadcast)
		this.#eventEmitter.emit('event', {
			sessionId,
			...row
		});

		return row;
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
	 * Legacy method for backward compatibility
	 * @deprecated Use recordEvent instead
	 */
	async record(sessionId, event) {
		return await this.recordEvent(sessionId, event);
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
	}

	/**
	 * Get listener count (useful for debugging)
	 * @returns {number} Number of active listeners
	 */
	getListenerCount() {
		return this.#eventEmitter.listenerCount('event');
	}
}
