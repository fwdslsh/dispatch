import { Migration } from '../migrate.js';

/**
 * Migration to add retention_policies table for managing data retention settings
 */
export default new Migration(
	'002_retention_policies',
	'Add retention policies table',
	// Up migration - create table
	`CREATE TABLE IF NOT EXISTS retention_policies (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		session_retention_days INTEGER NOT NULL DEFAULT 30,
		log_retention_days INTEGER NOT NULL DEFAULT 7,
		auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
		last_cleanup_run TEXT,
		preview_summary TEXT,
		created_at TEXT DEFAULT CURRENT_TIMESTAMP,
		updated_at TEXT DEFAULT CURRENT_TIMESTAMP
	)`,
	// Down migration - drop table
	`DROP TABLE IF EXISTS retention_policies`
);