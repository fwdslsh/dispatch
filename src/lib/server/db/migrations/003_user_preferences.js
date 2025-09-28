import { Migration } from '../migrate.js';

/**
 * Migration to add user_preferences table for storing user settings
 */
export default new Migration(
	'003_user_preferences',
	'Add user preferences table',
	// Up migration - create table
	`CREATE TABLE IF NOT EXISTS user_preferences (
		user_id TEXT PRIMARY KEY,
		onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
		theme_preference TEXT NOT NULL DEFAULT 'auto',
		workspace_display_mode TEXT NOT NULL DEFAULT 'list',
		show_advanced_features BOOLEAN NOT NULL DEFAULT FALSE,
		session_auto_connect BOOLEAN NOT NULL DEFAULT TRUE,
		updated_at TEXT DEFAULT CURRENT_TIMESTAMP
	)`,
	// Down migration - drop table
	`DROP TABLE IF EXISTS user_preferences`
);