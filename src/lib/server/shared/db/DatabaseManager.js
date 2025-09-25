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

		// Server settings table for system-wide defaults (JSON objects per category)
		await this.run(`
			CREATE TABLE IF NOT EXISTS settings (
				category TEXT PRIMARY KEY,    -- 'global', 'claude', 'terminal', etc.
				settings_json TEXT NOT NULL, -- JSON object containing all settings for this category
				description TEXT,            -- Human-readable description of the category
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		// Authentication system tables
		await this.run(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT NOT NULL UNIQUE,
				display_name TEXT,
				email TEXT UNIQUE,
				password_hash TEXT,
				is_admin BOOLEAN DEFAULT 0,
				is_active BOOLEAN DEFAULT 1,
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS auth_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER,
				device_id INTEGER,
				event_type TEXT NOT NULL,
				ip_address TEXT,
				user_agent TEXT,
				details TEXT,
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS user_devices (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				device_name TEXT NOT NULL,
				device_fingerprint TEXT NOT NULL UNIQUE,
				last_ip_address TEXT,
				user_agent TEXT,
				is_trusted BOOLEAN DEFAULT 0,
				last_seen_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS auth_sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				device_id INTEGER,
				session_token TEXT NOT NULL UNIQUE,
				expires_at INTEGER NOT NULL,
				ip_address TEXT,
				user_agent TEXT,
				last_activity_at INTEGER,
				is_active BOOLEAN DEFAULT 1,
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				FOREIGN KEY (user_id) REFERENCES users(id),
				FOREIGN KEY (device_id) REFERENCES user_devices(id)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS webauthn_credentials (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				credential_id TEXT NOT NULL UNIQUE,
				public_key TEXT NOT NULL,
				counter INTEGER DEFAULT 0,
				device_name TEXT,
				aaguid TEXT,
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS oauth_accounts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				provider TEXT NOT NULL,
				provider_user_id TEXT NOT NULL,
				provider_email TEXT,
				provider_name TEXT,
				access_token TEXT,
				refresh_token TEXT,
				expires_at INTEGER,
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				FOREIGN KEY (user_id) REFERENCES users(id),
				UNIQUE(provider, provider_user_id)
			)
		`);

		await this.run(`
			CREATE TABLE IF NOT EXISTS certificates (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				domain TEXT NOT NULL UNIQUE,
				cert_path TEXT NOT NULL,
				key_path TEXT NOT NULL,
				ca_cert_path TEXT,
				cert_type TEXT NOT NULL,
				expires_at INTEGER,
				auto_renew BOOLEAN DEFAULT 1,
				created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
				updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
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

		// Auth table indexes
		await this.run('CREATE INDEX IF NOT EXISTS ix_users_username ON users(username)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_auth_events_user ON auth_events(user_id)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_auth_events_type ON auth_events(event_type)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_user_devices_user ON user_devices(user_id)');
		await this.run(
			'CREATE INDEX IF NOT EXISTS ix_user_devices_fingerprint ON user_devices(device_fingerprint)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions(user_id)');
		await this.run(
			'CREATE INDEX IF NOT EXISTS ix_auth_sessions_token ON auth_sessions(session_token)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS ix_webauthn_user ON webauthn_credentials(user_id)');
		await this.run('CREATE INDEX IF NOT EXISTS ix_oauth_user ON oauth_accounts(user_id)');
		await this.run(
			'CREATE INDEX IF NOT EXISTS ix_oauth_provider ON oauth_accounts(provider, provider_user_id)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS ix_certificates_domain ON certificates(domain)');
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

	/**
	 * Delete all session events for a run session
	 * Used for cleanup when session creation fails after some events have been written
	 */
	async deleteSessionEvents(runId) {
		return this.run(`DELETE FROM session_events WHERE run_id = ?`, [runId]);
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
	 * Settings Management Methods - JSON objects per category
	 */

	/**
	 * Get all settings for a category
	 * @param {string} category - Setting category ('global', 'claude', etc.)
	 * @returns {Promise<Object>} Settings object for the category
	 */
	async getSettingsByCategory(category) {
		const row = await this.get('SELECT settings_json FROM settings WHERE category = ?', [category]);
		if (!row) return {};
		try {
			return JSON.parse(row.settings_json);
		} catch (e) {
			console.warn(`Failed to parse settings for category '${category}':`, e);
			return {};
		}
	}

	/**
	 * Get all settings with metadata
	 * @returns {Promise<Array>} Array of setting categories with metadata
	 */
	async getAllSettings() {
		const rows = await this.all(`
			SELECT category, settings_json, description, created_at, updated_at
			FROM settings
			ORDER BY category
		`);
		return rows.map((row) => {
			try {
				row.settings = JSON.parse(row.settings_json);
			} catch (e) {
				row.settings = {};
			}
			delete row.settings_json; // Remove raw JSON from response
			return row;
		});
	}

	/**
	 * Set settings for a category
	 * @param {string} category - Setting category
	 * @param {Object} settings - Settings object for this category
	 * @param {string} description - Optional description
	 */
	async setSettingsForCategory(category, settings, description = null) {
		const now = Date.now();
		const settingsJson = JSON.stringify(settings);

		await this.run(
			`INSERT OR REPLACE INTO settings
			 (category, settings_json, description, created_at, updated_at)
			 VALUES (?, ?, ?,
			         COALESCE((SELECT created_at FROM settings WHERE category = ?), ?),
			         ?)`,
			[category, settingsJson, description, category, now, now]
		);
	}

	/**
	 * Update specific setting in a category
	 * @param {string} category - Setting category
	 * @param {string} key - Setting key within the category
	 * @param {any} value - Setting value
	 */
	async updateSettingInCategory(category, key, value) {
		// Get current settings for category
		const currentSettings = await this.getSettingsByCategory(category);

		// Update the specific key
		currentSettings[key] = value;

		// Save back to database
		await this.setSettingsForCategory(category, currentSettings);
	}

	/**
	 * Delete a settings category
	 * @param {string} category - Setting category
	 */
	async deleteSettingsCategory(category) {
		await this.run('DELETE FROM settings WHERE category = ?', [category]);
	}

	/**
	 * Initialize default settings with only actually used settings
	 */
	async initializeDefaultSettings() {
		const categories = [
			// Global settings - only include settings that are actually used
			{
				category: 'global',
				settings: {
					theme: 'retro' // Used in data-theme attribute setting
				},
				description: 'Global application settings'
			},
			// Claude settings - used in session creation
			{
				category: 'claude',
				settings: {
					model: 'claude-3-5-sonnet-20241022',
					permissionMode: 'default',
					executable: 'auto',
					maxTurns: null,
					includePartialMessages: false,
					continueConversation: false
				},
				description: 'Default Claude session settings'
			},
			// Workspace environment variables - applied to all sessions
			{
				category: 'workspace',
				settings: {
					envVariables: {}
				},
				description: 'Workspace-level environment variables for all sessions'
			},
			// Authentication settings - auth mode configuration
			{
				category: 'auth',
				settings: {
					enabled_methods: ['local'],
					default_method: 'local',
					session_timeout_hours: 24,
					max_devices_per_user: 10,
					webauthn_enabled: false,
					oauth_providers: {
						google: { enabled: false },
						github: { enabled: false }
					}
				},
				description: 'Authentication configuration and enabled methods'
			},
			// Security settings - security policy configuration
			{
				category: 'security',
				settings: {
					require_https: false,
					hsts_enabled: false,
					require_device_trust: false,
					cors_origins: ['*'],
					csrf_protection: true,
					rate_limiting: {
						enabled: true,
						max_requests: 100,
						window_minutes: 15
					},
					cookie_settings: {
						secure: false,
						same_site: 'Lax',
						http_only: true
					}
				},
				description: 'Security policy configuration and HTTPS settings'
			},
			// Certificate settings - certificate management configuration
			{
				category: 'certificates',
				settings: {
					active_profile: 'none',
					mkcert: {
						enabled: false,
						domains: ['localhost', '127.0.0.1']
					},
					letsencrypt: {
						enabled: false,
						email: null,
						domains: [],
						auto_renew: true
					},
					tunnel_tls: {
						enabled: false,
						auto_configure: true
					}
				},
				description: 'Certificate management and HTTPS profile configuration'
			}
		];

		for (const categoryData of categories) {
			// Only insert if the category doesn't already exist
			const existing = await this.getSettingsByCategory(categoryData.category);
			if (Object.keys(existing).length === 0) {
				await this.setSettingsForCategory(
					categoryData.category,
					categoryData.settings,
					categoryData.description
				);
			}
		}
	}
}
