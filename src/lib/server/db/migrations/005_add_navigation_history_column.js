import { Migration } from '../migrate.js';

/**
 * Migration to add navigation_history column to workspace_layout table
 */
export default new Migration(
	'005_add_navigation_history_column',
	'Add navigation_history column to workspace_layout table',
	// Up migration - add column
	`ALTER TABLE workspace_layout ADD COLUMN navigation_history TEXT DEFAULT '[]'`,
	// Down migration - SQLite doesn't support DROP COLUMN directly
	// We would need to recreate the table without the column
	[
		`CREATE TABLE workspace_layout_backup AS SELECT
			id, run_id, client_id, tile_id, created_at, updated_at
		FROM workspace_layout`,
		`DROP TABLE workspace_layout`,
		`ALTER TABLE workspace_layout_backup RENAME TO workspace_layout`
	]
);
