/**
 * @typedef {import('./runSessionTypes.js').SessionEventPayload} SessionEventPayload
 * @typedef {import('./runSessionTypes.js').RunSessionLiveEntry} RunSessionLiveEntry
 */

/**
 * Persists session events and emits domain notifications when new events arrive.
 */
export class SessionEventRecorder {
	/**
	 * @param {import('../db/repositories/EventStore.js').EventStore} eventStore
	 * @param {import('node:events').EventEmitter} emitter
	 */
	constructor(eventStore, emitter) {
		this.eventStore = eventStore;
		this.emitter = emitter;
	}

	/**
	 * Append a new event for a run session.
	 * @param {string} runSessionId
	 * @param {SessionEventPayload} event
	 * @param {{ liveRunSession?: RunSessionLiveEntry | null }} [options]
	 * @returns {Promise<import('../db/repositories/EventStore.js').SessionEventRecord>}
	 */
	async record(runSessionId, event, { liveRunSession = null } = {}) {
		const { channel, type, payload } = event;
		if (!channel || !type) {
			throw new Error('Event must include channel and type');
		}

		let sequence;
		if (liveRunSession) {
			sequence = liveRunSession.nextSequenceNumber++;
			try {
				const record = await this.eventStore.append(runSessionId, sequence, channel, type, payload);
				this.#emitEvent(record);
				return record;
			} catch (error) {
				liveRunSession.nextSequenceNumber = sequence;
				throw error;
			}
		}

		sequence = await this.eventStore.getNextSequence(runSessionId);
		const record = await this.eventStore.append(runSessionId, sequence, channel, type, payload);
		this.#emitEvent(record);
		return record;
	}

	/**
	 * Retrieve events after a specific sequence number.
	 * @param {string} runSessionId
	 * @param {number} [afterSequence=0]
	 * @returns {Promise<import('../db/repositories/EventStore.js').SessionEventRecord[]>}
	 */
	getEventsSince(runSessionId, afterSequence = 0) {
		return this.eventStore.getSince(runSessionId, afterSequence);
	}

	/**
	 * Determine the next sequence number for a session.
	 * @param {string} runSessionId
	 * @returns {Promise<number>}
	 */
	getNextSequence(runSessionId) {
		return this.eventStore.getNextSequence(runSessionId);
	}

	/**
	 * Emit both the new runSession:event signal and the legacy session:event channel.
	 * @param {import('../db/repositories/EventStore.js').SessionEventRecord} record
	 */
	#emitEvent(record) {
		this.emitter.emit('runSession:event', {
			runSessionId: record.runSessionId,
			event: record
		});
		// Legacy event for backwards compatibility with existing listeners
		this.emitter.emit('session:event', {
			runId: record.runId,
			event: record
		});
	}
}
