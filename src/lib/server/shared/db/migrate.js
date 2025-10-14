import { logger } from '../utils/logger.js';

/** @typedef {import('../../database/DatabaseManager.js').DatabaseManager} DatabaseManager */

/**
 * Database Migration System for Dispatch
 *
 * Provides formal migration runner for schema versioning in production environments.
 * Supports incremental schema changes, rollbacks, and migration tracking.
 */

/**
 * Migration class - represents a single database migration
 */
export class Migration {
	constructor(version, description, upSql, downSql) {
		this.version = version;
		this.description = description;
		this.upSql = upSql;
		this.downSql = downSql;
		this.appliedAt = null;
	}

	/**
	 * Apply the migration (run up script)
	 * @param {DatabaseManager} db - Database instance
	 */
	async up(db) {
		if (Array.isArray(this.upSql)) {
			for (const sql of this.upSql) {
				await db.run(sql);
			}
		} else {
			await db.run(this.upSql);
		}
		this.appliedAt = Date.now();
		logger.info('MIGRATION', `Applied migration ${this.version}: ${this.description}`);
	}

	/**
	 * Rollback the migration (run down script)
	 * @param {DatabaseManager} db - Database instance
	 */
	async down(db) {
		if (!this.downSql) {
			throw new Error(`Migration ${this.version} does not support rollback`);
		}

		if (Array.isArray(this.downSql)) {
			// Execute rollback statements in reverse order
			for (const sql of this.downSql.reverse()) {
				await db.run(sql);
			}
		} else {
			await db.run(this.downSql);
		}
		logger.info('MIGRATION', `Rolled back migration ${this.version}: ${this.description}`);
	}
}

/**
 * Migration Manager - handles migration execution and tracking
 */
export class MigrationManager {
	constructor(database) {
		this.db = database;
		this.migrations = [];
		this.isInitialized = false;
	}

	/**
	 * Initialize migration tracking table
	 */
	async init() {
		if (this.isInitialized) return;

		await this.db.init();

		// Create migration tracking table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS _migrations (
				version INTEGER PRIMARY KEY,
				description TEXT NOT NULL,
				applied_at INTEGER NOT NULL,
				checksum TEXT
			)
		`);

		this.isInitialized = true;
		logger.debug('MIGRATION', 'Migration manager initialized');
	}

	/**
	 * Register a migration
	 * @param {Migration} migration - Migration to register
	 */
	registerMigration(migration) {
		this.migrations.push(migration);
		this.migrations.sort((a, b) => a.version - b.version);
		logger.debug(
			'MIGRATION',
			`Registered migration ${migration.version}: ${migration.description}`
		);
	}

	/**
	 * Get list of applied migrations
	 * @returns {Promise<Array>} List of applied migration records
	 */
	async getAppliedMigrations() {
		await this.init();
		return await this.db.all('SELECT * FROM _migrations ORDER BY version ASC');
	}

	/**
	 * Get list of pending migrations
	 * @returns {Promise<Array>} List of pending migrations
	 */
	async getPendingMigrations() {
		const applied = await this.getAppliedMigrations();
		const appliedVersions = new Set(applied.map((m) => m.version));

		return this.migrations.filter((m) => !appliedVersions.has(m.version));
	}

	/**
	 * Get current schema version
	 * @returns {Promise<number>} Current schema version (0 if no migrations applied)
	 */
	async getCurrentVersion() {
		const applied = await this.getAppliedMigrations();
		return applied.length > 0 ? Math.max(...applied.map((m) => m.version)) : 0;
	}

	/**
	 * Check if migration is applied
	 * @param {number} version - Migration version to check
	 * @returns {Promise<boolean>} True if migration is applied
	 */
	async isMigrationApplied(version) {
		const migration = await this.db.get('SELECT version FROM _migrations WHERE version = ?', [
			version
		]);
		return !!migration;
	}

	/**
	 * Apply a single migration
	 * @param {Migration} migration - Migration to apply
	 */
	async applyMigration(migration) {
		await this.init();

		// Check if already applied
		if (await this.isMigrationApplied(migration.version)) {
			logger.warn('MIGRATION', `Migration ${migration.version} already applied, skipping`);
			return;
		}

		const startTime = Date.now();

		try {
			// Apply the migration
			await migration.up(this.db);

			// Record in migration table
			await this.db.run(
				'INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)',
				[migration.version, migration.description, Date.now()]
			);

			const duration = Date.now() - startTime;
			logger.info(
				'MIGRATION',
				`Migration ${migration.version} applied successfully in ${duration}ms`
			);
		} catch (error) {
			logger.error('MIGRATION', `Failed to apply migration ${migration.version}:`, error);
			throw error;
		}
	}

	/**
	 * Rollback a single migration
	 * @param {number} version - Migration version to rollback
	 */
	async rollbackMigration(version) {
		await this.init();

		// Check if migration is applied
		if (!(await this.isMigrationApplied(version))) {
			logger.warn('MIGRATION', `Migration ${version} not applied, nothing to rollback`);
			return;
		}

		// Find the migration
		const migration = this.migrations.find((m) => m.version === version);
		if (!migration) {
			throw new Error(`Migration ${version} not found in registered migrations`);
		}

		const startTime = Date.now();

		try {
			// Rollback the migration
			await migration.down(this.db);

			// Remove from migration table
			await this.db.run('DELETE FROM _migrations WHERE version = ?', [version]);

			const duration = Date.now() - startTime;
			logger.info('MIGRATION', `Migration ${version} rolled back successfully in ${duration}ms`);
		} catch (error) {
			logger.error('MIGRATION', `Failed to rollback migration ${version}:`, error);
			throw error;
		}
	}

	/**
	 * Apply all pending migrations
	 * @param {Object} [options] - Migration options
	 * @param {number} [options.targetVersion] - Target version to migrate to
	 * @param {boolean} [options.dryRun=false] - Only show what would be applied
	 * @returns {Promise<Object>} Migration results
	 */
	async migrate(options = {}) {
		const { targetVersion, dryRun = false } = options;

		await this.init();

		const pending = await this.getPendingMigrations();
		let migrationsToApply = pending;

		// Filter by target version if specified
		if (targetVersion !== undefined) {
			migrationsToApply = pending.filter((m) => m.version <= targetVersion);
		}

		if (migrationsToApply.length === 0) {
			logger.info('MIGRATION', 'No pending migrations to apply');
			return { applied: [], skipped: 0 };
		}

		if (dryRun) {
			logger.info('MIGRATION', `Would apply ${migrationsToApply.length} migrations:`);
			migrationsToApply.forEach((m) => {
				logger.info('MIGRATION', `  ${m.version}: ${m.description}`);
			});
			return { applied: [], skipped: migrationsToApply.length, dryRun: true };
		}

		const applied = [];
		const startTime = Date.now();

		try {
			for (const migration of migrationsToApply) {
				await this.applyMigration(migration);
				applied.push(migration);
			}

			const duration = Date.now() - startTime;
			logger.info('MIGRATION', `Applied ${applied.length} migrations in ${duration}ms`);

			return { applied, skipped: 0, duration };
		} catch (error) {
			logger.error(
				'MIGRATION',
				`Migration failed after applying ${applied.length} migrations:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Rollback to a specific version
	 * @param {number} targetVersion - Version to rollback to
	 * @param {boolean} [dryRun=false] - Only show what would be rolled back
	 * @returns {Promise<Object>} Rollback results
	 */
	async rollbackTo(targetVersion, dryRun = false) {
		await this.init();

		const applied = await this.getAppliedMigrations();
		const migrationsToRollback = applied
			.filter((m) => m.version > targetVersion)
			.sort((a, b) => b.version - a.version); // Rollback in reverse order

		if (migrationsToRollback.length === 0) {
			logger.info('MIGRATION', `Already at or below target version ${targetVersion}`);
			return { rolledBack: [], skipped: 0 };
		}

		if (dryRun) {
			logger.info('MIGRATION', `Would rollback ${migrationsToRollback.length} migrations:`);
			migrationsToRollback.forEach((m) => {
				logger.info('MIGRATION', `  ${m.version}: ${m.description}`);
			});
			return { rolledBack: [], skipped: migrationsToRollback.length, dryRun: true };
		}

		const rolledBack = [];
		const startTime = Date.now();

		try {
			for (const migrationRecord of migrationsToRollback) {
				await this.rollbackMigration(migrationRecord.version);
				rolledBack.push(migrationRecord);
			}

			const duration = Date.now() - startTime;
			logger.info('MIGRATION', `Rolled back ${rolledBack.length} migrations in ${duration}ms`);

			return { rolledBack, skipped: 0, duration };
		} catch (error) {
			logger.error(
				'MIGRATION',
				`Rollback failed after processing ${rolledBack.length} migrations:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Get migration status information
	 * @returns {Promise<Object>} Migration status
	 */
	async getStatus() {
		await this.init();

		const applied = await this.getAppliedMigrations();
		const pending = await this.getPendingMigrations();
		const currentVersion = await this.getCurrentVersion();

		return {
			currentVersion,
			appliedMigrations: applied.length,
			pendingMigrations: pending.length,
			totalMigrations: this.migrations.length,
			applied: applied.map((m) => ({
				version: m.version,
				description: m.description,
				appliedAt: new Date(m.applied_at).toISOString()
			})),
			pending: pending.map((m) => ({
				version: m.version,
				description: m.description
			}))
		};
	}

	/**
	 * Validate migration consistency
	 * @returns {Promise<Object>} Validation results
	 */
	async validate() {
		await this.init();

		const issues = [];
		const warnings = [];

		// Check for duplicate versions
		const versions = this.migrations.map((m) => m.version);
		const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
		if (duplicates.length > 0) {
			issues.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
		}

		// Check for gaps in version sequence
		const sortedVersions = [...new Set(versions)].sort((a, b) => a - b);
		for (let i = 1; i < sortedVersions.length; i++) {
			if (sortedVersions[i] - sortedVersions[i - 1] > 1) {
				warnings.push(
					`Gap in migration versions: ${sortedVersions[i - 1]} -> ${sortedVersions[i]}`
				);
			}
		}

		// Check that all applied migrations are still registered
		const applied = await this.getAppliedMigrations();
		const registeredVersions = new Set(versions);
		for (const appliedMigration of applied) {
			if (!registeredVersions.has(appliedMigration.version)) {
				issues.push(
					`Applied migration ${appliedMigration.version} not found in registered migrations`
				);
			}
		}

		return {
			valid: issues.length === 0,
			issues,
			warnings
		};
	}

	/**
	 * Reset migration state (dangerous - for development only)
	 * @param {boolean} confirm - Must be true to proceed
	 */
	async reset(confirm = false) {
		if (!confirm) {
			throw new Error('Migration reset requires explicit confirmation');
		}

		await this.init();

		logger.warn('MIGRATION', 'RESETTING ALL MIGRATION STATE - THIS IS DANGEROUS');

		// Drop migration tracking table
		await this.db.run('DROP TABLE IF EXISTS _migrations');

		// Recreate empty migration table
		await this.db.run(`
			CREATE TABLE _migrations (
				version INTEGER PRIMARY KEY,
				description TEXT NOT NULL,
				applied_at INTEGER NOT NULL,
				checksum TEXT
			)
		`);

		logger.warn('MIGRATION', 'Migration state reset complete');
	}
}

/**
 * Create and configure migration manager with default migrations
 * @param {DatabaseManager} database - Database instance
 * @returns {MigrationManager} Configured migration manager
 */
export function createMigrationManager(database) {
	const manager = new MigrationManager(database);

	// Register initial schema migration (version 1)
	manager.registerMigration(
		new Migration(
			1,
			'Initial schema - sessions, events, workspaces, logs, settings',
			[
				// Sessions table
				`CREATE TABLE IF NOT EXISTS sessions (
				run_id TEXT PRIMARY KEY,
				owner_user_id TEXT,
				kind TEXT NOT NULL,
				status TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				meta_json TEXT NOT NULL
			)`,

				// Session events table
				`CREATE TABLE IF NOT EXISTS session_events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				seq INTEGER NOT NULL,
				channel TEXT NOT NULL,
				type TEXT NOT NULL,
				payload BLOB NOT NULL,
				ts INTEGER NOT NULL,
				FOREIGN KEY (run_id) REFERENCES sessions(run_id)
			)`,

				// Workspace layout table
				`CREATE TABLE IF NOT EXISTS workspace_layout (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				run_id TEXT NOT NULL,
				client_id TEXT NOT NULL,
				tile_id TEXT NOT NULL,
				created_at INTEGER,
				updated_at INTEGER,
				UNIQUE(run_id, client_id)
			)`,

				// Workspaces table
				`CREATE TABLE IF NOT EXISTS workspaces (
				path TEXT PRIMARY KEY,
				last_active INTEGER,
				created_at INTEGER,
				updated_at INTEGER
			)`,

				// Logs table
				`CREATE TABLE IF NOT EXISTS logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				level TEXT,
				component TEXT,
				message TEXT,
				data TEXT,
				timestamp INTEGER
			)`,

				// Settings table
				`CREATE TABLE IF NOT EXISTS settings (
				category TEXT PRIMARY KEY,
				settings_json TEXT NOT NULL,
				description TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)`,

				// Indexes
				'CREATE UNIQUE INDEX IF NOT EXISTS ix_events_run_seq ON session_events(run_id, seq)',
				'CREATE INDEX IF NOT EXISTS ix_events_run_ts ON session_events(run_id, ts)',
				'CREATE INDEX IF NOT EXISTS ix_sessions_kind ON sessions(kind)',
				'CREATE INDEX IF NOT EXISTS ix_sessions_status ON sessions(status)',
				'CREATE INDEX IF NOT EXISTS ix_workspace_layout_client ON workspace_layout(client_id)',
				'CREATE INDEX IF NOT EXISTS ix_logs_timestamp ON logs(timestamp)'
			],
			[
				// Rollback: Drop all tables and indexes
				'DROP INDEX IF EXISTS ix_logs_timestamp',
				'DROP INDEX IF EXISTS ix_workspace_layout_client',
				'DROP INDEX IF EXISTS ix_sessions_status',
				'DROP INDEX IF EXISTS ix_sessions_kind',
				'DROP INDEX IF EXISTS ix_events_run_ts',
				'DROP INDEX IF EXISTS ix_events_run_seq',
				'DROP TABLE IF EXISTS settings',
				'DROP TABLE IF EXISTS logs',
				'DROP TABLE IF EXISTS workspaces',
				'DROP TABLE IF EXISTS workspace_layout',
				'DROP TABLE IF EXISTS session_events',
				'DROP TABLE IF EXISTS sessions'
			]
		)
	);

	// Migration 2: Cookie-based authentication system
	manager.registerMigration(
		new Migration(
			2,
			'Cookie-based authentication - sessions, API keys, users',
			[
				// Create auth_users table
				`CREATE TABLE IF NOT EXISTS auth_users (
					user_id TEXT PRIMARY KEY,
					email TEXT UNIQUE,
					name TEXT,
					created_at INTEGER NOT NULL,
					last_login INTEGER
				)`,

				// Create auth_sessions table
				`CREATE TABLE auth_sessions (
					id TEXT PRIMARY KEY,
					user_id TEXT NOT NULL,
					provider TEXT NOT NULL CHECK (provider IN ('api_key', 'oauth_github', 'oauth_google')),
					expires_at INTEGER NOT NULL,
					created_at INTEGER NOT NULL,
					last_active_at INTEGER NOT NULL,
					FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
				)`,

				// Create auth_api_keys table
				`CREATE TABLE auth_api_keys (
					id TEXT PRIMARY KEY,
					user_id TEXT NOT NULL,
					key_hash TEXT NOT NULL,
					label TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					last_used_at INTEGER,
					disabled INTEGER DEFAULT 0,
					FOREIGN KEY (user_id) REFERENCES auth_users(user_id)
				)`,

				// Create indexes for auth_sessions
				'CREATE INDEX ix_sessions_user_id ON auth_sessions(user_id)',
				'CREATE INDEX ix_sessions_expires_at ON auth_sessions(expires_at)',

				// Create indexes for auth_api_keys
				'CREATE INDEX ix_api_keys_user_id ON auth_api_keys(user_id)',
				'CREATE INDEX ix_api_keys_disabled ON auth_api_keys(disabled)'
			],
			[
				// Rollback: Drop indexes and tables in reverse order
				'DROP INDEX IF EXISTS ix_api_keys_disabled',
				'DROP INDEX IF EXISTS ix_api_keys_user_id',
				'DROP INDEX IF EXISTS ix_sessions_expires_at',
				'DROP INDEX IF EXISTS ix_sessions_user_id',
				'DROP TABLE IF EXISTS auth_api_keys',
				'DROP TABLE IF EXISTS auth_sessions',
				'DROP TABLE IF EXISTS auth_users'
			]
		)
	);

	// Future migrations can be added here as new Migration instances
	// Example:
	// manager.registerMigration(new Migration(
	//     3,
	//     'Add workspace templates table',
	//     'CREATE TABLE workspace_templates (...)',
	//     'DROP TABLE workspace_templates'
	// ));

	return manager;
}
