/**
 * @file Migration Component Identification Tests
 * Tests to identify all migration-related imports and dependencies.
 * These tests will be removed in Task 6 after cleanup is complete.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();

describe('Migration Component Identification', () => {
	it('should identify all migration-related imports and dependencies', () => {
		// Search for all JavaScript files recursively
		const jsFiles = findJsFiles(join(PROJECT_ROOT, 'src'));
		const migrationImports = [];

		for (const filePath of jsFiles) {
			const file = filePath.replace(PROJECT_ROOT + '/', '');
			if (!existsSync(filePath)) continue;

			const content = readFileSync(filePath, 'utf-8');

			// Check for AuthMigrationManager imports
			if (content.includes('AuthMigrationManager')) {
				migrationImports.push({
					file,
					type: 'AuthMigrationManager',
					lines: content.split('\n')
						.map((line, index) => ({ line: line.trim(), number: index + 1 }))
						.filter(({ line }) => line.includes('AuthMigrationManager'))
				});
			}

			// Check for migration-related imports
			const migrationPatterns = [
				/import.*migration/i,
				/from.*migration/i,
				/'.*migration.*'/i,
				/".*migration.*"/i
			];

			migrationPatterns.forEach(pattern => {
				if (pattern.test(content)) {
					migrationImports.push({
						file,
						type: 'migration-import',
						pattern: pattern.toString(),
						lines: content.split('\n')
							.map((line, index) => ({ line: line.trim(), number: index + 1 }))
							.filter(({ line }) => pattern.test(line))
					});
				}
			});
		}

		// This test documents what needs to be cleaned up
		console.log('Migration-related imports found:', JSON.stringify(migrationImports, null, 2));

		// Initially this will fail, showing us what to clean up
		expect(migrationImports).toEqual([]);
	});

	it('should verify AuthMigrationManager is completely removed from codebase', () => {
		const authMigrationManagerPath = join(PROJECT_ROOT, 'src/lib/server/shared/AuthMigrationManager.js');

		// This should initially pass (file exists) then fail after removal
		expect(existsSync(authMigrationManagerPath)).toBe(false);
	});

	it('should validate all migration API endpoints return 404 after removal', () => {
		const migrationEndpoints = [
			'src/routes/api/admin/migration',
			'src/routes/api/auth/migrate'
		];

		const existingEndpoints = [];

		for (const endpoint of migrationEndpoints) {
			const endpointPath = join(PROJECT_ROOT, endpoint);
			if (existsSync(endpointPath)) {
				// Find all +server.js files in this endpoint
				const serverFiles = findServerFiles(endpointPath);
				existingEndpoints.push(...serverFiles);
			}
		}

		// This should initially fail (endpoints exist) then pass after removal
		expect(existingEndpoints).toEqual([]);
	});

	it('should ensure no migration-related environment variables are referenced', () => {
		// Search for migration-related environment variable references
		const allFiles = findJsFiles(join(PROJECT_ROOT, 'src'));
		const migrationEnvRefs = [];

		const migrationEnvPatterns = [
			/process\.env\..*MIGRATION/i,
			/process\.env\..*MIGRATE/i,
			/MIGRATION_/i,
			/MIGRATE_/i
		];

		for (const filePath of allFiles) {
			const file = filePath.replace(PROJECT_ROOT + '/', '');
			if (!existsSync(filePath)) continue;

			const content = readFileSync(filePath, 'utf-8');

			migrationEnvPatterns.forEach(pattern => {
				if (pattern.test(content)) {
					const lines = content.split('\n')
						.map((line, index) => ({ line: line.trim(), number: index + 1 }))
						.filter(({ line }) => pattern.test(line));

					if (lines.length > 0) {
						migrationEnvRefs.push({
							file,
							pattern: pattern.toString(),
							lines
						});
					}
				}
			});
		}

		console.log('Migration environment variable references found:', JSON.stringify(migrationEnvRefs, null, 2));

		// This should initially fail then pass after cleanup
		expect(migrationEnvRefs).toEqual([]);
	});
});

/**
 * Recursively find all JavaScript files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function findJsFiles(dir) {
	const files = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);
			if (stat.isDirectory()) {
				files.push(...findJsFiles(fullPath));
			} else if (entry.endsWith('.js')) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		// Directory doesn't exist or can't be read
	}
	return files;
}

/**
 * Find all +server.js files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of server file paths
 */
function findServerFiles(dir) {
	const files = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);
			if (stat.isDirectory()) {
				files.push(...findServerFiles(fullPath));
			} else if (entry === '+server.js') {
				files.push(fullPath.replace(process.cwd() + '/', ''));
			}
		}
	} catch (error) {
		// Directory doesn't exist or can't be read
	}
	return files;
}