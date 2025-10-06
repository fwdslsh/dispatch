/**
 * EventRecorder - Event persistence and emission
 * @file Handles event recording to database and real-time emission
 */

import { EventStore  } from "../database/EventStore.js";

import { EventEmitter } from 'events';

export class EventRecorder {
	#eventStore;
	#eventEmitter = new EventEmitter();

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
	 * Record event (persist and emit)
	 * @param {string} sessionId - Session ID
	 * @param {Object} event - Event data
	 * @param {string} event.channel - Event channel (e.g., 'pty:stdout', 'claude:delta')
	 * @param {string} event.type - Event type (e.g., 'chunk', 'text', 'json')
	 * @param {Object|Uint8Array} event.payload - Event payload
	 * @returns {Promise<void>}
	 */
	async record(sessionId, event) {
		// Persist to database
		const { seq } = await this.#eventStore.append(sessionId, event);

		// Emit to listeners (for real-time Socket.IO broadcast)
		this.#eventEmitter.emit('event', {
			sessionId,
			seq,
			...event
		});
	}

	/**
	 * Subscribe to event stream
	 * @param {Function} listener - Event listener (event) => void
	 * @returns {void}
	 */
	subscribe(listener) {
		this.#eventEmitter.on('event', listener);
	}

	/**
	 * Unsubscribe listener
	 * @param {Function} listener - Event listener to remove
	 * @returns {void}
	 */
	unsubscribe(listener) {
		this.#eventEmitter.off('event', listener);
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
