/**
 * Database Setup and Migration Utility for Settings
 * Clean recreation approach for single-user development environment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Initialize settings database with clean recreation
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Database} Initialized database instance
 */
export function initializeSettingsDatabase(dbPath) {
	const db = new Database(dbPath);

	// Read schema file
	const schemaPath = path.join(__dirname, 'schema.sql');
	const schema = fs.readFileSync(schemaPath, 'utf-8');

	// Execute schema (includes DROP IF EXISTS)
	db.exec(schema);

	return db;
}

/**
 * Backup existing database before recreation
 * @param {string} dbPath - Path to SQLite database file
 * @returns {string|null} Backup file path or null if no backup needed
 */
export function backupDatabase(dbPath) {
	if (!fs.existsSync(dbPath)) {
		return null; // No existing database to backup
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupPath = `${dbPath}.backup-${timestamp}`;

	fs.copyFileSync(dbPath, backupPath);
	console.log(`Database backed up to: ${backupPath}`);

	return backupPath;
}

/**
 * Restore database from backup
 * @param {string} dbPath - Target database path
 * @param {string} backupPath - Backup file path
 */
export function restoreDatabase(dbPath, backupPath) {
	if (!fs.existsSync(backupPath)) {
		throw new Error(`Backup file not found: ${backupPath}`);
	}

	fs.copyFileSync(backupPath, dbPath);
	console.log(`Database restored from: ${backupPath}`);
}

/**
 * Validate database schema and essential data
 * @param {Database} db - Database instance
 * @returns {boolean} True if valid
 */
export function validateSettingsSchema(db) {
	try {
		// Check tables exist
		const tables = db
			.prepare(
				`
			SELECT name FROM sqlite_master
			WHERE type='table' AND name IN ('settings_categories', 'configuration_settings')
		`
			)
			.all();

		if (tables.length !== 2) {
			return false;
		}

		// Check essential categories exist
		const categories = db
			.prepare(
				`
			SELECT COUNT(*) as count FROM settings_categories
		`
			)
			.get();

		if (categories.count < 4) {
			return false;
		}

		// Check essential settings exist
		const settings = db
			.prepare(
				`
			SELECT COUNT(*) as count FROM configuration_settings
		`
			)
			.get();

		if (settings.count < 8) {
			return false;
		}

		return true;
	} catch (error) {
		console.error('Schema validation error:', error);
		return false;
	}
}

export default {
	initializeSettingsDatabase,
	backupDatabase,
	restoreDatabase,
	validateSettingsSchema
};
