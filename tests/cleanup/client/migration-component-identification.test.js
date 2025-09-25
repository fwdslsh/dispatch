/**
 * @file Client Migration Component Identification Tests
 * Tests to identify all migration-related Svelte components, state management, and Socket.IO handlers.
 * These tests will be removed in Task 6 after cleanup is complete.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();

describe('Client Migration Component Identification', () => {
	it('should identify all migration-related Svelte components', () => {
		// Search for all Svelte components and JS files in client directories
		const clientFiles = findClientFiles(join(PROJECT_ROOT, 'src/lib/client'));
		const migrationComponents = [];

		for (const filePath of clientFiles) {
			const file = filePath.replace(PROJECT_ROOT + '/', '');
			if (!existsSync(filePath)) continue;

			const content = readFileSync(filePath, 'utf-8');

			// Check for migration-related component names and imports
			const migrationPatterns = [
				/migration.*component/i,
				/migration.*wizard/i,
				/migration.*progress/i,
				/migration.*status/i,
				/migration.*form/i,
				/onboarding.*migration/i,
				/legacy.*auth.*form/i,
				/terminal.*key.*migration/i
			];

			migrationPatterns.forEach(pattern => {
				if (pattern.test(content)) {
					const lines = content.split('\n')
						.map((line, index) => ({ line: line.trim(), number: index + 1 }))
						.filter(({ line }) => pattern.test(line));

					if (lines.length > 0) {
						migrationComponents.push({
							file,
							type: 'migration-component',
							pattern: pattern.toString(),
							lines
						});
					}
				}
			});
		}

		// Log findings for documentation
		console.log('Migration-related components found:', JSON.stringify(migrationComponents, null, 2));

		// Initially this will fail, showing us what to clean up
		expect(migrationComponents).toEqual([]);
	});

	it('should verify migration state properties are removed from SecurityState', () => {
		const securityStatePath = join(PROJECT_ROOT, 'src/lib/client/shared/state/SecurityState.svelte.js');

		if (existsSync(securityStatePath)) {
			const content = readFileSync(securityStatePath, 'utf-8');

			// Check for migration-related state properties
			const migrationStatePatterns = [
				/migration.*state/i,
				/migration.*progress/i,
				/migration.*status/i,
				/migration.*complete/i,
				/terminal.*key.*migration/i,
				/legacy.*migration/i
			];

			const migrationStateRefs = [];

			migrationStatePatterns.forEach(pattern => {
				if (pattern.test(content)) {
					const lines = content.split('\n')
						.map((line, index) => ({ line: line.trim(), number: index + 1 }))
						.filter(({ line }) => pattern.test(line));

					if (lines.length > 0) {
						migrationStateRefs.push({
							pattern: pattern.toString(),
							lines
						});
					}
				}
			});

			console.log('Migration state properties found in SecurityState:', JSON.stringify(migrationStateRefs, null, 2));
			expect(migrationStateRefs).toEqual([]);
		}
	});

	it('should validate Socket.IO migration event handlers are removed', () => {
		// Search for Socket.IO service files and event handlers
		const socketFiles = [
			'src/lib/client/shared/services/SocketService.svelte.js',
			'src/lib/client/shared/services/RunSessionClient.js'
		];

		const migrationSocketRefs = [];

		socketFiles.forEach(filePath => {
			const fullPath = join(PROJECT_ROOT, filePath);
			if (!existsSync(fullPath)) return;

			const content = readFileSync(fullPath, 'utf-8');

			// Check for migration-related Socket.IO event handlers
			const migrationSocketPatterns = [
				/migration:.*event/i,
				/auth:migration/i,
				/migration.*handler/i,
				/migration.*progress/i,
				/terminal.*key.*migration/i,
				/'migration.*'/i,
				/"migration.*"/i
			];

			migrationSocketPatterns.forEach(pattern => {
				if (pattern.test(content)) {
					const lines = content.split('\n')
						.map((line, index) => ({ line: line.trim(), number: index + 1 }))
						.filter(({ line }) => pattern.test(line));

					if (lines.length > 0) {
						migrationSocketRefs.push({
							file: filePath,
							pattern: pattern.toString(),
							lines
						});
					}
				}
			});
		});

		console.log('Migration Socket.IO event handlers found:', JSON.stringify(migrationSocketRefs, null, 2));
		expect(migrationSocketRefs).toEqual([]);
	});

	it('should ensure authentication UI flows work without migration components', () => {
		// Search for authentication flow components
		const authFlowFiles = findClientFiles(join(PROJECT_ROOT, 'src/lib/client/shared/components'))
			.filter(file => /auth/i.test(file) || /login/i.test(file) || /security/i.test(file));

		const migrationFlowRefs = [];

		for (const filePath of authFlowFiles) {
			const file = filePath.replace(PROJECT_ROOT + '/', '');
			if (!existsSync(filePath)) continue;

			const content = readFileSync(filePath, 'utf-8');

			// Check for migration-related authentication flow references
			const migrationFlowPatterns = [
				/if.*migration/i,
				/migration.*required/i,
				/migration.*step/i,
				/migration.*wizard/i,
				/migration.*progress/i,
				/showMigration/i,
				/migrationComplete/i,
				/migrationFlow/i
			];

			migrationFlowPatterns.forEach(pattern => {
				if (pattern.test(content)) {
					const lines = content.split('\n')
						.map((line, index) => ({ line: line.trim(), number: index + 1 }))
						.filter(({ line }) => pattern.test(line));

					if (lines.length > 0) {
						migrationFlowRefs.push({
							file,
							pattern: pattern.toString(),
							lines
						});
					}
				}
			});
		}

		console.log('Migration authentication flow references found:', JSON.stringify(migrationFlowRefs, null, 2));
		expect(migrationFlowRefs).toEqual([]);
	});
});

/**
 * Recursively find all client-side files (Svelte components and JS files)
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of file paths
 */
function findClientFiles(dir) {
	const files = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);
			if (stat.isDirectory()) {
				files.push(...findClientFiles(fullPath));
			} else if (entry.endsWith('.svelte') || entry.endsWith('.js')) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		// Directory doesn't exist or can't be read
	}
	return files;
}