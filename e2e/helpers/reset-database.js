/**
 * Database Reset Helper for E2E Tests
 *
 * Provides utilities to reset the test database to a clean state.
 * This helper works with the test server running on http://127.0.0.1:7173
 *
 * Usage in tests:
 *
 * ```javascript
 * import { resetDatabase } from './helpers/reset-database.js';
 *
 * test.beforeEach(async ({ request }) => {
 *   await resetDatabase(request);
 * });
 * ```
 */

import Database from 'better-sqlite3';
import { existsSync, rmSync } from 'fs';

/**
 * Get the test database path
 * The test server uses fixed /tmp directories for isolation
 */
function getTestDatabasePath() {
	const dbPath = '/tmp/dispatch-test-home/.dispatch/data/workspace.db';
	return dbPath;
}

/**
 * Reset database to fresh install state
 *
 * This function:
 * - Deletes ALL data from all tables
 * - Resets onboarding state
 * - Re-initializes default settings
 *
 * @param {Object} options - Reset options
 * @param {boolean} options.deleteFile - If true, delete the entire database file (default: false)
 * @param {boolean} options.seedData - If true, create default user and API key (default: false)
 * @param {boolean} options.onboarded - If true, mark onboarding as complete (default: false)
 * @returns {Promise<Object>} Reset result with state information
 */
export async function resetDatabase(options = {}) {
	const { deleteFile = false, seedData = false, onboarded = false } = options;

	const dbPath = getTestDatabasePath();

	console.log('[resetDatabase] Starting database reset...');
	console.log('[resetDatabase] Database path:', dbPath);

	// Option 1: Delete the entire database file and let the server recreate it
	if (deleteFile) {
		if (existsSync(dbPath)) {
			console.log('[resetDatabase] Deleting database file...');
			rmSync(dbPath, { force: true });
			console.log('[resetDatabase] ✓ Database file deleted');
		}

		// Wait a moment for the server to recreate the database
		await new Promise((resolve) => setTimeout(resolve, 500));

		console.log('[resetDatabase] ✅ Database reset complete (file deleted)');
		return {
			success: true,
			method: 'file-delete',
			onboarding_complete: false
		};
	}

	// Option 2: Clear all data from tables (faster, preserves schema)
	try {
		if (!existsSync(dbPath)) {
			throw new Error(`Database file not found at ${dbPath}`);
		}

		const db = new Database(dbPath);

		console.log('[resetDatabase] Clearing all data from tables...');

		// Delete all data from tables (in correct order due to foreign keys)
		db.prepare('DELETE FROM session_events').run();
		db.prepare('DELETE FROM workspace_layout').run();
		db.prepare('DELETE FROM sessions').run();
		db.prepare('DELETE FROM auth_api_keys').run();
		db.prepare('DELETE FROM auth_sessions').run();
		db.prepare('DELETE FROM auth_users').run();
		db.prepare('DELETE FROM workspaces').run();
		db.prepare('DELETE FROM logs').run();
		db.prepare('DELETE FROM settings').run();

		// Check if user_preferences table exists (may not in older schemas)
		try {
			db.prepare('DELETE FROM user_preferences').run();
		} catch (_err) {
			// Table doesn't exist, ignore
		}

		console.log('[resetDatabase] ✓ All data deleted');

		// Re-initialize default settings
		console.log('[resetDatabase] Reinitializing default settings...');

		const now = Date.now();

		// Global settings
		db.prepare(
			`INSERT INTO settings (category, settings_json, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`
		).run('global', JSON.stringify({ theme: 'retro' }), 'Global application settings', now, now);

		// Claude settings
		db.prepare(
			`INSERT INTO settings (category, settings_json, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`
		).run(
			'claude',
			JSON.stringify({
				model: 'claude-3-5-sonnet-20241022',
				permissionMode: 'default',
				executable: 'auto',
				maxTurns: null,
				includePartialMessages: false,
				continueConversation: false
			}),
			'Default Claude session settings',
			now,
			now
		);

		// Workspace settings
		db.prepare(
			`INSERT INTO settings (category, settings_json, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`
		).run(
			'workspace',
			JSON.stringify({ envVariables: {} }),
			'Workspace-level environment variables for all sessions',
			now,
			now
		);

		// System settings (with onboarding state)
		db.prepare(
			`INSERT INTO settings (category, settings_json, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`
		).run(
			'system',
			JSON.stringify({ onboarding_complete: onboarded }),
			'System-level settings',
			now,
			now
		);

		console.log('[resetDatabase] ✓ Default settings initialized');
		console.log('[resetDatabase] ✓ Onboarding set to:', onboarded ? 'complete' : 'incomplete');

		// Seed with default data if requested
		let apiKey = null;
		if (seedData) {
			console.log('[resetDatabase] Seeding database with default data...');

			// Create default user
			db.prepare(
				`INSERT INTO auth_users (user_id, email, name, created_at, last_login)
				 VALUES (?, ?, ?, ?, ?)`
			).run('default', null, 'Test User', now, now);

			// Create default API key (hashed)
			// Using bcrypt synchronously for simplicity in tests
			const bcrypt = await import('bcrypt');
			const plainKey = 'test-api-key-' + Math.random().toString(36).substring(2, 15);
			const keyHash = bcrypt.hashSync(plainKey, 12);

			const keyId = Math.random().toString(36).substring(2, 15);
			db.prepare(
				`INSERT INTO auth_api_keys (id, user_id, key_hash, label, created_at, last_used_at, disabled)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			).run(keyId, 'default', keyHash, 'Test API Key', now, null, 0);

			apiKey = {
				id: keyId,
				key: plainKey,
				label: 'Test API Key'
			};

			console.log('[resetDatabase] ✓ Seeded with default user and API key');
		}

		// Get final state
		const usersCount = db.prepare('SELECT COUNT(*) as count FROM auth_users').get().count;
		const keysCount = db.prepare('SELECT COUNT(*) as count FROM auth_api_keys').get().count;
		const systemSettings = db
			.prepare('SELECT settings_json FROM settings WHERE category = ?')
			.get('system');
		const settings = JSON.parse(systemSettings.settings_json);

		db.close();

		console.log('[resetDatabase] ✅ Database reset complete', {
			onboarding_complete: settings.onboarding_complete || false,
			users: usersCount,
			api_keys: keysCount
		});

		return {
			success: true,
			method: 'data-clear',
			state: {
				onboarding_complete: settings.onboarding_complete || false,
				users: usersCount,
				api_keys: keysCount
			},
			...(apiKey && { apiKey })
		};
	} catch (error) {
		console.error('[resetDatabase] ✗ Failed to reset database:', error);
		throw new Error(`Database reset failed: ${error.message}`);
	}
}

/**
 * Reset database to fresh install (onboarding not complete)
 *
 * Quick helper for tests that need a clean slate.
 *
 * @returns {Promise<Object>} Reset result
 */
export async function resetToFreshInstall() {
	return resetDatabase({ onboarded: false, seedData: false });
}

/**
 * Reset database and complete onboarding with a test API key
 *
 * Quick helper for tests that need an authenticated state.
 *
 * @returns {Promise<Object>} Reset result with API key
 */
export async function resetToOnboarded() {
	return resetDatabase({ onboarded: true, seedData: true });
}

/**
 * Delete the entire database file
 *
 * Use this for a complete reset when schema changes are needed.
 *
 * @returns {Promise<Object>} Reset result
 */
export async function deleteDatabase() {
	return resetDatabase({ deleteFile: true });
}
