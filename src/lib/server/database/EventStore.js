/**
 * EventStore - Append-only event log management
 * @file Handles session event persistence and retrieval
 */

export class EventStore {
	#db;

	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {
		this.#db = db;
	}

	/**
	 * Append event to session log
	 * @param {string} sessionId - Session ID (run_id)
	 * @param {Object} event - Event data
	 * @param {string} event.channel - Event channel (e.g., 'pty:stdout', 'claude:delta')
	 * @param {string} event.type - Event type (e.g., 'chunk', 'text', 'json')
	 * @param {Object|Uint8Array} event.payload - Event payload
	 * @returns {Promise<{seq: number}>} Sequence number assigned
	 */
	async append(sessionId, event) {
		const { channel, type, payload } = event;

		// Get next sequence number
		const seq = await this.#getNextSequence(sessionId);
		const ts = Date.now();

		// Encode payload
		const buf = payload instanceof Uint8Array
			? payload
			: new TextEncoder().encode(JSON.stringify(payload));

		await this.#db.run(
			`INSERT INTO session_events (run_id, seq, channel, type, payload, ts)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[sessionId, seq, channel, type, buf, ts]
		);

		return { seq };
	}

	/**
	 * Get events for session from sequence number
	 * @param {string} sessionId - Session ID
	 * @param {number} [fromSeq=0] - Starting sequence number
	 * @returns {Promise<Array>} Events ordered by sequence
	 */
	async getEvents(sessionId, fromSeq = 0) {
		const rows = await this.#db.all(
			`SELECT run_id, seq, channel, type, payload, ts
			 FROM session_events
			 WHERE run_id = ? AND seq > ?
			 ORDER BY seq ASC`,
			[sessionId, fromSeq]
		);

		return rows.map(row => this.#parseEvent(row));
	}

	/**
	 * Get all events for session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<Array>} All events for session
	 */
	async getAllEvents(sessionId) {
		return this.getEvents(sessionId, 0);
	}

	/**
	 * Get latest sequence number for session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<number>} Latest sequence number (0 if no events)
	 */
	async getLatestSeq(sessionId) {
		const result = await this.#db.get(
			'SELECT COALESCE(MAX(seq), 0) as maxSeq FROM session_events WHERE run_id = ?',
			[sessionId]
		);
		return result?.maxSeq ?? 0;
	}

	/**
	 * Delete all events for session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<void>}
	 */
	async deleteEvents(sessionId) {
		await this.#db.run('DELETE FROM session_events WHERE run_id = ?', [sessionId]);
	}

	/**
	 * Get count of events for session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<number>} Event count
	 */
	async getEventCount(sessionId) {
		const result = await this.#db.get(
			'SELECT COUNT(*) as count FROM session_events WHERE run_id = ?',
			[sessionId]
		);
		return result?.count ?? 0;
	}

	/**
	 * Get next sequence number for session
	 * @private
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<number>} Next sequence number
	 */
	async #getNextSequence(sessionId) {
		const current = await this.getLatestSeq(sessionId);
		return current + 1;
	}

	/**
	 * Parse database row into event object
	 * @private
	 * @param {Object} row - Database row
	 * @returns {Object} Event object
	 */
	#parseEvent(row) {
		let payload = row.payload;

		// Try to decode as JSON
		if (row.payload) {
			try {
				const text = new TextDecoder().decode(row.payload);
				payload = JSON.parse(text);
			} catch (e) {
				// Keep as raw buffer if not JSON
				payload = row.payload;
			}
		}

		return {
			runId: row.run_id,
			sessionId: row.run_id,
			seq: row.seq,
			channel: row.channel,
			type: row.type,
			payload,
			timestamp: row.ts
		};
	}
}
