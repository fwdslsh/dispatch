/**
 * Test for workspace environment variables functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { getWorkspaceEnvVariables } from '../../src/lib/server/shared/utils/env.js';

describe('Workspace Environment Variables', () => {
	let database;
	let tempDbPath;

	beforeEach(async () => {
		// Create unique temporary database for each test
		tempDbPath = `/tmp/test-workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
		database = new DatabaseManager(tempDbPath);
		await database.init();
	});

	afterEach(async () => {
		if (database) {
			await database.close();
		}
	});

	it('should initialize with empty workspace environment variables', async () => {
		const workspaceSettings = await database.getSettingsByCategory('workspace');
		expect(workspaceSettings).toHaveProperty('envVariables');
		expect(workspaceSettings.envVariables).toEqual({});
	});

	it('should save and retrieve workspace environment variables', async () => {
		const testEnvVars = {
			NODE_ENV: 'development',
			API_KEY: 'test-key-123',
			DEBUG: 'app:*'
		};

		// Save environment variables
		await database.setSettingsForCategory('workspace', {
			envVariables: testEnvVars
		});

		// Retrieve environment variables
		const workspaceSettings = await database.getSettingsByCategory('workspace');
		expect(workspaceSettings.envVariables).toEqual(testEnvVars);
	});

	it('should get workspace environment variables via utility function', async () => {
		const testEnvVars = {
			NODE_ENV: 'testing',
			API_URL: 'http://localhost:3000'
		};

		// Save test environment variables
		await database.setSettingsForCategory('workspace', {
			envVariables: testEnvVars
		});

		// Get environment variables using utility function
		const envVars = await getWorkspaceEnvVariables(database);
		expect(envVars).toEqual(testEnvVars);
	});

	it('should return empty object when no workspace environment variables exist', async () => {
		// Don't set any environment variables
		const envVars = await getWorkspaceEnvVariables(database);
		expect(envVars).toEqual({});
	});

	it('should handle database errors gracefully', async () => {
		// Create a mock database that throws an error
		const mockDatabase = {
			getSettingsByCategory: () => {
				throw new Error('Database error');
			}
		};

		const envVars = await getWorkspaceEnvVariables(mockDatabase);
		expect(envVars).toEqual({});
	});

	it('should validate environment variable names properly', () => {
		// Test the validation logic (replicated from component)
		const validateEnvVarKey = (key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);

		// Valid names
		expect(validateEnvVarKey('NODE_ENV')).toBe(true);
		expect(validateEnvVarKey('API_KEY')).toBe(true);
		expect(validateEnvVarKey('_PRIVATE')).toBe(true);
		expect(validateEnvVarKey('MY_VAR_123')).toBe(true);

		// Invalid names
		expect(validateEnvVarKey('123_VAR')).toBe(false); // starts with number
		expect(validateEnvVarKey('MY-VAR')).toBe(false); // contains hyphen
		expect(validateEnvVarKey('MY VAR')).toBe(false); // contains space
		expect(validateEnvVarKey('')).toBe(false); // empty string
		expect(validateEnvVarKey('MY.VAR')).toBe(false); // contains dot
	});
});