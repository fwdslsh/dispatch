import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('Settings Database Integration', () => {
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

	describe('Settings Management', () => {
		it('should initialize default settings', async () => {
			// Check that default settings are created
			const globalSettings = await db.getSettingsByCategory('global');
			expect(globalSettings).toHaveProperty('global.theme');
			expect(globalSettings['global.theme']).toBe('retro');
			expect(globalSettings).toHaveProperty('global.autoSaveEnabled');
			expect(globalSettings['global.autoSaveEnabled']).toBe(true);

			const claudeSettings = await db.getSettingsByCategory('claude');
			expect(claudeSettings).toHaveProperty('claude.model');
			expect(claudeSettings['claude.model']).toBe('claude-3-5-sonnet-20241022');
			expect(claudeSettings).toHaveProperty('claude.permissionMode');
			expect(claudeSettings['claude.permissionMode']).toBe('default');
		});

		it('should get and set individual settings', async () => {
			// Set a custom setting
			await db.setSetting('test.value', 'custom_value', 'test', 'Test setting');

			// Retrieve the setting
			const value = await db.getSetting('test.value');
			expect(value).toBe('custom_value');

			// Check it appears in category
			const testSettings = await db.getSettingsByCategory('test');
			expect(testSettings).toHaveProperty('test.value');
			expect(testSettings['test.value']).toBe('custom_value');
		});

		it('should handle JSON values correctly', async () => {
			// Set complex JSON value
			const complexValue = {
				enabled: true,
				options: ['a', 'b', 'c'],
				config: { nested: true }
			};

			await db.setSetting('test.complex', complexValue, 'test');

			// Retrieve and verify
			const retrieved = await db.getSetting('test.complex');
			expect(retrieved).toEqual(complexValue);
		});

		it('should update existing settings', async () => {
			// Update an existing default setting
			await db.setSetting('global.theme', 'dark', 'global', 'Updated theme');

			const theme = await db.getSetting('global.theme');
			expect(theme).toBe('dark');

			// Verify it maintains other properties
			const allSettings = await db.getAllSettings();
			const themeSetting = allSettings.find(s => s.key === 'global.theme');
			expect(themeSetting.category).toBe('global');
			expect(themeSetting.description).toBe('Updated theme');
		});

		it('should delete settings', async () => {
			// Add a setting
			await db.setSetting('temp.setting', 'temporary', 'temp');
			expect(await db.getSetting('temp.setting')).toBe('temporary');

			// Delete it
			await db.deleteSetting('temp.setting');
			expect(await db.getSetting('temp.setting')).toBeNull();
		});

		it('should handle sensitive settings', async () => {
			// Set sensitive setting
			await db.setSetting('claude.apiKey', 'sk-ant-12345', 'claude', 'API Key', true);

			// Verify it's marked as sensitive
			const allSettings = await db.getAllSettings();
			const apiKeySetting = allSettings.find(s => s.key === 'claude.apiKey');
			expect(apiKeySetting.is_sensitive).toBe(1);
			expect(apiKeySetting.value).toBe('sk-ant-12345');
		});

		it('should get all settings with metadata', async () => {
			const allSettings = await db.getAllSettings();
			
			expect(Array.isArray(allSettings)).toBe(true);
			expect(allSettings.length).toBeGreaterThan(0);

			// Check structure
			const firstSetting = allSettings[0];
			expect(firstSetting).toHaveProperty('key');
			expect(firstSetting).toHaveProperty('value');
			expect(firstSetting).toHaveProperty('category');
			expect(firstSetting).toHaveProperty('created_at');
			expect(firstSetting).toHaveProperty('updated_at');
		});

		it('should handle non-existent settings gracefully', async () => {
			const nonExistent = await db.getSetting('does.not.exist');
			expect(nonExistent).toBeNull();

			const emptyCategory = await db.getSettingsByCategory('empty');
			expect(emptyCategory).toEqual({});
		});
	});
});