const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * @typedef {Object} SessionEventRecord
 * @property {string} runId
 * @property {string} runSessionId
 * @property {number} seq
 * @property {string} channel
 * @property {string} type
 * @property {any} payload
 * @property {number} ts
 */

const hydrateEventRow = (row) => {
	if (!row) return row;
	if (row.payload) {
		try {
			const decoded = textDecoder.decode(row.payload);
			row.payload = JSON.parse(decoded);
		} catch {
			// Keep raw payload if decoding fails
		}
	}
	return row;
};

/**
 * Append-only event store for RunSession history.
 */
export class EventStore {
	/**
	 * @param {import('../DatabaseManager.js').DatabaseManager} database
	 */
	constructor(database) {
		this.database = database;
	}

	/**
	 * Append a new SessionEventRecord to storage.
	 * @param {string} runSessionId
	 * @param {number} sequence
	 * @param {string} channel
	 * @param {string} type
	 * @param {any} payload
	 * @returns {Promise<SessionEventRecord>}
	 */
	async append(runSessionId, sequence, channel, type, payload) {
		const ts = Date.now();
		const buffer =
			payload instanceof Uint8Array ? payload : textEncoder.encode(JSON.stringify(payload ?? {}));

		await this.database.enqueueWrite(async () => {
			await this.database.run(
				`INSERT INTO session_events(run_id, seq, channel, type, payload, ts) VALUES(?,?,?,?,?,?)`,
				[runSessionId, sequence, channel, type, buffer, ts]
			);
		});

		return {
			runId: runSessionId,
			runSessionId,
			seq: sequence,
			channel,
			type,
			payload,
			ts
		};
	}

	/**
	 * Get events after a given sequence number.
	 * @param {string} runSessionId
	 * @param {number} [afterSequence=0]
	 * @returns {Promise<SessionEventRecord[]>}
	 */
	async getSince(runSessionId, afterSequence = 0) {
		const rows = await this.database.all(
			`SELECT run_id as runId, seq, channel, type, payload, ts
                         FROM session_events WHERE run_id=? AND seq>? ORDER BY seq ASC`,
			[runSessionId, afterSequence]
		);
		return rows.map((row) => {
			const hydrated = hydrateEventRow(row);
			hydrated.runSessionId = hydrated.runId;
			return hydrated;
		});
	}

	/**
	 * Compute the next sequence number for a run session.
	 * @param {string} runSessionId
	 * @returns {Promise<number>}
	 */
	async getNextSequence(runSessionId) {
		const result = await this.database.get(
			`SELECT COALESCE(MAX(seq), 0) as maxSeq FROM session_events WHERE run_id=?`,
			[runSessionId]
		);
		return (result?.maxSeq ?? 0) + 1;
	}

	/**
	 * Remove events for a run session.
	 * @param {string} runSessionId
	 * @returns {Promise<void>}
	 */
	async deleteForRun(runSessionId) {
		await this.database.run('DELETE FROM session_events WHERE run_id = ?', [runSessionId]);
	}
}
