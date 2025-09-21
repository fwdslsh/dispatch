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
		this.writeQueue = Promise.resolve();
	}

	/**
	 * Initialize the database and create tables if they don't exist
	 */
	async init() {
		if (this.isInitialized) return;

		try {
			// Ensure directory exists
			await fs.mkdir(dirname(this.dbPath), { recursive: true });

			// Create database connection with serialized mode
			// This ensures all database operations are serialized (one at a time)
			this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

			// Enable WAL mode for better concurrent access
			await this.run('PRAGMA journal_mode=WAL');
			await this.run('PRAGMA foreign_keys=ON');
			// Increase busy timeout to 5 seconds
			await this.run('PRAGMA busy_timeout=5000');

			// Create tables
			await this.createTables();

			// Initialize default settings
			await this.initializeDefaultSettings();

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
				kind TEXT NOT NULL,              -- Session type: pty, claude, or file-editor
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

		// Server settings table for system-wide defaults
		await this.run(`
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,           -- JSON-encoded value
				category TEXT NOT NULL,       -- 'global', 'claude', 'terminal', etc.
				description TEXT,             -- Human-readable description
				is_sensitive BOOLEAN DEFAULT 0, -- Whether this contains sensitive data
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		// Create indexes for performance
		await this.run(
			'CREATE UNIQUE INDEX IF NOT EXISTS ix_events_run_seq ON session_events(run_id, seq)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS ix_events_run_ts ON session_events(run_id, ts)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_sessions_kind ON sessions(kind)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_sessions_status ON sessions(status)');
		await this.run(
			'CREATE INDEX IF NOT EXISTS ix_workspace_layout_client ON workspace_layout(client_id)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS ix_logs_timestamp ON logs(timestamp)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_settings_category ON settings(category)');
	}

	/**
	 * Promise wrapper for SQLite run method with retry logic
	 */
	async run(sql, params = [], retries = 3) {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				return await new Promise((resolve, reject) => {
					this.db.run(sql, params, function (err) {
						if (err) reject(err);
						else resolve({ lastID: this.lastID, changes: this.changes });
					});
				});
			} catch (err) {
				if (err.code === 'SQLITE_BUSY' && attempt < retries - 1) {
					// Wait with exponential backoff
					await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
					continue;
				}
				throw err;
			}
		}
	}

	/**
	 * Promise wrapper for SQLite get method with retry logic
	 */
	async get(sql, params = [], retries = 3) {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				return await new Promise((resolve, reject) => {
					this.db.get(sql, params, (err, row) => {
						if (err) reject(err);
						else resolve(row);
					});
				});
			} catch (err) {
				if (err.code === 'SQLITE_BUSY' && attempt < retries - 1) {
					await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
					continue;
				}
				throw err;
			}
		}
	}

	/**
	 * Promise wrapper for SQLite all method with retry logic
	 */
	async all(sql, params = [], retries = 3) {
		for (let attempt = 0; attempt < retries; attempt++) {
			try {
				return await new Promise((resolve, reject) => {
					this.db.all(sql, params, (err, rows) => {
						if (err) reject(err);
						else resolve(rows);
					});
				});
			} catch (err) {
				if (err.code === 'SQLITE_BUSY' && attempt < retries - 1) {
					await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
					continue;
				}
				throw err;
			}
		}
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
	 * Create a new run session (serialized write operation)
	 */
	async createRunSession(runId, kind, meta, ownerUserId = null) {
		// Queue this write operation to prevent concurrent writes
		this.writeQueue = this.writeQueue
			.then(async () => {
				const now = Date.now();
				await this.run(
					`INSERT INTO sessions(run_id, owner_user_id, kind, status, created_at, updated_at, meta_json)
				 VALUES(?, ?, ?, 'starting', ?, ?, ?)`,
					[runId, ownerUserId, kind, now, now, JSON.stringify(meta)]
				);
			})
			.catch((err) => {
				// Re-throw to maintain error propagation
				throw err;
			});

		return this.writeQueue;
	}

	/**
	 * Mark all sessions as stopped (used on startup to reset stale state)
	 */
	async markAllSessionsStopped() {
		await this.run(
			`UPDATE sessions
			 SET status='stopped', updated_at=?
			 WHERE status='running'`,
			[Date.now()]
		);
	}

	/**
	 * Update run session status
	 */
	async updateRunSessionStatus(runId, status) {
		await this.run(`UPDATE sessions SET status=?, updated_at=? WHERE run_id=?`, [
			status,
			Date.now(),
			runId
		]);
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
		return rows.map((row) => {
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
	 * Append event to session event log (serialized write operation)
	 */
	async appendSessionEvent(runId, seq, channel, type, payload) {
		// Queue this write operation to prevent concurrent writes
		this.writeQueue = this.writeQueue
			.then(async () => {
				const ts = Date.now();
				const buf =
					payload instanceof Uint8Array
						? payload
						: new TextEncoder().encode(JSON.stringify(payload));

				await this.run(
					`INSERT INTO session_events(run_id, seq, channel, type, payload, ts) VALUES(?,?,?,?,?,?)`,
					[runId, seq, channel, type, buf, ts]
				);

				return { runId, seq, channel, type, payload, ts };
			})
			.catch((err) => {
				throw err;
			});

		return this.writeQueue;
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

		return rows.map((row) => {
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
		await this.run(
			'INSERT OR IGNORE INTO workspaces (path, created_at, updated_at) VALUES (?, ?, ?)',
			[path, now, now]
		);
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
		await this.run('DELETE FROM workspace_layout WHERE run_id = ? AND client_id = ?', [
			runId,
			clientId
		]);
	}

	// ===== LOGGING METHODS =====

	async addLog(level, component, message, data = null) {
		await this.run(
			'INSERT INTO logs (level, component, message, data, timestamp) VALUES (?, ?, ?, ?, ?)',
			[level, component, message, data ? JSON.stringify(data) : null, Date.now()]
		);
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

		return rows.map((row) => {
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

	/**
	 * Settings Management Methods
	 */

	/**
	 * Get a setting value by key
	 * @param {string} key - Setting key
	 * @returns {Promise<any>} Setting value (parsed from JSON)
	 */
	async getSetting(key) {
		const row = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
		if (!row) return null;
		try {
			return JSON.parse(row.value);
		} catch (e) {
			console.warn(`Failed to parse setting '${key}':`, e);
			return row.value;
		}
	}

	/**
	 * Get all settings for a category
	 * @param {string} category - Setting category ('global', 'claude', etc.)
	 * @returns {Promise<Object>} Key-value pairs of settings
	 */
	async getSettingsByCategory(category) {
		const rows = await this.all('SELECT key, value FROM settings WHERE category = ?', [category]);
		const settings = {};
		for (const row of rows) {
			try {
				settings[row.key] = JSON.parse(row.value);
			} catch (e) {
				console.warn(`Failed to parse setting '${row.key}':`, e);
				settings[row.key] = row.value;
			}
		}
		return settings;
	}

	/**
	 * Get all settings with metadata
	 * @returns {Promise<Array>} Array of setting objects with metadata
	 */
	async getAllSettings() {
		const rows = await this.all(`
			SELECT key, value, category, description, is_sensitive, created_at, updated_at 
			FROM settings 
			ORDER BY category, key
		`);
		return rows.map((row) => {
			try {
				row.value = JSON.parse(row.value);
			} catch (e) {
				// Keep as string if parsing fails
			}
			return row;
		});
	}

	/**
	 * Set a setting value
	 * @param {string} key - Setting key
	 * @param {any} value - Setting value (will be JSON encoded)
	 * @param {string} category - Setting category
	 * @param {string} description - Optional description
	 * @param {boolean} isSensitive - Whether this setting contains sensitive data
	 */
	async setSetting(key, value, category, description = null, isSensitive = false) {
		const now = Date.now();
		const valueJson = JSON.stringify(value);

		await this.run(
			`INSERT OR REPLACE INTO settings 
			 (key, value, category, description, is_sensitive, created_at, updated_at) 
			 VALUES (?, ?, ?, ?, ?, 
			         COALESCE((SELECT created_at FROM settings WHERE key = ?), ?), 
			         ?)`,
			[key, valueJson, category, description, isSensitive ? 1 : 0, key, now, now]
		);
	}

	/**
	 * Delete a setting
	 * @param {string} key - Setting key
	 */
	async deleteSetting(key) {
		await this.run('DELETE FROM settings WHERE key = ?', [key]);
	}

	/**
	 * Initialize default settings
	 */
	async initializeDefaultSettings() {
		const defaults = [
			// Global defaults
			{
				key: 'global.theme',
				value: 'retro',
				category: 'global',
				description: 'Default application theme'
			},
			{
				key: 'global.defaultLayout',
				value: '2up',
				category: 'global',
				description: 'Default workspace layout'
			},
			{
				key: 'global.autoSaveEnabled',
				value: true,
				category: 'global',
				description: 'Enable automatic saving of work'
			},
			{
				key: 'global.sessionTimeoutMinutes',
				value: 30,
				category: 'global',
				description: 'Session timeout in minutes'
			},
			{
				key: 'global.enableAnimations',
				value: true,
				category: 'global',
				description: 'Enable UI animations'
			},
			{
				key: 'global.enableSoundEffects',
				value: false,
				category: 'global',
				description: 'Enable sound effects'
			},
			// Claude defaults
			{
				key: 'claude.model',
				value: 'claude-3-5-sonnet-20241022',
				category: 'claude',
				description: 'Default Claude model for new sessions'
			},
			{
				key: 'claude.permissionMode',
				value: 'default',
				category: 'claude',
				description: 'Default permission mode for Claude sessions'
			},
			{
				key: 'claude.maxTurns',
				value: null,
				category: 'claude',
				description: 'Maximum turns per Claude session'
			},
			{
				key: 'claude.includePartialMessages',
				value: false,
				category: 'claude',
				description: 'Include partial messages in Claude responses'
			},
			{
				key: 'claude.continueConversation',
				value: false,
				category: 'claude',
				description: 'Continue conversations by default'
			},
			{
				key: 'claude.executable',
				value: 'auto',
				category: 'claude',
				description: 'Default JavaScript executable for Claude sessions'
			}
		];

		for (const setting of defaults) {
			// Only insert if the setting doesn't already exist
			const existing = await this.getSetting(setting.key);
			if (existing === null) {
				await this.setSetting(
					setting.key,
					setting.value,
					setting.category,
					setting.description,
					false
				);
			}
		}
	}
}
