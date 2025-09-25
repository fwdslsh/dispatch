/**
 * @file Database Migration Component Identification Tests
 * Tests to identify all migration-related database tables, columns, and configuration.
 * These tests will be removed in Task 6 after cleanup is complete.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from '../../../src/lib/server/shared/db/DatabaseManager.js';
import { tmpdir } from 'os';

const PROJECT_ROOT = process.cwd();

describe('Database Migration Component Identification', () => {
	let testDb;
	let dbManager;

	beforeAll(async () => {
		// Create a temporary database for testing
		const testDbPath = join(tmpdir(), `test-migration-db-${Date.now()}.db`);
		dbManager = new DatabaseManager(testDbPath);
		await dbManager.init();
		testDb = dbManager.db;
	});

	afterAll(async () => {
		if (dbManager && dbManager.db) {
			await dbManager.close();
		}
	});

	it('should identify migration-related database tables', async () => {
		// Query for all tables in the database
		const tablesQuery = `
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
			ORDER BY name;
		`;

		const tables = await dbManager.all(tablesQuery);
		const migrationTables = [];

		// Check for migration-related table names
		const migrationTablePatterns = [
			/migration/i,
			/auth_migration/i,
			/terminal_key/i,
			/legacy_auth/i
		];

		tables.forEach((table) => {
			migrationTablePatterns.forEach((pattern) => {
				if (pattern.test(table.name)) {
					migrationTables.push({
						tableName: table.name,
						pattern: pattern.toString()
					});
				}
			});
		});

		// Log findings for documentation
		console.log('Migration-related tables found:', JSON.stringify(migrationTables, null, 2));

		// This test should initially pass if no migration tables exist, or fail showing what needs cleanup
		expect(migrationTables).toEqual([]);
	});

	it('should identify migration-related columns in existing tables', async () => {
		// Get schema information for all tables
		const tablesQuery = `
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
			ORDER BY name;
		`;

		const tables = await dbManager.all(tablesQuery);
		const migrationColumns = [];

		// Check each table for migration-related columns
		for (const table of tables) {
			const columnsQuery = `PRAGMA table_info(${table.name});`;
			const columns = await dbManager.all(columnsQuery);

			// Migration column patterns
			const migrationColumnPatterns = [
				/migration_status/i,
				/migration_complete/i,
				/migration_timestamp/i,
				/migration_data/i,
				/terminal_key/i,
				/legacy_/i,
				/migrated_/i,
				/migration_id/i
			];

			columns.forEach((column) => {
				migrationColumnPatterns.forEach((pattern) => {
					if (pattern.test(column.name)) {
						migrationColumns.push({
							tableName: table.name,
							columnName: column.name,
							columnType: column.type,
							pattern: pattern.toString()
						});
					}
				});
			});
		}

		// Log findings for documentation
		console.log('Migration-related columns found:', JSON.stringify(migrationColumns, null, 2));

		// This test should pass if no migration columns exist
		expect(migrationColumns).toEqual([]);
	});

	it('should verify no foreign key dependencies exist for migration data', async () => {
		// Get all foreign key constraints
		const tablesQuery = `
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
			ORDER BY name;
		`;

		const tables = await dbManager.all(tablesQuery);
		const migrationForeignKeys = [];

		for (const table of tables) {
			const foreignKeysQuery = `PRAGMA foreign_key_list(${table.name});`;
			const foreignKeys = await dbManager.all(foreignKeysQuery);

			// Check for foreign keys referencing migration tables
			const migrationFKPatterns = [
				/migration/i,
				/auth_migration/i,
				/terminal_key/i,
				/legacy_auth/i
			];

			foreignKeys.forEach((fk) => {
				migrationFKPatterns.forEach((pattern) => {
					if (pattern.test(fk.table) || pattern.test(fk.from) || pattern.test(fk.to)) {
						migrationForeignKeys.push({
							fromTable: table.name,
							fromColumn: fk.from,
							toTable: fk.table,
							toColumn: fk.to,
							pattern: pattern.toString()
						});
					}
				});
			});
		}

		// Log findings for documentation
		console.log(
			'Migration-related foreign keys found:',
			JSON.stringify(migrationForeignKeys, null, 2)
		);

		// This test should pass if no migration foreign keys exist
		expect(migrationForeignKeys).toEqual([]);
	});

	it('should identify migration-related system settings', async () => {
		// Check if there's a settings or configuration table
		const tablesQuery = `
			SELECT name FROM sqlite_master
			WHERE type='table' AND name LIKE '%setting%' OR name LIKE '%config%'
			ORDER BY name;
		`;

		const configTables = await dbManager.all(tablesQuery);
		const migrationSettings = [];

		for (const table of configTables) {
			try {
				// Get all rows from settings/config tables
				const settingsQuery = `SELECT * FROM ${table.name}`;
				const settings = await dbManager.all(settingsQuery);

				// Migration setting patterns
				const migrationSettingPatterns = [
					/migration/i,
					/terminal_key/i,
					/auth_migration/i,
					/legacy_auth/i,
					/migrate_/i
				];

				settings.forEach((setting) => {
					// Check all columns for migration-related content
					Object.entries(setting).forEach(([key, value]) => {
						migrationSettingPatterns.forEach((pattern) => {
							if (pattern.test(key) || (value && pattern.test(String(value)))) {
								migrationSettings.push({
									table: table.name,
									key,
									value,
									pattern: pattern.toString()
								});
							}
						});
					});
				});
			} catch (error) {
				// Table might not exist or be accessible, which is fine
			}
		}

		// Log findings for documentation
		console.log('Migration-related settings found:', JSON.stringify(migrationSettings, null, 2));

		// This test should pass if no migration settings exist
		expect(migrationSettings).toEqual([]);
	});

	it('should verify database schema integrity without migration components', async () => {
		// Test that core authentication tables exist and have proper structure
		const coreAuthTables = [
			'users',
			'user_devices',
			'auth_sessions',
			'webauthn_credentials',
			'oauth_accounts',
			'auth_events'
		];

		const missingTables = [];
		const tableSchemas = {};

		for (const tableName of coreAuthTables) {
			const tableExistsQuery = `
				SELECT name FROM sqlite_master
				WHERE type='table' AND name='${tableName}';
			`;
			const tableExists = await dbManager.get(tableExistsQuery);

			if (!tableExists) {
				missingTables.push(tableName);
			} else {
				// Get table schema
				const schemaQuery = `PRAGMA table_info(${tableName});`;
				const schema = await dbManager.all(schemaQuery);
				tableSchemas[tableName] = schema.map((col) => ({
					name: col.name,
					type: col.type,
					notNull: col.notnull === 1,
					primaryKey: col.pk === 1
				}));
			}
		}

		// Log findings for documentation
		console.log('Core auth table schemas:', JSON.stringify(tableSchemas, null, 2));
		if (missingTables.length > 0) {
			console.log('Missing core auth tables:', missingTables);
		}

		// All core auth tables should exist
		expect(missingTables).toEqual([]);

		// Verify essential columns exist in core tables
		expect(tableSchemas.users).toBeDefined();
		expect(tableSchemas.auth_sessions).toBeDefined();
	});

	it('should identify migration-related Docker and configuration files', () => {
		// Check configuration files for migration-related content
		const configFiles = [
			'docker-compose.yml',
			'docker-compose.dev.yml',
			'Dockerfile',
			'.env.example',
			'package.json'
		];

		const migrationConfigRefs = [];

		configFiles.forEach((fileName) => {
			const filePath = join(PROJECT_ROOT, fileName);
			if (existsSync(filePath)) {
				const content = readFileSync(filePath, 'utf-8');

				// Migration configuration patterns
				const migrationConfigPatterns = [
					/MIGRATION_/i,
					/MIGRATE_/i,
					/auth.*migration/i,
					/terminal.*key.*migration/i,
					/migration.*env/i,
					/migration.*setup/i
				];

				migrationConfigPatterns.forEach((pattern) => {
					if (pattern.test(content)) {
						const lines = content
							.split('\n')
							.map((line, index) => ({ line: line.trim(), number: index + 1 }))
							.filter(({ line }) => pattern.test(line));

						if (lines.length > 0) {
							migrationConfigRefs.push({
								file: fileName,
								pattern: pattern.toString(),
								lines: lines.slice(0, 5) // Limit to first 5 matches
							});
						}
					}
				});
			}
		});

		// Log findings for documentation
		console.log(
			'Migration configuration references found:',
			JSON.stringify(migrationConfigRefs, null, 2)
		);

		// This test should pass if no migration configuration exists
		expect(migrationConfigRefs).toEqual([]);
	});
});
