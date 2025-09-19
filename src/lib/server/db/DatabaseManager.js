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

			// Run migrations first
			await this.runMigrations();

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
	 * Run database migrations to update schema
	 */
	async runMigrations() {
		try {
			// Check if old app_sessions table exists
			const tables = await this.all(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='app_sessions'"
			);

			if (tables.length > 0) {
				logger.info('DATABASE', 'Migrating from app_sessions to sessions table...');

				// Check if new sessions table exists
				const newTableExists = await this.all(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
				);

				if (newTableExists.length === 0) {
					// Create new sessions table from app_sessions data
					await this.run(`
						CREATE TABLE IF NOT EXISTS sessions (
							id TEXT PRIMARY KEY,
							session_type TEXT,
							type_specific_id TEXT,
							title TEXT,
							working_directory TEXT,
							created_at INTEGER,
							updated_at INTEGER
						)
					`);

					// Migrate data from app_sessions to sessions (without pinned field)
					await this.run(`
						INSERT INTO sessions (id, session_type, type_specific_id, title, working_directory, created_at, updated_at)
						SELECT id, session_type, type_specific_id, title, working_directory, created_at, updated_at
						FROM app_sessions
					`);
				}

				// Drop the old app_sessions table
				await this.run('DROP TABLE IF EXISTS app_sessions');
				logger.info('DATABASE', 'Migration complete: app_sessions -> sessions');
			}

			// Check if old sessions table exists with wrong schema (socket sessions)
			const sessionCols = await this.all(
				"PRAGMA table_info(sessions)"
			);

			// If sessions table exists but has socket_id column, rename it
			const hasSocketId = sessionCols.some(col => col.name === 'socket_id');
			if (hasSocketId) {
				logger.info('DATABASE', 'Renaming old socket sessions table...');
				await this.run('ALTER TABLE sessions RENAME TO socket_sessions');
			}

		} catch (error) {
			logger.warn('DATABASE', 'Migration error (continuing anyway):', error);
			// Continue anyway - tables will be created fresh if needed
		}
	}

	/**
	 * Create all required tables
	 */
	async createTables() {
		// Socket sessions table for active socket connections
		await this.run(`
			CREATE TABLE IF NOT EXISTS socket_sessions (
				id TEXT PRIMARY KEY,
				socket_id TEXT,
				metadata TEXT, -- JSON blob
				created_at INTEGER,
				updated_at INTEGER,
				disconnected_at INTEGER
			)
		`);

		// Session history events table
		await this.run(`
			CREATE TABLE IF NOT EXISTS session_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_id TEXT,
				socket_id TEXT,
				event_type TEXT,
				direction TEXT, -- 'in', 'out', 'system'
				data TEXT, -- JSON blob
				timestamp INTEGER,
				FOREIGN KEY (session_id) REFERENCES socket_sessions(id)
			)
		`);

		// Workspaces table (for UI workspace management only)
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspaces (
				path TEXT PRIMARY KEY,
				last_active INTEGER,
				created_at INTEGER,
				updated_at INTEGER
			)
		`);

		// Sessions table (simplified - no pinned field, no workspace dependency)
		await this.run(`
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				session_type TEXT, -- 'claude', 'pty'
				type_specific_id TEXT,
				title TEXT,
				working_directory TEXT, -- Session's working directory (optional)
				created_at INTEGER,
				updated_at INTEGER
			)
		`);

		// Session layout table (maps sessions to UI tiles)
		await this.run(`
			CREATE TABLE IF NOT EXISTS session_layout (
				session_id TEXT PRIMARY KEY, -- One session can only be in one tile
				tile_id TEXT NOT NULL,       -- 'tile-1', 'tile-2', etc
				position INTEGER DEFAULT 0,  -- Position within tile (for ordering)
				created_at INTEGER,
				updated_at INTEGER,
				FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
			)
		`);

		// Terminal history table
		await this.run(`
			CREATE TABLE IF NOT EXISTS terminal_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				terminal_id TEXT,
				data TEXT,
				timestamp INTEGER
			)
		`);

		// Claude sessions metadata table (JSONL files still handled by Claude SDK)
		await this.run(`
			CREATE TABLE IF NOT EXISTS claude_sessions (
				id TEXT PRIMARY KEY,
				working_directory TEXT, -- Working directory for Claude session
				session_id TEXT, -- The actual Claude session ID
				app_session_id TEXT, -- Application session ID for routing
				resume_capable BOOLEAN,
				created_at INTEGER,
				updated_at INTEGER
			)
		`);

		// Application logs table
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
		await this.run(
			'CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id)'
		);
		await this.run(
			'CREATE INDEX IF NOT EXISTS idx_session_history_timestamp ON session_history(timestamp)'
		);
		await this.run(
			'CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(session_type)'
		);
		await this.run(
			'CREATE INDEX IF NOT EXISTS idx_session_layout_tile ON session_layout(tile_id)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS idx_terminal_history ON terminal_history(terminal_id)');
		await this.run('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');
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

	// ===== SESSION MANAGEMENT METHODS =====

	async createSession(sessionId, socketId, metadata = {}) {
		const now = Date.now();
		await this.run('INSERT OR REPLACE INTO socket_sessions (id, socket_id, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
			sessionId,
			socketId,
			JSON.stringify(metadata),
			now,
			now
		]);
	}

	async updateSession(sessionId, metadata) {
		await this.run('UPDATE socket_sessions SET metadata = ?, updated_at = ? WHERE id = ?', [
			JSON.stringify(metadata),
			Date.now(),
			sessionId
		]);
	}

	async getSession(sessionId) {
		const row = await this.get('SELECT * FROM socket_sessions WHERE id = ?', [sessionId]);
		if (row && row.metadata) {
			row.metadata = JSON.parse(row.metadata);
		}
		return row;
	}

	async disconnectSession(sessionId) {
		await this.run('UPDATE socket_sessions SET disconnected_at = ? WHERE id = ?', [Date.now(), sessionId]);
	}

	async addSessionEvent(sessionId, socketId, eventType, direction, data = null) {
		await this.run('INSERT INTO session_history (session_id, socket_id, event_type, direction, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)', [
			sessionId,
			socketId,
			eventType,
			direction,
			data ? JSON.stringify(data) : null,
			Date.now()
		]);
	}

	async getSessionHistory(sessionId) {
		const rows = await this.all('SELECT * FROM session_history WHERE session_id = ? ORDER BY timestamp ASC', [sessionId]);
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

	async getRecentSessionEvents(sessionId, sinceTimestamp = null, maxMessages = 100) {
		const whereClause = sinceTimestamp
			? 'WHERE session_id = ? AND timestamp > ?'
			: 'WHERE session_id = ?';
		const params = sinceTimestamp ? [sessionId, sinceTimestamp] : [sessionId];

		const rows = await this.all(
			`SELECT * FROM session_history ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
			[...params, maxMessages]
		);

		return rows.reverse().map(row => {
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

	async listSessionHistories() {
		return await this.all('SELECT DISTINCT session_id FROM session_history ORDER BY session_id');
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

	// ===== APPLICATION SESSION METHODS =====

	async addSession(
		sessionId,
		sessionType,
		typeSpecificId,
		title,
		workingDirectory = null
	) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO sessions (id, session_type, type_specific_id, title, working_directory, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[sessionId, sessionType, typeSpecificId, title, workingDirectory, now, now]
		);
	}

	async getAllSessions() {
		return await this.all(
			'SELECT * FROM sessions ORDER BY updated_at DESC'
		);
	}

	async getAppSession(sessionId) {
		return await this.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
	}

	async deleteSession(sessionId) {
		await this.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
	}

	async renameSession(sessionId, newTitle) {
		await this.run(
			'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?',
			[newTitle, Date.now(), sessionId]
		);
	}

	async updateSessionTypeId(sessionId, newTypeSpecificId) {
		await this.run(
			'UPDATE sessions SET type_specific_id = ?, updated_at = ? WHERE id = ?',
			[newTypeSpecificId, Date.now(), sessionId]
		);
	}

	// ===== SESSION LAYOUT METHODS =====

	/**
	 * Add or update session layout (which tile it's displayed in)
	 */
	async setSessionLayout(sessionId, tileId, position = 0) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO session_layout (session_id, tile_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
			[sessionId, tileId, position, now, now]
		);
	}

	/**
	 * Remove session from layout (no longer displayed)
	 */
	async removeSessionLayout(sessionId) {
		await this.run('DELETE FROM session_layout WHERE session_id = ?', [sessionId]);
	}

	/**
	 * Get all sessions with their layout info
	 */
	async getSessionsWithLayout() {
		return await this.all(`
			SELECT s.*, l.tile_id, l.position
			FROM sessions s
			LEFT JOIN session_layout l ON s.id = l.session_id
			ORDER BY s.updated_at DESC
		`);
	}

	/**
	 * Get sessions for a specific tile
	 */
	async getSessionsForTile(tileId) {
		return await this.all(`
			SELECT s.*, l.tile_id, l.position
			FROM sessions s
			INNER JOIN session_layout l ON s.id = l.session_id
			WHERE l.tile_id = ?
			ORDER BY l.position, s.created_at
		`, [tileId]);
	}

	/**
	 * Get current layout (all tile assignments)
	 */
	async getCurrentLayout() {
		return await this.all(`
			SELECT l.session_id, l.tile_id, l.position, s.title, s.session_type
			FROM session_layout l
			INNER JOIN sessions s ON l.session_id = s.id
			ORDER BY l.tile_id, l.position
		`);
	}

	// ===== TERMINAL HISTORY METHODS =====

	async addTerminalHistory(terminalId, data) {
		await this.run('INSERT INTO terminal_history (terminal_id, data, timestamp) VALUES (?, ?, ?)', [
			terminalId,
			data,
			Date.now()
		]);
	}

	async getTerminalHistory(terminalId, limit = 1000) {
		return await this.all(
			'SELECT * FROM terminal_history WHERE terminal_id = ? ORDER BY timestamp ASC LIMIT ?',
			[terminalId, limit]
		);
	}

	// ===== CLAUDE SESSION METHODS =====

	async addClaudeSession(id, workingDirectory, sessionId, appSessionId, resumeCapable) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO claude_sessions (id, working_directory, session_id, app_session_id, resume_capable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[id, workingDirectory, sessionId, appSessionId, resumeCapable, now, now]
		);
	}

	async getClaudeSession(id) {
		return await this.get('SELECT * FROM claude_sessions WHERE id = ?', [id]);
	}

	async listClaudeSessions(workingDirectory = null) {
		if (workingDirectory) {
			return await this.all(
				'SELECT * FROM claude_sessions WHERE working_directory = ? ORDER BY updated_at DESC',
				[workingDirectory]
			);
		}
		return await this.all('SELECT * FROM claude_sessions ORDER BY updated_at DESC');
	}

	async deleteClaudeSession(id) {
		await this.run('DELETE FROM claude_sessions WHERE id = ?', [id]);
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