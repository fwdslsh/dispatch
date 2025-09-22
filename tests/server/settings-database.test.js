import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('Settings Database Integration - JSON per Category', () => {
	let db;
	let tempDbPath;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-settings-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		try {
			rmSync(tempDbPath, { force: true });
		} catch (e) {
			// Ignore cleanup errors
		}
	});

	describe('Settings Management - JSON Objects per Category', () => {
		it('should initialize default settings', async () => {
			// Check that default settings are created
			const globalSettings = await db.getSettingsByCategory('global');
			expect(globalSettings).toHaveProperty('theme');
			expect(globalSettings.theme).toBe('retro');

			const claudeSettings = await db.getSettingsByCategory('claude');
			expect(claudeSettings).toHaveProperty('model');
			expect(claudeSettings.model).toBe('claude-3-5-sonnet-20241022');
			expect(claudeSettings).toHaveProperty('permissionMode');
			expect(claudeSettings.permissionMode).toBe('default');
		});

		it('should get and set category settings', async () => {
			// Set a custom settings object for a category
			const testSettings = {
				testSetting1: 'value1',
				testSetting2: 42,
				testSetting3: { nested: true }
			};

			await db.setSettingsForCategory('test', testSettings, 'Test category');

			// Retrieve the settings
			const retrieved = await db.getSettingsByCategory('test');
			expect(retrieved).toEqual(testSettings);
		});

		it('should handle complex JSON values correctly', async () => {
			// Set complex JSON object
			const complexSettings = {
				enabled: true,
				options: ['a', 'b', 'c'],
				config: {
					nested: true,
					numbers: [1, 2, 3],
					nullValue: null
				}
			};

			await db.setSettingsForCategory('complex', complexSettings);

			// Retrieve and verify
			const retrieved = await db.getSettingsByCategory('complex');
			expect(retrieved).toEqual(complexSettings);
		});

		it('should update existing category settings', async () => {
			// Update an existing default category
			const newGlobalSettings = {
				theme: 'dark',
				newSetting: 'added'
			};

			await db.setSettingsForCategory('global', newGlobalSettings, 'Updated global settings');

			const settings = await db.getSettingsByCategory('global');
			expect(settings.theme).toBe('dark');
			expect(settings.newSetting).toBe('added');
		});

		it('should update individual setting in category', async () => {
			// Update a specific setting within a category
			await db.updateSettingInCategory('global', 'theme', 'light');

			const settings = await db.getSettingsByCategory('global');
			expect(settings.theme).toBe('light');
			// Other settings should remain unchanged
			expect(settings).toHaveProperty('theme');
		});

		it('should delete settings categories', async () => {
			// Add a category
			await db.setSettingsForCategory('temp', { temporary: true });
			expect(await db.getSettingsByCategory('temp')).toEqual({ temporary: true });

			// Delete it
			await db.deleteSettingsCategory('temp');
			expect(await db.getSettingsByCategory('temp')).toEqual({});
		});

		it('should get all settings with metadata', async () => {
			const allSettings = await db.getAllSettings();

			expect(Array.isArray(allSettings)).toBe(true);
			expect(allSettings.length).toBeGreaterThan(0);

			// Check structure
			const firstSetting = allSettings[0];
			expect(firstSetting).toHaveProperty('category');
			expect(firstSetting).toHaveProperty('settings');
			expect(firstSetting).toHaveProperty('created_at');
			expect(firstSetting).toHaveProperty('updated_at');
			expect(firstSetting).not.toHaveProperty('settings_json'); // Should be parsed
		});

		it('should handle non-existent categories gracefully', async () => {
			const nonExistent = await db.getSettingsByCategory('does_not_exist');
			expect(nonExistent).toEqual({});
		});

		it('should preserve timestamps on updates', async () => {
			// Get initial timestamps
			const allBefore = await db.getAllSettings();
			const globalBefore = allBefore.find((s) => s.category === 'global');
			const createdAtBefore = globalBefore.created_at;

			// Wait a bit and update
			await new Promise((resolve) => setTimeout(resolve, 10));
			await db.updateSettingInCategory('global', 'theme', 'updated');

			// Check timestamps
			const allAfter = await db.getAllSettings();
			const globalAfter = allAfter.find((s) => s.category === 'global');

			expect(globalAfter.created_at).toBe(createdAtBefore); // Should be preserved
			expect(globalAfter.updated_at).toBeGreaterThan(globalAfter.created_at); // Should be updated
		});
	});
});
