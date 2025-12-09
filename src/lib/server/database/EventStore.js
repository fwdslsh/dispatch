/**
 * EventStore - Append-only event log management
 * @file Handles session event persistence and retrieval
 * Implements atomic sequence number management from RunSessionManager
 */

import { logger } from '../shared/utils/logger.js';

/**
 * @typedef {import('./DatabaseManager.js').DatabaseManager} DatabaseManager
 */

export class EventStore {
	#db;
	#sequences = new Map(); // sessionId -> nextSeq (atomic in-memory counter)
	#initLocks = new Map(); // sessionId -> Promise (initialization lock)
	#appendLocks = new Map(); // sessionId -> Promise (append operation lock)

	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {
		this.#db = db;
	}

	/**
	 * Append event to session log with atomic sequence numbering
	 * @param {string} sessionId - Session ID (run_id)
	 * @param {Object} event - Event data
	 * @param {string} event.channel - Event channel (e.g., 'pty:stdout', 'claude:delta')
	 * @param {string} event.type - Event type (e.g., 'chunk', 'text', 'json')
	 * @param {Object|Uint8Array} event.payload - Event payload
	 * @returns {Promise<Object>} Event row with sequence number
	 */
	async append(sessionId, event) {
		const { channel, type, payload } = event;

		// Get or initialize sequence counter with Promise-based lock
		if (!this.#sequences.has(sessionId)) {
			// Check if initialization is already in progress
			let initLock = this.#initLocks.get(sessionId);

			if (!initLock) {
				// Start initialization
				initLock = (async () => {
					try {
						const eventCount = await this.getEventCount(sessionId);
						// If no events exist, start at 0. If events exist, start at count (which is max_seq + 1)
						this.#sequences.set(sessionId, eventCount);
					} catch (error) {
						logger.error(
							'EVENTSTORE',
							`Failed to initialize sequence for session ${sessionId}:`,
							error.message
						);
						throw error;
					} finally {
						// Clean up lock after initialization completes
						this.#initLocks.delete(sessionId);
					}
				})();

				this.#initLocks.set(sessionId, initLock);
			}

			// Wait for initialization to complete
			await initLock;
		}

		// Lock the session during append to prevent clearSequence() races
		const appendLock = this.#appendLocks.get(sessionId) || Promise.resolve();

		const operation = appendLock.then(async () => {
			// Get current sequence (don't increment yet to prevent sequence gaps on DB errors)
			const seq = this.#sequences.get(sessionId);
			if (seq === undefined) {
				throw new Error(`Sequence counter was cleared during append for session ${sessionId}`);
			}

			const ts = Date.now();

			// Encode payload
			const buf =
				payload instanceof Uint8Array ? payload : new TextEncoder().encode(JSON.stringify(payload));

			try {
				// Insert to database FIRST
				await this.#db.run(
					`INSERT INTO session_events (run_id, seq, channel, type, payload, ts)
					 VALUES (?, ?, ?, ?, ?, ?)`,
					[sessionId, seq, channel, type, buf, ts]
				);

				// Only increment if insert succeeded (prevents sequence gaps)
				this.#sequences.set(sessionId, seq + 1);

				return {
					seq,
					channel,
					type,
					payload,
					timestamp: ts
				};
			} catch (error) {
				// Database insert failed - don't increment counter to prevent sequence gaps
				logger.error(
					'EVENTSTORE',
					`Failed to append event for session ${sessionId}:`,
					error.message
				);
				throw new Error(`Failed to append event for session ${sessionId}: ${error.message}`);
			}
		});

		// Update lock (swallow errors to prevent lock poisoning)
		this.#appendLocks.set(
			sessionId,
			operation.catch(() => {})
		);

		return operation;
	}

	/**
	 * Clear sequence counter for session (cleanup)
	 * @param {string} sessionId - Session ID
	 * @returns {void}
	 */
	clearSequence(sessionId) {
		this.#sequences.delete(sessionId);
		this.#initLocks.delete(sessionId); // Clear initialization lock
		this.#appendLocks.delete(sessionId); // Clear append lock to prevent memory leak
	}

	/**
	 * Get events for session after a given sequence number
	 * @param {string} sessionId - Session ID
	 * @param {number} [afterSeq=-1] - Get events AFTER this sequence (exclusive). Use -1 to get all events.
	 * @returns {Promise<Array>} Events ordered by sequence
	 */
	async getEvents(sessionId, afterSeq = -1) {
		const rows = await this.#db.all(
			`SELECT run_id, seq, channel, type, payload, ts
			 FROM session_events
			 WHERE run_id = ? AND seq > ?
			 ORDER BY seq ASC`,
			[sessionId, afterSeq]
		);

		return rows.map((row) => this.#parseEvent(row));
	}

	/**
	 * Get all events for session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<Array>} All events for session
	 */
	async getAllEvents(sessionId) {
		return this.getEvents(sessionId, -1);
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
	 * Parse database row into event object
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
			} catch (_e) {
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
