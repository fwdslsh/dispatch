/**
 * SessionRepository - Session metadata CRUD operations
 * @file Handles session metadata persistence
 */

import { SessionId } from '../shared/utils/session-ids.js';
import { logger } from '../shared/utils/logger.js';

/**
 * @typedef {import('./DatabaseManager.js').DatabaseManager} DatabaseManager
 */

export class SessionRepository {
	#db;

	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {
		this.#db = db;
	}

	/**
	 * Create new persistent session
	 * @param {Object} sessionData - Session creation data
	 * @param {string} sessionData.kind - Session type (ai) - only persistent sessions
	 * @param {string} sessionData.workspacePath - Workspace path
	 * @param {Object} [sessionData.metadata] - Additional metadata
	 * @param {string} [sessionData.ownerUserId=null] - Owner user ID
	 * @returns {Promise<Object>} Created session
	 * @note Ephemeral sessions (terminal, file-editor) do not use the database
	 */
	async create(sessionData) {
		const { kind, workspacePath, metadata = {}, ownerUserId = null } = sessionData;

		// Generate run ID using SessionId value object
		const runId = SessionId.create(kind).toString();
		const now = Date.now();

		const meta = {
			workspacePath,
			...metadata
		};

		await this.#db.run(
			`INSERT INTO sessions (run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[runId, ownerUserId, kind, 'starting', now, now, JSON.stringify(meta)]
		);

		return {
			id: runId,
			runId,
			ownerUserId,
			kind,
			status: 'starting',
			createdAt: now,
			updatedAt: now,
			meta
		};
	}

	/**
	 * Find session by ID
	 * @param {string} id - Session ID (run_id)
	 * @returns {Promise<Object|null>} Session or null if not found
	 */
	async findById(id) {
		const row = await this.#db.get('SELECT * FROM sessions WHERE run_id = ?', [id]);
		if (!row) return null;

		return this.#parseSession(row);
	}

	/**
	 * Find sessions by workspace path
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Array>} Sessions in workspace
	 */
	async findByWorkspace(workspacePath) {
		const rows = await this.#db.all(
			`SELECT * FROM sessions WHERE meta_json LIKE ? ORDER BY updated_at DESC`,
			[`%"workspacePath":"${workspacePath}"%`]
		);

		return rows.map((row) => this.#parseSession(row));
	}

	/**
	 * Find sessions by kind
	 * @param {string} kind - Session type
	 * @returns {Promise<Array>} Sessions of given type
	 */
	async findByKind(kind) {
		const rows = await this.#db.all(
			'SELECT * FROM sessions WHERE kind = ? ORDER BY updated_at DESC',
			[kind]
		);

		return rows.map((row) => this.#parseSession(row));
	}

	/**
	 * List all sessions
	 * @returns {Promise<Array>} All sessions
	 */
	async findAll() {
		const rows = await this.#db.all('SELECT * FROM sessions ORDER BY updated_at DESC');

		return rows.map((row) => this.#parseSession(row));
	}

	/**
	 * Update session status
	 * @param {string} id - Session ID
	 * @param {string} status - New status (starting, running, stopped, error)
	 * @returns {Promise<void>}
	 */
	async updateStatus(id, status) {
		await this.#db.run('UPDATE sessions SET status = ?, updated_at = ? WHERE run_id = ?', [
			status,
			Date.now(),
			id
		]);
	}

	/**
	 * Update session metadata
	 * @param {string} id - Session ID
	 * @param {Object} metadata - Metadata updates
	 * @returns {Promise<void>}
	 */
	async updateMetadata(id, metadata) {
		const session = await this.findById(id);
		if (!session) {
			throw new Error(`Session not found: ${id}`);
		}

		const updatedMeta = {
			...session.meta,
			...metadata
		};

		await this.#db.run('UPDATE sessions SET meta_json = ?, updated_at = ? WHERE run_id = ?', [
			JSON.stringify(updatedMeta),
			Date.now(),
			id
		]);
	}

	/**
	 * Mark all sessions as stopped (used on startup)
	 * @returns {Promise<void>}
	 */
	async markAllStopped() {
		await this.#db.run(
			`UPDATE sessions SET status = 'stopped', updated_at = ? WHERE status IN ('starting', 'running')`,
			[Date.now()]
		);
	}

	/**
	 * Delete session
	 * @param {string} id - Session ID
	 * @returns {Promise<void>}
	 */
	async delete(id) {
		// Note: Cascade delete of events handled by foreign key constraint
		await this.#db.run('DELETE FROM sessions WHERE run_id = ?', [id]);
	}

	/**
	 * Parse database row into session object
	 * @param {Object} row - Database row
	 * @returns {Object} Session object
	 */
	#parseSession(row) {
		let meta = {};
		if (row.meta_json) {
			try {
				meta = JSON.parse(row.meta_json);
			} catch (e) {
				logger.warn('SESSION', 'Failed to parse session metadata:', e);
			}
		}

		return {
			id: row.run_id,
			runId: row.run_id,
			ownerUserId: row.owner_user_id,
			kind: row.kind,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			meta
		};
	}
}
