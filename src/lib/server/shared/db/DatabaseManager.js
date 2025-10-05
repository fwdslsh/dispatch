import sqlite3 from 'sqlite3';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../utils/logger.js';
import { SessionRepository } from './repositories/SessionRepository.js';
import { EventStore } from './repositories/EventStore.js';
import { SettingsRepository } from './repositories/SettingsRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { UnitOfWork } from './UnitOfWork.js';

const deriveWorkspaceName = (path) => {
	if (!path) return 'Unnamed Workspace';
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || 'Root';
};

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
		this.sessions = new SessionRepository(this);
		this.eventStore = new EventStore(this);
		this.settings = new SettingsRepository(this);
		this.users = new UserRepository(this);
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
			await this.settings.initializeDefaults();

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
				name TEXT,
				last_active INTEGER,
				created_at INTEGER,
				updated_at INTEGER
			)
		`);

		await this.ensureWorkspaceSchema();

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

		// User preferences table for UI and behavior customization
		await this.run(`
			CREATE TABLE IF NOT EXISTS user_preferences (
				user_id TEXT NOT NULL,
				category TEXT NOT NULL,
				preferences_json TEXT NOT NULL DEFAULT '{}',
				created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (user_id, category)
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
		// No index needed since category is the primary key
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

	enqueueWrite(operation) {
		const next = this.writeQueue.then(() => operation());
		this.writeQueue = next.catch((error) => {
			this.writeQueue = Promise.resolve();
			throw error;
		});
		return this.writeQueue;
	}

	async waitForWrites() {
		try {
			await this.writeQueue;
		} catch {
			// ignore errors from previous writes when waiting for queue to drain
		}
	}

	createUnitOfWork() {
		return new UnitOfWork(this);
	}

	async deleteRunSession(runSessionId) {
		const unitOfWork = this.createUnitOfWork();
		await unitOfWork.withTransaction(async ({ run }) => {
			await this.eventStore.deleteForRun(runSessionId);
			await run('DELETE FROM workspace_layout WHERE run_id = ?', [runSessionId]);
			await run('DELETE FROM sessions WHERE run_id = ?', [runSessionId]);
		});
	}

	// ===== WORKSPACE MANAGEMENT METHODS =====

	async ensureWorkspaceSchema() {
		const columns = await this.all('PRAGMA table_info(workspaces)');
		const hasNameColumn = columns.some((column) => column.name === 'name');
		if (!hasNameColumn) {
			await this.run('ALTER TABLE workspaces ADD COLUMN name TEXT');
		}

		const hasThemeOverrideColumn = columns.some((column) => column.name === 'theme_override');
		if (!hasThemeOverrideColumn) {
			await this.run('ALTER TABLE workspaces ADD COLUMN theme_override TEXT DEFAULT NULL');
		}

		const workspaces = await this.all('SELECT path, name FROM workspaces');
		for (const workspace of workspaces) {
			if (!workspace?.name || !workspace.name.toString().trim()) {
				const derivedName = deriveWorkspaceName(workspace.path);
				await this.run('UPDATE workspaces SET name = ? WHERE path = ?', [
					derivedName,
					workspace.path
				]);
			}
		}
	}

	async createWorkspace(path, name = null) {
		const now = Date.now();
		const finalName =
			typeof name === 'string' && name.trim() ? name.trim() : deriveWorkspaceName(path);
		try {
			await this.run(
				'INSERT INTO workspaces (path, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
				[path, finalName, now, now]
			);
		} catch (error) {
			if (error?.code === 'SQLITE_CONSTRAINT') {
				throw error;
			}
			throw error;
		}
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
	async setWorkspaceLayout(runSessionId, clientId, tileId) {
		const now = Date.now();
		await this.run(
			`INSERT OR REPLACE INTO workspace_layout
                         (run_id, client_id, tile_id, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?)`,
			[runSessionId, clientId, tileId, now, now]
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
	async removeWorkspaceLayout(runSessionId, clientId) {
		await this.run('DELETE FROM workspace_layout WHERE run_id = ? AND client_id = ?', [
			runSessionId,
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
				} catch {
					// Keep as string if parsing fails
				}
			}
			return row;
		});
	}
}
