/**
 * Unit tests for SettingsRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsRepository } from '$lib/server/database/SettingsRepository.js';
import { DatabaseManager } from '$lib/server/database/DatabaseManager.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SettingsRepository', () => {
	let tempDir;
	let db;
	let repository;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'dispatch-test-'));
		const dbPath = join(tempDir, 'test.db');
		db = new DatabaseManager({ dbPath });
		await db.init();
		repository = new SettingsRepository(db);
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	describe('get and set (simple key-value)', () => {
		it('should return undefined for non-existent key', async () => {
			const value = await repository.get('non-existent');

			expect(value).toBeUndefined();
		});

		it('should set and get a value', async () => {
			await repository.set('testKey', 'testValue');

			const value = await repository.get('testKey');

			expect(value).toBe('testValue');
		});

		it('should handle different value types', async () => {
			await repository.set('string', 'hello');
			await repository.set('number', 42);
			await repository.set('boolean', true);
			await repository.set('object', { nested: 'value' });
			await repository.set('array', [1, 2, 3]);

			expect(await repository.get('string')).toBe('hello');
			expect(await repository.get('number')).toBe(42);
			expect(await repository.get('boolean')).toBe(true);
			expect(await repository.get('object')).toEqual({ nested: 'value' });
			expect(await repository.get('array')).toEqual([1, 2, 3]);
		});

		it('should overwrite existing value', async () => {
			await repository.set('key', 'original');
			await repository.set('key', 'updated');

			const value = await repository.get('key');

			expect(value).toBe('updated');
		});

		it('should handle null values', async () => {
			await repository.set('nullKey', null);

			const value = await repository.get('nullKey');

			expect(value).toBeNull();
		});
	});

	describe('getByCategory', () => {
		it('should return empty object for non-existent category', async () => {
			const settings = await repository.getByCategory('non-existent');

			expect(settings).toEqual({});
		});

		it('should retrieve settings for a category', async () => {
			await repository.setByCategory('claude', {
				model: 'claude-3-5-sonnet-20241022',
				maxTokens: 4096
			});

			const settings = await repository.getByCategory('claude');

			expect(settings.model).toBe('claude-3-5-sonnet-20241022');
			expect(settings.maxTokens).toBe(4096);
		});

		it('should handle complex nested settings', async () => {
			await repository.setByCategory('workspace', {
				envVariables: {
					PATH: '/usr/bin:/bin',
					NODE_ENV: 'production'
				},
				config: {
					deep: {
						nested: {
							value: 'test'
						}
					}
				}
			});

			const settings = await repository.getByCategory('workspace');

			expect(settings.envVariables.PATH).toBe('/usr/bin:/bin');
			expect(settings.config.deep.nested.value).toBe('test');
		});

		it('should return empty object for corrupted JSON', async () => {
			// Manually insert corrupted data
			await db.run(
				`INSERT INTO settings (category, settings_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?)`,
				['corrupted', 'invalid json{', Date.now(), Date.now()]
			);

			const settings = await repository.getByCategory('corrupted');

			expect(settings).toEqual({});
		});
	});

	describe('setByCategory', () => {
		it('should create new category settings', async () => {
			await repository.setByCategory('theme', { color: 'blue' });

			const settings = await repository.getByCategory('theme');

			expect(settings.color).toBe('blue');
		});

		it('should update existing category settings', async () => {
			await repository.setByCategory('theme', { color: 'blue' });
			await repository.setByCategory('theme', { color: 'red', font: 'monospace' });

			const settings = await repository.getByCategory('theme');

			expect(settings.color).toBe('red');
			expect(settings.font).toBe('monospace');
		});

		it('should accept optional description', async () => {
			await repository.setByCategory('test', { key: 'value' }, 'Test category description');

			const all = await repository.getAll();
			const testCategory = all.find((c) => c.category === 'test');

			expect(testCategory.description).toBe('Test category description');
		});

		it('should preserve created_at when updating', async () => {
			await repository.setByCategory('test', { version: 1 });

			const all1 = await repository.getAll();
			const originalCreatedAt = all1.find((c) => c.category === 'test').createdAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			await repository.setByCategory('test', { version: 2 });

			const all2 = await repository.getAll();
			const updatedCreatedAt = all2.find((c) => c.category === 'test').createdAt;

			expect(updatedCreatedAt).toBe(originalCreatedAt);
		});

		it('should update updated_at when modifying', async () => {
			await repository.setByCategory('test', { version: 1 });

			const all1 = await repository.getAll();
			const originalUpdatedAt = all1.find((c) => c.category === 'test').updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			await repository.setByCategory('test', { version: 2 });

			const all2 = await repository.getAll();
			const newUpdatedAt = all2.find((c) => c.category === 'test').updatedAt;

			expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
		});

		it('should handle empty settings object', async () => {
			await repository.setByCategory('empty', {});

			const settings = await repository.getByCategory('empty');

			expect(settings).toEqual({});
		});
	});

	describe('updateInCategory', () => {
		it('should update specific key in category', async () => {
			await repository.setByCategory('claude', {
				model: 'claude-3-5-sonnet-20241022',
				maxTokens: 4096
			});

			await repository.updateInCategory('claude', 'maxTokens', 8192);

			const settings = await repository.getByCategory('claude');

			expect(settings.model).toBe('claude-3-5-sonnet-20241022');
			expect(settings.maxTokens).toBe(8192);
		});

		it('should add new key to existing category', async () => {
			await repository.setByCategory('claude', { model: 'claude-3-5-sonnet-20241022' });

			await repository.updateInCategory('claude', 'temperature', 0.7);

			const settings = await repository.getByCategory('claude');

			expect(settings.model).toBe('claude-3-5-sonnet-20241022');
			expect(settings.temperature).toBe(0.7);
		});

		it('should create category if it does not exist', async () => {
			await repository.updateInCategory('new-category', 'key', 'value');

			const settings = await repository.getByCategory('new-category');

			expect(settings.key).toBe('value');
		});

		it('should handle complex value updates', async () => {
			await repository.setByCategory('workspace', { envVariables: {} });

			await repository.updateInCategory('workspace', 'envVariables', {
				PATH: '/usr/bin',
				NODE_ENV: 'production'
			});

			const settings = await repository.getByCategory('workspace');

			expect(settings.envVariables).toEqual({
				PATH: '/usr/bin',
				NODE_ENV: 'production'
			});
		});
	});

	describe('getAll', () => {
		it('should return empty array when no settings exist', async () => {
			const all = await repository.getAll();

			expect(all).toEqual([]);
		});

		it('should return all settings with metadata', async () => {
			await repository.setByCategory('global', { theme: 'retro' }, 'Global settings');
			await repository.setByCategory('claude', { model: 'claude-3-5-sonnet-20241022' }, 'Claude settings');
			await repository.setByCategory('workspace', { envVariables: {} });

			const all = await repository.getAll();

			expect(all).toHaveLength(3);

			const global = all.find((c) => c.category === 'global');
			expect(global.settings.theme).toBe('retro');
			expect(global.description).toBe('Global settings');
			expect(global.createdAt).toBeDefined();
			expect(global.updatedAt).toBeDefined();

			const claude = all.find((c) => c.category === 'claude');
			expect(claude.settings.model).toBe('claude-3-5-sonnet-20241022');
			expect(claude.description).toBe('Claude settings');
		});

		it('should order results by category alphabetically', async () => {
			await repository.setByCategory('zebra', {});
			await repository.setByCategory('alpha', {});
			await repository.setByCategory('beta', {});

			const all = await repository.getAll();

			expect(all[0].category).toBe('alpha');
			expect(all[1].category).toBe('beta');
			expect(all[2].category).toBe('zebra');
		});

		it('should handle categories with corrupted JSON gracefully', async () => {
			await repository.setByCategory('valid', { key: 'value' });

			// Insert corrupted data
			await db.run(
				`INSERT INTO settings (category, settings_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?)`,
				['corrupted', 'invalid{', Date.now(), Date.now()]
			);

			const all = await repository.getAll();

			expect(all).toHaveLength(2);

			const valid = all.find((c) => c.category === 'valid');
			expect(valid.settings.key).toBe('value');

			const corrupted = all.find((c) => c.category === 'corrupted');
			expect(corrupted.settings).toEqual({});
		});
	});

	describe('deleteCategory', () => {
		it('should delete category', async () => {
			await repository.setByCategory('temp', { key: 'value' });

			await repository.deleteCategory('temp');

			const settings = await repository.getByCategory('temp');
			expect(settings).toEqual({});
		});

		it('should not affect other categories', async () => {
			await repository.setByCategory('keep', { key: 'keep' });
			await repository.setByCategory('delete', { key: 'delete' });

			await repository.deleteCategory('delete');

			const keep = await repository.getByCategory('keep');
			const deleted = await repository.getByCategory('delete');

			expect(keep.key).toBe('keep');
			expect(deleted).toEqual({});
		});

		it('should not throw when deleting non-existent category', async () => {
			await expect(repository.deleteCategory('non-existent')).resolves.not.toThrow();
		});
	});

	describe('initializeDefaults', () => {
		it('should initialize default settings', async () => {
			await repository.initializeDefaults();

			const global = await repository.getByCategory('global');
			const claude = await repository.getByCategory('claude');
			const workspace = await repository.getByCategory('workspace');

			expect(global.theme).toBe('retro');
			expect(claude.model).toBe('claude-3-5-sonnet-20241022');
			expect(claude.permissionMode).toBe('default');
			expect(workspace.envVariables).toEqual({});
		});

		it('should not overwrite existing settings', async () => {
			await repository.setByCategory('global', { theme: 'custom' });

			await repository.initializeDefaults();

			const global = await repository.getByCategory('global');

			expect(global.theme).toBe('custom'); // Should not be overwritten
		});

		it('should only initialize missing categories', async () => {
			await repository.setByCategory('global', { theme: 'custom' });

			await repository.initializeDefaults();

			const global = await repository.getByCategory('global');
			const claude = await repository.getByCategory('claude');

			expect(global.theme).toBe('custom'); // Existing
			expect(claude.model).toBe('claude-3-5-sonnet-20241022'); // Initialized
		});

		it('should be idempotent', async () => {
			await repository.initializeDefaults();
			await repository.initializeDefaults();
			await repository.initializeDefaults();

			const all = await repository.getAll();

			// Should still have exactly 3 default categories
			expect(all).toHaveLength(3);
			expect(all.map((c) => c.category).sort()).toEqual(['claude', 'global', 'workspace']);
		});
	});
});
