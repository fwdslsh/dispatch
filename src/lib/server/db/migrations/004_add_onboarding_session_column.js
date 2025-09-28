import { Migration } from '../migrate.js';

/**
 * Migration to add is_onboarding_session column to sessions table
 */
export default new Migration(
	'004_add_onboarding_session_column',
	'Add is_onboarding_session column to sessions table',
	// Up migration - add column
	`ALTER TABLE sessions ADD COLUMN is_onboarding_session BOOLEAN DEFAULT FALSE`,
	// Down migration - SQLite doesn't support DROP COLUMN directly
	// We would need to recreate the table without the column
	[
		`CREATE TABLE sessions_backup AS SELECT
			run_id, owner_user_id, kind, status, created_at, updated_at, meta_json
		FROM sessions`,
		`DROP TABLE sessions`,
		`ALTER TABLE sessions_backup RENAME TO sessions`
	]
);
