import { logger } from '../../utils/logger.js';

/**
 * @typedef {Object} RunSessionRecord
 * @property {string} run_id
 * @property {string} kind
 * @property {string} status
 * @property {number} created_at
 * @property {number} updated_at
 * @property {string | null} meta_json
 * @property {string | null} owner_user_id
 */

const parseMeta = (row) => {
	if (!row) return null;
	const parsed = { ...row };
	if (row.meta_json) {
		try {
			parsed.meta = JSON.parse(row.meta_json);
		} catch (error) {
			logger.warn('DATABASE', `Failed to parse session meta for ${row.run_id}: ${error.message}`);
			parsed.meta = {};
		}
	}
	return parsed;
};

/**
 * Repository encapsulating CRUD operations for RunSession metadata.
 */
export class SessionRepository {
	/**
	 * @param {import('../DatabaseManager.js').DatabaseManager} database
	 */
	constructor(database) {
		this.database = database;
	}

	/**
	 * Create a new RunSession record.
	 * @param {{ runSessionId: string, kind: string, meta?: Record<string, any>, ownerUserId?: string | null }} payload
	 * @returns {Promise<void>}
	 */
	async create({ runSessionId, kind, meta, ownerUserId = null }) {
		const now = Date.now();
		await this.database.enqueueWrite(async () => {
			await this.database.run(
				`INSERT INTO sessions(run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
                                 VALUES(?, ?, ?, 'starting', ?, ?, ?)`,
				[runSessionId, ownerUserId, kind, now, now, JSON.stringify(meta ?? {})]
			);
		});
	}

	/**
	 * Mark every running session as stopped (used during startup recovery).
	 * @returns {Promise<void>}
	 */
	async markAllStopped() {
		await this.database.run(
			`UPDATE sessions
                         SET status='stopped', updated_at=?
                         WHERE status='running'`,
			[Date.now()]
		);
	}

	/**
	 * Update the status of a RunSession.
	 * @param {string} runSessionId
	 * @param {string} status
	 * @returns {Promise<void>}
	 */
	async updateStatus(runSessionId, status) {
		await this.database.run('UPDATE sessions SET status=?, updated_at=? WHERE run_id=?', [
			status,
			Date.now(),
			runSessionId
		]);
	}

	/**
	 * Retrieve a RunSession by identifier.
	 * @param {string} runSessionId
	 * @returns {Promise<(RunSessionRecord & { meta?: Record<string, any> }) | null>}
	 */
	async findById(runSessionId) {
		const row = await this.database.get('SELECT * FROM sessions WHERE run_id = ?', [runSessionId]);
		return row ? parseMeta(row) : null;
	}

	/**
	 * List sessions optionally filtered by kind.
	 * @param {string | null} kind
	 * @returns {Promise<Array<RunSessionRecord & { meta?: Record<string, any> }>>}
	 */
	async list(kind = null) {
		const sql =
			kind !== null
				? 'SELECT * FROM sessions WHERE kind = ? ORDER BY updated_at DESC'
				: 'SELECT * FROM sessions ORDER BY updated_at DESC';
		const params = kind !== null ? [kind] : [];
		const rows = await this.database.all(sql, params);
		return rows.map((row) => parseMeta(row));
	}
}
