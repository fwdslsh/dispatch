import { Migration } from '../migrate.js';

/**
 * Migration to add onboarding_state table for tracking user onboarding progress
 */
export default new Migration(
	'001_onboarding_state',
	'Add onboarding state tracking table',
	// Up migration - create table
	`CREATE TABLE IF NOT EXISTS onboarding_state (
		user_id TEXT PRIMARY KEY,
		current_step TEXT NOT NULL DEFAULT 'auth',
		completed_steps TEXT NOT NULL DEFAULT '[]', -- JSON array
		is_complete BOOLEAN NOT NULL DEFAULT FALSE,
		first_workspace_id TEXT,
		created_at TEXT DEFAULT CURRENT_TIMESTAMP,
		completed_at TEXT,
		FOREIGN KEY (first_workspace_id) REFERENCES workspaces(path)
	)`,
	// Down migration - drop table
	`DROP TABLE IF EXISTS onboarding_state`
);