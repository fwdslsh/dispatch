/**
 * DatabaseManager - Simplified database connection and schema management
 * @file Handles database connection, schema creation, and migration only
 * CRUD operations delegated to specialized repositories
 */

import sqlite3 from 'sqlite3';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../shared/utils/logger.js';

/**
 * Simplified DatabaseManager - connection and migrations only
 */
export class DatabaseManager {
	#db = null;
	#dbPath;
	#isInitialized = false;

	/**
	 * @param {Object} config - Configuration object
	 * @param {string} [config.dbPath] - Database file path
	 * @param {string} [config.HOME] - Home directory
	 */
	constructor(config = {}) {
		this.#dbPath =
			config.dbPath ||
			join(config.HOME || process.env.HOME || homedir(), '.dispatch', 'data', 'workspace.db');
	}

	/**
	 * Get database connection
	 * @returns {sqlite3.Database} Database connection
	 */
	get db() {
		if (!this.#db) {
			throw new Error('Database not initialized. Call init() first.');
		}
		return this.#db;
	}

	/**
	 * Get database path
	 * @returns {string} Database file path
	 */
	get dbPath() {
		return this.#dbPath;
	}

	/**
	 * Check if database is initialized
	 * @returns {boolean} Initialization status
	 */
	get isInitialized() {
		return this.#isInitialized;
	}

	/**
	 * Initialize database connection and create schema
	 * @returns {Promise<void>}
	 */
	async init() {
		if (this.#isInitialized) {
			return;
		}

		try {
			// Ensure directory exists
			await fs.mkdir(dirname(this.#dbPath), { recursive: true });

			// Create database connection
			this.#db = new sqlite3.Database(this.#dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

			// Configure database
			await this.#configure();

			// Create schema
			await this.#createSchema();

			this.#isInitialized = true;
			logger.info('DATABASE', `Initialized at: ${this.#dbPath}`);
		} catch (error) {
			logger.error('DATABASE', 'Initialization failed:', error);
			throw error;
		}
	}

	/**
	 * Configure database settings
	 */
	async #configure() {
		// Enable WAL mode for better concurrent access
		await this.run('PRAGMA journal_mode=WAL');
		// Enable foreign keys
		await this.run('PRAGMA foreign_keys=ON');
		// Set busy timeout to 5 seconds
		await this.run('PRAGMA busy_timeout=5000');
	}

	/**
	 * Create database schema
	 */
	async #createSchema() {
		// Sessions table (unified session architecture)
		await this.run(`
			CREATE TABLE IF NOT EXISTS sessions (
				run_id TEXT PRIMARY KEY,
				owner_user_id TEXT,
				kind TEXT NOT NULL,
				status TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				meta_json TEXT NOT NULL
			)
		`);

		// Session events table (append-only event log)
		await this.run(`
			CREATE TABLE IF NOT EXISTS session_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				seq INTEGER NOT NULL,
				channel TEXT NOT NULL,
				type TEXT NOT NULL,
				payload BLOB NOT NULL,
				ts INTEGER NOT NULL,
				FOREIGN KEY (run_id) REFERENCES sessions(run_id)
			)
		`);

		// Workspace layout table
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspace_layout (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				client_id TEXT NOT NULL,
				tile_id TEXT NOT NULL,
				created_at INTEGER,
				updated_at INTEGER,
				UNIQUE(run_id, client_id)
			)
		`);

		// Workspaces table
		await this.run(`
			CREATE TABLE IF NOT EXISTS workspaces (
				path TEXT PRIMARY KEY,
				name TEXT,
				theme_override TEXT DEFAULT NULL,
				last_active INTEGER,
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
				data TEXT,
				timestamp INTEGER
			)
		`);

		// Settings table (JSON objects per category)
		await this.run(`
			CREATE TABLE IF NOT EXISTS settings (
				category TEXT PRIMARY KEY,
				settings_json TEXT NOT NULL,
				description TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		// Create indexes
		await this.#createIndexes();
	}

	/**
	 * Create database indexes
	 */
	async #createIndexes() {
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
	}

	/**
	 * Execute SQL statement (promise wrapper)
	 * @param {string} sql - SQL statement
	 * @param {Array} [params=[]] - Query parameters
	 * @param {number} [retries=3] - Number of retry attempts
	 * @returns {Promise<{lastID: number, changes: number}>}
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
					await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
					continue;
				}
				throw err;
			}
		}
	}

	/**
	 * Get single row (promise wrapper)
	 * @param {string} sql - SQL query
	 * @param {Array} [params=[]] - Query parameters
	 * @param {number} [retries=3] - Number of retry attempts
	 * @returns {Promise<Object|undefined>}
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
	 * Get all rows (promise wrapper)
	 * @param {string} sql - SQL query
	 * @param {Array} [params=[]] - Query parameters
	 * @param {number} [retries=3] - Number of retry attempts
	 * @returns {Promise<Array>}
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
	 * Create transaction wrapper (for middleware use)
	 * @param {Function} fn - Function to execute in transaction
	 * @returns {Function} Transaction executor
	 */
	transaction(fn) {
		return async () => {
			await this.run('BEGIN TRANSACTION');
			try {
				const result = await fn();
				await this.run('COMMIT');
				return result;
			} catch (err) {
				await this.run('ROLLBACK');
				throw err;
			}
		};
	}

	/**
	 * Close database connection
	 * @returns {Promise<void>}
	 */
	close() {
		return new Promise((resolve, reject) => {
			if (!this.#db) {
				resolve();
				return;
			}
			this.#db.close((err) => {
				if (err) reject(err);
				else {
					this.#db = null;
					this.#isInitialized = false;
					resolve();
				}
			});
		});
	}
}
