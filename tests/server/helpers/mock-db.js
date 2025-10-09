/**
 * Mock Database Helper
 * @file Provides in-memory SQLite database for tests
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Create in-memory SQLite database with schema
 * @returns {Database} In-memory database instance
 */
export function createTestDatabase() {
	const db = new Database(':memory:');

	// Load schema from migrations
	const schemaPath = join(process.cwd(), 'src/lib/server/database/schema.sql');
	try {
		const schema = readFileSync(schemaPath, 'utf-8');
		db.exec(schema);
	} catch (err) {
		// Fallback: create basic schema for tests
		db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				kind TEXT NOT NULL,
				workspace_path TEXT NOT NULL,
				status TEXT DEFAULT 'active',
				metadata TEXT,
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS session_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_id TEXT NOT NULL,
				seq INTEGER NOT NULL,
				type TEXT NOT NULL,
				payload TEXT,
				timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(session_id, seq)
			);

			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS workspaces (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				status TEXT DEFAULT 'active',
				created_at TEXT DEFAULT CURRENT_TIMESTAMP,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
				last_active TEXT
			);

			CREATE TABLE IF NOT EXISTS workspace_layout (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				client_id TEXT NOT NULL,
				workspace_path TEXT NOT NULL,
				layout_data TEXT NOT NULL,
				updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(client_id, workspace_path)
			);
		`);
	}

	return db;
}

/**
 * Mock DatabaseManager for tests
 */
export class MockDatabaseManager {
	#db;

	constructor() {
		this.#db = createTestDatabase();
	}

	get db() {
		return this.#db;
	}

	prepare(sql) {
		return this.#db.prepare(sql);
	}

	transaction(fn) {
		return this.#db.transaction(fn);
	}

	close() {
		this.#db.close();
	}

	// Helper method for tests to clean up
	reset() {
		this.#db.exec(`
			DELETE FROM sessions;
			DELETE FROM session_events;
			DELETE FROM settings;
			DELETE FROM workspaces;
			DELETE FROM workspace_layout;
		`);
	}
}
