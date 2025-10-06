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
	#initializingSequences = new Set(); // Track sequences being initialized (mutex)
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
	 * @param {number} [retryCount=0] - Internal retry counter (for bounded retry)
	 * @returns {Promise<Object>} Event row with sequence number
	 */
	async append(sessionId, event, retryCount = 0) {
		const { channel, type, payload } = event;
		const MAX_RETRIES = 10;
		const BASE_DELAY_MS = 10;

		// Get or initialize sequence counter with mutex to prevent race conditions
		if (!this.#sequences.has(sessionId)) {
			// If another thread is initializing, wait and retry with bounded attempts
			if (this.#initializingSequences.has(sessionId)) {
				if (retryCount >= MAX_RETRIES) {
					logger.error(
						'EVENTSTORE',
						`Sequence initialization deadlock for session ${sessionId} after ${MAX_RETRIES} retries. ` +
							`Another process may be stuck initializing.`
					);
					throw new Error(
						`EventStore.append failed: sequence initialization timeout after ${MAX_RETRIES} retries for session ${sessionId}`
					);
				}

				// Log retries for visibility (at INFO level after retry 5, ~150ms of waiting)
				if (retryCount >= 5) {
					logger.info(
						'EVENTSTORE',
						`Retry ${retryCount}/${MAX_RETRIES} waiting for sequence init: ${sessionId}`
					);
				}

				// Exponential backoff with higher cap (10ms -> 20ms -> 40ms -> 80ms -> 160ms -> 320ms -> 500ms max)
				const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 500);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return this.append(sessionId, event, retryCount + 1);
			}

			// Mark as initializing to prevent concurrent initialization
			this.#initializingSequences.add(sessionId);
			try {
				const lastSeq = await this.getLatestSeq(sessionId);
				this.#sequences.set(sessionId, lastSeq + 1);
			} finally {
				this.#initializingSequences.delete(sessionId);
			}
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
				logger.error('EVENTSTORE', `Failed to append event for session ${sessionId}:`, error.message);
				throw new Error(`Failed to append event for session ${sessionId}: ${error.message}`);
			}
		});

		// Update lock (swallow errors to prevent lock poisoning)
		this.#appendLocks.set(sessionId, operation.catch(() => {}));

		return operation;
	}

	/**
	 * Clear sequence counter for session (cleanup)
	 * @param {string} sessionId - Session ID
	 * @returns {void}
	 */
	clearSequence(sessionId) {
		this.#sequences.delete(sessionId);
		this.#initializingSequences.delete(sessionId); // Also clear mutex to prevent stale entries
		this.#appendLocks.delete(sessionId); // Also clear append lock to prevent memory leak
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

		return rows.map((row) => this.#parseEvent(row));
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
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<number>} Next sequence number
	 */
	async #getNextSequence(sessionId) {
		const current = await this.getLatestSeq(sessionId);
		return current + 1;
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
