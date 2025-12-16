#!/usr/bin/env node
/**
 * Migration Runner
 *
 * Executes database migrations for Dispatch.
 * Run with: node src/lib/server/database/migrations/run-migration.js
 *
 * @file Database migration execution utility
 */

import { DatabaseManager } from '../DatabaseManager.js';
import { logger } from '../../shared/utils/logger.js';

// Available migrations
const MIGRATIONS = [];

/**
 * Run all pending migrations
 */
async function runMigrations() {
	const db = new DatabaseManager();

	try {
		// Initialize database
		await db.init();
		logger.info('MIGRATION', 'Database initialized');

		// Create migrations tracking table if it doesn't exist
		await db.run(`
			CREATE TABLE IF NOT EXISTS migrations (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				executed_at INTEGER NOT NULL
			)
		`);

		// Get executed migrations
		const executed = await db.all('SELECT id FROM migrations');
		const executedIds = new Set(executed.map((m) => m.id));

		// Run pending migrations
		for (const migration of MIGRATIONS) {
			if (executedIds.has(migration.id)) {
				logger.info('MIGRATION', `Skipping ${migration.id} (already executed)`);
				continue;
			}

			logger.info('MIGRATION', `Running ${migration.id}: ${migration.description}`);

			try {
				// Execute migration
				await migration.up(db);

				// Record migration
				await db.run('INSERT INTO migrations (id, name, executed_at) VALUES (?, ?, ?)', [
					migration.id,
					migration.name,
					Date.now()
				]);

				logger.info('MIGRATION', `✓ ${migration.id} completed successfully`);
			} catch (error) {
				logger.error('MIGRATION', `✗ ${migration.id} failed:`, error);
				throw error;
			}
		}

		logger.info('MIGRATION', 'All migrations completed');
	} catch (error) {
		logger.error('MIGRATION', 'Migration failed:', error);
		process.exit(1);
	} finally {
		await db.close();
	}
}

// Run migrations if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runMigrations();
}

export { runMigrations };
