import sqlite3 from 'sqlite3';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../utils/logger.js';

/**
 * Centralized SQLite database manager for all Dispatch server-side storage
 * Simplified schema without workspace path dependencies
 */
export class DatabaseManager {
	constructor(dbPath = null) {
		// Default to ~/.dispatch/data if no path provided
		this.dbPath =
			dbPath || join(process.env.HOME || homedir(), '.dispatch', 'data', 'workspace.db');
		this.db = null;
		this.isInitialized = false;
	}

	/**
	 * Initialize the database and create tables if they don't exist
	 */
	async init() {
		if (this.isInitialized) return;

		try {
			// Ensure directory exists
			await fs.mkdir(dirname(this.dbPath), { recursive: true });

			// Create database connection
			this.db = new sqlite3.Database(this.dbPath);

			// Enable WAL mode for better concurrent access
			await this.run('PRAGMA journal_mode=WAL');
			await this.run('PRAGMA foreign_keys=ON');

			// Create tables
			await this.createTables();

			this.isInitialized = true;
			logger.info('DATABASE', `Initialized SQLite database at: ${this.dbPath}`);
		} catch (error) {
			logger.error('DATABASE', 'Failed to initialize:', error);
			throw error;
		}
	}

	/**
	 * Create all required tables for unified session architecture
	 */
	async createTables() {
		// UNIFIED SESSION ARCHITECTURE - Single table for all run sessions
		await this.run(`
			CREATE TABLE IF NOT EXISTS sessions (
				run_id TEXT PRIMARY KEY,
				owner_user_id TEXT,
				kind TEXT NOT NULL,              -- 'pty' | 'claude'
				status TEXT NOT NULL,            -- 'starting'|'running'|'stopped'|'error'
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				meta_json TEXT NOT NULL          -- JSON: {workspacePath, shell, env, model, etc.}
			)
		`);

		// Append-only event log for all session activity
		await this.run(`
			CREATE TABLE IF NOT EXISTS session_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				seq INTEGER NOT NULL,            -- monotonic sequence per run_id
				channel TEXT NOT NULL,           -- 'pty:stdout', 'claude:delta', 'system:status'
				type TEXT NOT NULL,              -- 'chunk', 'text', 'json', 'open', 'close'
				payload BLOB NOT NULL,           -- JSON or binary data
				ts INTEGER NOT NULL,
				FOREIGN KEY (run_id) REFERENCES sessions(run_id)
			)
		`);

		// Client-specific UI layout table (one layout per client device)
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspace_layout (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				client_id TEXT NOT NULL,           -- Device/browser-specific layout
				tile_id TEXT NOT NULL,
				created_at INTEGER,
				updated_at INTEGER,
				UNIQUE(run_id, client_id)          -- One layout per run per client
			)
		`);

		// Keep workspaces table for UI workspace management
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspaces (
				path TEXT PRIMARY KEY,
				last_active INTEGER,
				created_at INTEGER,
				updated_at INTEGER
			)
		`);

		// Application logs table (keep for debugging)
		await this.run(`
			CREATE TABLE IF NOT EXISTS logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				level TEXT,
				component TEXT,
				message TEXT,
				data TEXT, -- JSON blob
				timestamp INTEGER
			)
		`);

		// Create indexes for performance
		await this.run('CREATE UNIQUE INDEX IF NOT EXISTS ix_events_run_seq ON session_events(run_id, seq)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_events_run_ts ON session_events(run_id, ts)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_sessions_kind ON sessions(kind)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_sessions_status ON sessions(status)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_workspace_layout_client ON workspace_layout(client_id)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_logs_timestamp ON logs(timestamp)');
	}

	/**
	 * Promise wrapper for SQLite run method
	 */
	run(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function (err) {
				if (err) reject(err);
				else resolve({ lastID: this.lastID, changes: this.changes });
			});
		});
	}

	/**
	 * Promise wrapper for SQLite get method
	 */
	get(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	/**
	 * Promise wrapper for SQLite all method
	 */
	all(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.all(sql, params, (err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			});
		});
	}

	/**
	 * Close database connection
	 */
	close() {
		return new Promise((resolve, reject) => {
			this.db.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	// ===== UNIFIED SESSION MANAGEMENT METHODS =====

	/**
	 * Create a new run session
	 */
	async createRunSession(runId, kind, meta, ownerUserId = null) {
		const now = Date.now();
		await this.run(
			`INSERT INTO sessions(run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
			 VALUES(?, ?, ?, 'starting', ?, ?, ?)`,
			[runId, ownerUserId, kind, now, now, JSON.stringify(meta)]
		);
	}

	/**
	 * Update run session status
	 */
	async updateRunSessionStatus(runId, status) {
		await this.run(
			`UPDATE sessions SET status=?, updated_at=? WHERE run_id=?`,
			[status, Date.now(), runId]
		);
	}

	/**
	 * Get run session by ID
	 */
	async getRunSession(runId) {
		const row = await this.get('SELECT * FROM sessions WHERE run_id = ?', [runId]);
		if (row && row.meta_json) {
			try {
				row.meta = JSON.parse(row.meta_json);
			} catch (e) {
				row.meta = {};
			}
		}
		return row;
	}

	/**
	 * List all run sessions
	 */
	async listRunSessions(kind = null) {
		const sql = kind
			? 'SELECT * FROM sessions WHERE kind = ? ORDER BY updated_at DESC'
			: 'SELECT * FROM sessions ORDER BY updated_at DESC';
		const params = kind ? [kind] : [];

		const rows = await this.all(sql, params);
		return rows.map(row => {
			if (row.meta_json) {
				try {
					row.meta = JSON.parse(row.meta_json);
				} catch (e) {
					row.meta = {};
				}
			}
			return row;
		});
	}

	/**
	 * Delete run session
	 */
	async deleteRunSession(runId) {
		// Delete session events first (foreign key constraint)
		await this.run('DELETE FROM session_events WHERE run_id = ?', [runId]);
		// Delete workspace layout entries
		await this.run('DELETE FROM workspace_layout WHERE run_id = ?', [runId]);
		// Delete session
		await this.run('DELETE FROM sessions WHERE run_id = ?', [runId]);
	}

	/**
	 * Append event to session event log
	 */
	async appendSessionEvent(runId, seq, channel, type, payload) {
		const ts = Date.now();
		const buf = payload instanceof Uint8Array ?
			payload :
			new TextEncoder().encode(JSON.stringify(payload));

		await this.run(
			`INSERT INTO session_events(run_id, seq, channel, type, payload, ts) VALUES(?,?,?,?,?,?)`,
			[runId, seq, channel, type, buf, ts]
		);

		return { runId, seq, channel, type, payload, ts };
	}

	/**
	 * Get session events since a specific sequence number
	 */
	async getSessionEventsSince(runId, afterSeq = 0) {
		const rows = await this.all(
			`SELECT run_id as runId, seq, channel, type, payload, ts
			 FROM session_events WHERE run_id=? AND seq>? ORDER BY seq ASC`,
			[runId, afterSeq]
		);

		return rows.map(row => {
			// Decode payload based on type
			if (row.payload) {
				try {
					const text = new TextDecoder().decode(row.payload);
					row.payload = JSON.parse(text);
				} catch (e) {
					// Keep as raw buffer if not JSON
					row.payload = row.payload;
				}
			}
			return row;
		});
	}

	/**
	 * Get next sequence number for a run session
	 */
	async getNextSequenceNumber(runId) {
		const result = await this.get(
			`SELECT COALESCE(MAX(seq), 0) as maxSeq FROM session_events WHERE run_id=?`,
			[runId]
		);
		return (result?.maxSeq ?? 0) + 1;
	}

	// ===== WORKSPACE MANAGEMENT METHODS =====

	async createWorkspace(path) {
		const now = Date.now();
		await this.run('INSERT OR IGNORE INTO workspaces (path, created_at, updated_at) VALUES (?, ?, ?)', [
			path,
			now,
			now
		]);
	}

	async updateWorkspaceActivity(path) {
		await this.run('UPDATE workspaces SET last_active = ?, updated_at = ? WHERE path = ?', [
			Date.now(),
			Date.now(),
			path
		]);
	}

	async listWorkspaces() {
		return await this.all('SELECT * FROM workspaces ORDER BY last_active DESC');
	}

	// ===== WORKSPACE LAYOUT METHODS =====

	/**
	 * Set workspace layout for a client
	 */
	async setWorkspaceLayout(runId, clientId, tileId) {
		const now = Date.now();
		await this.run(
			`INSERT OR REPLACE INTO workspace_layout
			 (run_id, client_id, tile_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[runId, clientId, tileId, now, now]
		);
	}

	/**
	 * Get workspace layout for a client
	 */
	async getWorkspaceLayout(clientId) {
		return await this.all(
			'SELECT * FROM workspace_layout WHERE client_id = ? ORDER BY updated_at DESC',
			[clientId]
		);
	}

	/**
	 * Remove workspace layout entry
	 */
	async removeWorkspaceLayout(runId, clientId) {
		await this.run(
			'DELETE FROM workspace_layout WHERE run_id = ? AND client_id = ?',
			[runId, clientId]
		);
	}





	// ===== LOGGING METHODS =====

	async addLog(level, component, message, data = null) {
		await this.run('INSERT INTO logs (level, component, message, data, timestamp) VALUES (?, ?, ?, ?, ?)', [
			level,
			component,
			message,
			data ? JSON.stringify(data) : null,
			Date.now()
		]);
	}

	async getLogs(component = null, level = null, limit = 100) {
		let whereClause = '';
		const params = [];

		if (component && level) {
			whereClause = 'WHERE component = ? AND level = ?';
			params.push(component, level);
		} else if (component) {
			whereClause = 'WHERE component = ?';
			params.push(component);
		} else if (level) {
			whereClause = 'WHERE level = ?';
			params.push(level);
		}

		params.push(limit);

		const rows = await this.all(
			`SELECT * FROM logs ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
			params
		);

		return rows.map(row => {
			if (row.data) {
				try {
					row.data = JSON.parse(row.data);
				} catch (e) {
					// Keep as string if parsing fails
				}
			}
			return row;
		});
	}
}