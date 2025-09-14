import sqlite3 from 'sqlite3';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../utils/logger.js';

/**
 * Centralized SQLite database manager for all Dispatch server-side storage
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
	 * Create all required tables
	 */
	async createTables() {
		// Sessions table for active socket sessions
		await this.run(`
			CREATE TABLE IF NOT EXISTS sessions (
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
				FOREIGN KEY (session_id) REFERENCES sessions(id)
			)
		`);

		// Workspaces table
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspaces (
				path TEXT PRIMARY KEY,
				last_active INTEGER,
				created_at INTEGER,
				updated_at INTEGER
			)
		`);

		// Workspace sessions mapping table
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspace_sessions (
				id TEXT PRIMARY KEY,
				workspace_path TEXT,
				session_type TEXT, -- 'claude', 'pty'
				type_specific_id TEXT,
				title TEXT,
				pinned INTEGER DEFAULT 1,
				created_at INTEGER,
				updated_at INTEGER,
				FOREIGN KEY (workspace_path) REFERENCES workspaces(path)
			)
		`);

		// Ensure pinned column exists (for existing installations)
		try {
			await this.run('ALTER TABLE workspace_sessions ADD COLUMN pinned INTEGER DEFAULT 1');
		} catch (e) {
			// Ignore if column already exists
		}

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
				workspace_path TEXT,
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
			'CREATE INDEX IF NOT EXISTS idx_workspace_sessions_workspace ON workspace_sessions(workspace_path)'
		);
		await this.run(
			'CREATE INDEX IF NOT EXISTS idx_terminal_history_terminal_id ON terminal_history(terminal_id)'
		);
		await this.run(
			'CREATE INDEX IF NOT EXISTS idx_claude_sessions_app_session ON claude_sessions(app_session_id)'
		);
		await this.run('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');
		await this.run('CREATE INDEX IF NOT EXISTS idx_logs_component ON logs(component)');
	}

	/**
	 * Execute a SQL statement with parameters
	 */
	async run(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, function (err) {
				if (err) reject(err);
				else resolve({ lastID: this.lastID, changes: this.changes });
			});
		});
	}

	/**
	 * Execute a SELECT query and return first row
	 */
	async get(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row);
			});
		});
	}

	/**
	 * Execute a SELECT query and return all rows
	 */
	async all(sql, params = []) {
		return new Promise((resolve, reject) => {
			this.db.all(sql, params, (err, rows) => {
				if (err) reject(err);
				else resolve(rows);
			});
		});
	}

	/**
	 * Close the database connection
	 */
	async close() {
		if (this.db) {
			await new Promise((resolve, reject) => {
				this.db.close((err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.db = null;
			this.isInitialized = false;
		}
	}

	// Session management methods
	async createSession(sessionId, socketId, metadata = {}) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO sessions (id, socket_id, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
			[sessionId, socketId, JSON.stringify(metadata), now, now]
		);
	}

	async updateSession(sessionId, metadata) {
		await this.run('UPDATE sessions SET metadata = ?, updated_at = ? WHERE id = ?', [
			JSON.stringify(metadata),
			Date.now(),
			sessionId
		]);
	}

	async getSession(sessionId) {
		const row = await this.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
		if (row && row.metadata) {
			row.metadata = JSON.parse(row.metadata);
		}
		return row;
	}

	async disconnectSession(sessionId) {
		await this.run('UPDATE sessions SET disconnected_at = ? WHERE id = ?', [Date.now(), sessionId]);
	}

	// Session history methods
	async addSessionEvent(sessionId, socketId, eventType, direction, data = null) {
		await this.run(
			'INSERT INTO session_history (session_id, socket_id, event_type, direction, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
			[sessionId, socketId, eventType, direction, data ? JSON.stringify(data) : null, Date.now()]
		);
	}

	async getSessionHistory(sessionId) {
		const rows = await this.all(
			'SELECT * FROM session_history WHERE session_id = ? ORDER BY timestamp ASC',
			[sessionId]
		);
		return rows.map((row) => ({
			...row,
			data: row.data ? JSON.parse(row.data) : null
		}));
	}

	async listSessionHistories() {
		const rows = await this.all(`
			SELECT 
				s.id as session_id,
				s.socket_id,
				s.metadata,
				s.created_at,
				s.updated_at,
				s.disconnected_at,
				COUNT(h.id) as event_count,
				MAX(h.timestamp) as last_event_time
			FROM sessions s
			LEFT JOIN session_history h ON s.id = h.session_id
			GROUP BY s.id
			ORDER BY s.updated_at DESC
		`);

		return rows.map((row) => ({
			sessionId: row.session_id,
			socketId: row.socket_id,
			metadata: row.metadata ? JSON.parse(row.metadata) : {},
			eventCount: row.event_count,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
			lastEventTime: row.last_event_time ? new Date(row.last_event_time) : null,
			isActive: !row.disconnected_at
		}));
	}

	// Workspace methods
	async createWorkspace(path) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO workspaces (path, last_active, created_at, updated_at) VALUES (?, ?, ?, ?)',
			[path, now, now, now]
		);
	}

	async updateWorkspaceActivity(path) {
		const now = Date.now();
		await this.run('UPDATE workspaces SET last_active = ?, updated_at = ? WHERE path = ?', [
			now,
			now,
			path
		]);
	}

	async getWorkspace(path) {
		return await this.get('SELECT * FROM workspaces WHERE path = ?', [path]);
	}

	async listWorkspaces() {
		return await this.all('SELECT * FROM workspaces ORDER BY last_active DESC');
	}

	// Workspace session methods
	async addWorkspaceSession(
		sessionId,
		workspacePath,
		sessionType,
		typeSpecificId,
		title,
		pinned = 1
	) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO workspace_sessions (id, workspace_path, session_type, type_specific_id, title, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[sessionId, workspacePath, sessionType, typeSpecificId, title, pinned, now, now]
		);
	}

	async getWorkspaceSessions(workspacePath, pinnedOnly = true) {
		if (pinnedOnly) {
			return await this.all(
				'SELECT * FROM workspace_sessions WHERE workspace_path = ? AND pinned = 1 ORDER BY updated_at DESC',
				[workspacePath]
			);
		}
		return await this.all(
			'SELECT * FROM workspace_sessions WHERE workspace_path = ? ORDER BY updated_at DESC',
			[workspacePath]
		);
	}

	async getAllSessions(pinnedOnly = true) {
		if (pinnedOnly) {
			return await this.all(
				'SELECT * FROM workspace_sessions WHERE pinned = 1 ORDER BY updated_at DESC'
			);
		}
		return await this.all('SELECT * FROM workspace_sessions ORDER BY updated_at DESC');
	}

	async removeWorkspaceSession(workspacePath, sessionId) {
		await this.run('DELETE FROM workspace_sessions WHERE workspace_path = ? AND id = ?', [
			workspacePath,
			sessionId
		]);
	}

	async renameWorkspaceSession(workspacePath, sessionId, newTitle) {
		await this.run(
			'UPDATE workspace_sessions SET title = ?, updated_at = ? WHERE workspace_path = ? AND id = ?',
			[newTitle, Date.now(), workspacePath, sessionId]
		);
	}

	async updateWorkspaceSessionTypeId(workspacePath, sessionId, newTypeSpecificId) {
		await this.run(
			'UPDATE workspace_sessions SET type_specific_id = ?, updated_at = ? WHERE workspace_path = ? AND id = ?',
			[newTypeSpecificId, Date.now(), workspacePath, sessionId]
		);
	}

	async setWorkspaceSessionPinned(workspacePath, sessionId, pinned) {
		await this.run(
			'UPDATE workspace_sessions SET pinned = ?, updated_at = ? WHERE workspace_path = ? AND id = ?',
			[pinned ? 1 : 0, Date.now(), workspacePath, sessionId]
		);
	}

	// Terminal history methods
	async addTerminalHistory(terminalId, data) {
		await this.run('INSERT INTO terminal_history (terminal_id, data, timestamp) VALUES (?, ?, ?)', [
			terminalId,
			data,
			Date.now()
		]);
	}

	async getTerminalHistory(terminalId) {
		const rows = await this.all(
			'SELECT * FROM terminal_history WHERE terminal_id = ? ORDER BY timestamp ASC',
			[terminalId]
		);
		return rows.map((row) => row.data).join('');
	}

	async clearTerminalHistory(terminalId) {
		await this.run('DELETE FROM terminal_history WHERE terminal_id = ?', [terminalId]);
	}

	// Claude session methods
	async addClaudeSession(id, workspacePath, sessionId, appSessionId, resumeCapable) {
		const now = Date.now();
		await this.run(
			'INSERT OR REPLACE INTO claude_sessions (id, workspace_path, session_id, app_session_id, resume_capable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[id, workspacePath, sessionId, appSessionId, resumeCapable, now, now]
		);
	}

	async getClaudeSession(id) {
		return await this.get('SELECT * FROM claude_sessions WHERE id = ? OR app_session_id = ?', [
			id,
			id
		]);
	}

	async listClaudeSessions(workspacePath = null) {
		if (workspacePath) {
			return await this.all(
				'SELECT * FROM claude_sessions WHERE workspace_path = ? ORDER BY updated_at DESC',
				[workspacePath]
			);
		}
		return await this.all('SELECT * FROM claude_sessions ORDER BY updated_at DESC');
	}

	// Logging methods
	async addLog(level, component, message, data = null) {
		await this.run(
			'INSERT INTO logs (level, component, message, data, timestamp) VALUES (?, ?, ?, ?, ?)',
			[level, component, message, data ? JSON.stringify(data) : null, Date.now()]
		);
	}

	async getLogs(limit = 100, component = null, level = null) {
		let sql = 'SELECT * FROM logs';
		const params = [];
		const conditions = [];

		if (component) {
			conditions.push('component = ?');
			params.push(component);
		}
		if (level) {
			conditions.push('level = ?');
			params.push(level);
		}

		if (conditions.length > 0) {
			sql += ' WHERE ' + conditions.join(' AND ');
		}

		sql += ' ORDER BY timestamp DESC LIMIT ?';
		params.push(limit);

		const rows = await this.all(sql, params);
		return rows.map((row) => ({
			...row,
			data: row.data ? JSON.parse(row.data) : null
		}));
	}

	// Cleanup methods
	async cleanupOldData(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
		// 7 days default
		const cutoff = Date.now() - maxAgeMs;

		// Clean up old session history
		const historyResult = await this.run('DELETE FROM session_history WHERE timestamp < ?', [
			cutoff
		]);

		// Clean up old logs
		const logsResult = await this.run('DELETE FROM logs WHERE timestamp < ?', [cutoff]);

		// Clean up old terminal history
		const terminalResult = await this.run('DELETE FROM terminal_history WHERE timestamp < ?', [
			cutoff
		]);

		logger.info(
			'DATABASE',
			`Cleanup completed: ${historyResult.changes} history entries, ${logsResult.changes} logs, ${terminalResult.changes} terminal history entries removed`
		);
	}
}

// Export singleton instance
export const databaseManager = new DatabaseManager();
