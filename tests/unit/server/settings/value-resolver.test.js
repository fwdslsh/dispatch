/**
 * Unit tests for ValueResolver service
 * Tests value resolution hierarchy: UI > Environment > Default
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ValueResolver } from '../../../../src/lib/server/settings/ValueResolver.js';
import { ConfigurationSetting } from '../../../../src/lib/server/settings/ConfigurationSetting.js';

describe('ValueResolver', () => {
	let resolver;
	let mockSettingsManager;
	let originalEnv;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };

		// Create mock settings manager
		mockSettingsManager = {
			settings: new Map(),
			async getSetting(key) {
				return this.settings.get(key);
			},
			async getSettings(categoryId = null) {
				const allSettings = Array.from(this.settings.values());
				if (categoryId) {
					return allSettings.filter((s) => s.category_id === categoryId);
				}
				return allSettings;
			},
			addSetting(setting) {
				this.settings.set(setting.key, setting);
			}
		};

		resolver = new ValueResolver(mockSettingsManager);
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
	});

	describe('Priority Hierarchy: UI > Environment > Default', () => {
		it('should prioritize UI value over environment and default', () => {
			process.env.TEST_VAR = 'env_value';

			const setting = new ConfigurationSetting({
				key: 'test_setting',
				category_id: 'test',
				name: 'Test Setting',
				description: 'Test',
				type: 'string',
				current_value: 'ui_value',
				default_value: 'default_value',
				env_var_name: 'TEST_VAR'
			});

			const resolved = resolver.resolveValue(setting);
			expect(resolved).toBe('ui_value');
		});

		it('should use environment value when UI value is empty', () => {
			process.env.TEST_VAR = 'env_value';

			const setting = new ConfigurationSetting({
				key: 'test_setting',
				category_id: 'test',
				name: 'Test Setting',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'default_value',
				env_var_name: 'TEST_VAR'
			});

			const resolved = resolver.resolveValue(setting);
			expect(resolved).toBe('env_value');
		});

		it('should use default value when UI and environment are empty', () => {
			const setting = new ConfigurationSetting({
				key: 'test_setting',
				category_id: 'test',
				name: 'Test Setting',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'default_value',
				env_var_name: 'TEST_VAR'
			});

			const resolved = resolver.resolveValue(setting);
			expect(resolved).toBe('default_value');
		});

		it('should treat empty string as no value', () => {
			process.env.TEST_VAR = 'env_value';

			const setting = new ConfigurationSetting({
				key: 'test_setting',
				category_id: 'test',
				name: 'Test Setting',
				description: 'Test',
				type: 'string',
				current_value: '',
				default_value: 'default_value',
				env_var_name: 'TEST_VAR'
			});

			const resolved = resolver.resolveValue(setting);
			expect(resolved).toBe('env_value');
		});
	});

	describe('resolveSettingValue with caching', () => {
		it('should cache resolved values', async () => {
			const setting = new ConfigurationSetting({
				key: 'cached_setting',
				category_id: 'test',
				name: 'Cached Setting',
				description: 'Test',
				type: 'string',
				current_value: 'cached_value',
				default_value: 'default_value'
			});

			mockSettingsManager.addSetting(setting);

			// First call - should resolve and cache
			const result1 = await resolver.resolveSettingValue('cached_setting');
			expect(result1).toBe('cached_value');

			// Second call - should return cached value
			const result2 = await resolver.resolveSettingValue('cached_setting');
			expect(result2).toBe('cached_value');

			// Verify cache is being used by checking it was only resolved once
			expect(resolver.cache.has('cached_setting')).toBe(true);
		});

		it('should invalidate cache after timeout', async () => {
			const setting = new ConfigurationSetting({
				key: 'timeout_setting',
				category_id: 'test',
				name: 'Timeout Setting',
				description: 'Test',
				type: 'string',
				current_value: 'value',
				default_value: 'default'
			});

			mockSettingsManager.addSetting(setting);

			// Set very short cache timeout for testing
			resolver.cacheTimeout = 10; // 10ms

			await resolver.resolveSettingValue('timeout_setting');

			// Wait for cache to expire
			await new Promise((resolve) => setTimeout(resolve, 20));

			const cached = resolver.getCachedValue('timeout_setting');
			expect(cached).toBeNull();
		});

		it('should manually invalidate cache', async () => {
			const setting = new ConfigurationSetting({
				key: 'manual_invalidate',
				category_id: 'test',
				name: 'Manual Invalidate',
				description: 'Test',
				type: 'string',
				current_value: 'value',
				default_value: 'default'
			});

			mockSettingsManager.addSetting(setting);

			await resolver.resolveSettingValue('manual_invalidate');
			expect(resolver.cache.has('manual_invalidate')).toBe(true);

			resolver.invalidateCache('manual_invalidate');
			expect(resolver.cache.has('manual_invalidate')).toBe(false);
		});
	});

	describe('resolveMultipleValues', () => {
		it('should resolve multiple settings efficiently', async () => {
			const settings = [
				new ConfigurationSetting({
					key: 'setting1',
					category_id: 'test',
					name: 'Setting 1',
					description: 'Test',
					type: 'string',
					current_value: 'value1',
					default_value: 'default1'
				}),
				new ConfigurationSetting({
					key: 'setting2',
					category_id: 'test',
					name: 'Setting 2',
					description: 'Test',
					type: 'string',
					current_value: 'value2',
					default_value: 'default2'
				}),
				new ConfigurationSetting({
					key: 'setting3',
					category_id: 'test',
					name: 'Setting 3',
					description: 'Test',
					type: 'string',
					current_value: 'value3',
					default_value: 'default3'
				})
			];

			settings.forEach((s) => mockSettingsManager.addSetting(s));

			const result = await resolver.resolveMultipleValues(['setting1', 'setting2', 'setting3']);

			expect(result).toEqual({
				setting1: 'value1',
				setting2: 'value2',
				setting3: 'value3'
			});
		});

		it('should handle non-existent settings gracefully', async () => {
			const result = await resolver.resolveMultipleValues([
				'nonexistent1',
				'nonexistent2'
			]);

			expect(result.nonexistent1).toBeNull();
			expect(result.nonexistent2).toBeNull();
		});
	});

	describe('getResolutionInfo', () => {
		it('should provide detailed resolution information', async () => {
			process.env.TEST_VAR = 'env_value';

			const setting = new ConfigurationSetting({
				key: 'detailed_setting',
				category_id: 'test',
				name: 'Detailed Setting',
				description: 'Test with details',
				type: 'string',
				current_value: 'ui_value',
				default_value: 'default_value',
				env_var_name: 'TEST_VAR',
				is_sensitive: false,
				is_required: true
			});

			mockSettingsManager.addSetting(setting);

			const info = await resolver.getResolutionInfo('detailed_setting');

			expect(info.key).toBe('detailed_setting');
			expect(info.resolved).toBe('ui_value');
			expect(info.source).toBe('ui');
			expect(info.sources.ui).toBe('ui_value');
			expect(info.sources.environment).toBe('env_value');
			expect(info.sources.default).toBe('default_value');
			expect(info.setting_info.name).toBe('Detailed Setting');
			expect(info.setting_info.is_required).toBe(true);
		});

		it('should identify environment source when used', async () => {
			process.env.ENV_SOURCE_TEST = 'from_environment';

			const setting = new ConfigurationSetting({
				key: 'env_source_test',
				category_id: 'test',
				name: 'Env Source Test',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'default_value',
				env_var_name: 'ENV_SOURCE_TEST'
			});

			mockSettingsManager.addSetting(setting);

			const info = await resolver.getResolutionInfo('env_source_test');

			expect(info.source).toBe('environment');
			expect(info.resolved).toBe('from_environment');
		});

		it('should identify default source when used', async () => {
			const setting = new ConfigurationSetting({
				key: 'default_source_test',
				category_id: 'test',
				name: 'Default Source Test',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'default_value',
				env_var_name: null
			});

			mockSettingsManager.addSetting(setting);

			const info = await resolver.getResolutionInfo('default_source_test');

			expect(info.source).toBe('default');
			expect(info.resolved).toBe('default_value');
		});
	});

	describe('checkValueConflicts', () => {
		it('should detect UI/environment mismatches', async () => {
			process.env.CONFLICT_VAR = 'env_value';

			const setting = new ConfigurationSetting({
				key: 'conflict_setting',
				category_id: 'test',
				name: 'Conflict Setting',
				description: 'Test',
				type: 'string',
				current_value: 'different_ui_value',
				default_value: 'default_value',
				env_var_name: 'CONFLICT_VAR',
				is_sensitive: false
			});

			mockSettingsManager.addSetting(setting);

			const conflicts = await resolver.checkValueConflicts();

			expect(conflicts.length).toBeGreaterThan(0);
			const conflict = conflicts.find((c) => c.key === 'conflict_setting');
			expect(conflict).toBeDefined();
			expect(conflict.type).toBe('ui_env_mismatch');
		});

		it('should detect environment/default overrides', async () => {
			process.env.OVERRIDE_VAR = 'env_override';

			const setting = new ConfigurationSetting({
				key: 'override_setting',
				category_id: 'test',
				name: 'Override Setting',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'different_default',
				env_var_name: 'OVERRIDE_VAR'
			});

			mockSettingsManager.addSetting(setting);

			const conflicts = await resolver.checkValueConflicts();

			const conflict = conflicts.find((c) => c.key === 'override_setting');
			expect(conflict).toBeDefined();
			expect(conflict.type).toBe('env_default_override');
		});

		it('should mask sensitive values in conflict reports', async () => {
			process.env.SENSITIVE_VAR = 'sensitive_env';

			const setting = new ConfigurationSetting({
				key: 'sensitive_conflict',
				category_id: 'test',
				name: 'Sensitive Conflict',
				description: 'Test',
				type: 'string',
				current_value: 'sensitive_ui',
				default_value: 'default',
				env_var_name: 'SENSITIVE_VAR',
				is_sensitive: true
			});

			mockSettingsManager.addSetting(setting);

			const conflicts = await resolver.checkValueConflicts();

			const conflict = conflicts.find((c) => c.key === 'sensitive_conflict');
			if (conflict) {
				expect(conflict.ui_value).toContain('*');
				expect(conflict.env_value).toContain('*');
			}
		});
	});

	describe('validateResolvedValues', () => {
		it('should detect missing required values', async () => {
			const setting = new ConfigurationSetting({
				key: 'required_missing',
				category_id: 'test',
				name: 'Required Missing',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: null,
				is_required: true
			});

			mockSettingsManager.addSetting(setting);

			const result = await resolver.validateResolvedValues();

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			const error = result.errors.find((e) => e.key === 'required_missing');
			expect(error).toBeDefined();
		});

		it('should warn about default values for sensitive settings', async () => {
			const setting = new ConfigurationSetting({
				key: 'sensitive_default',
				category_id: 'test',
				name: 'Sensitive Default',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'default_sensitive',
				is_sensitive: true
			});

			mockSettingsManager.addSetting(setting);

			const result = await resolver.validateResolvedValues();

			expect(result.warnings.length).toBeGreaterThan(0);
			const warning = result.warnings.find((w) => w.key === 'sensitive_default');
			expect(warning).toBeDefined();
		});

		it('should warn about empty environment variables', async () => {
			process.env.EMPTY_VAR = '';

			const setting = new ConfigurationSetting({
				key: 'empty_env',
				category_id: 'test',
				name: 'Empty Env',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'has_default',
				env_var_name: 'EMPTY_VAR'
			});

			mockSettingsManager.addSetting(setting);

			const result = await resolver.validateResolvedValues();

			const warning = result.warnings.find((w) => w.key === 'empty_env');
			expect(warning).toBeDefined();
		});
	});

	describe('getConfigurationRecommendations', () => {
		it('should recommend UI config for sensitive environment settings', async () => {
			process.env.SENSITIVE_ENV = 'secret_value';

			const setting = new ConfigurationSetting({
				key: 'sensitive_via_env',
				category_id: 'test',
				name: 'Sensitive Via Env',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'default',
				env_var_name: 'SENSITIVE_ENV',
				is_sensitive: true
			});

			mockSettingsManager.addSetting(setting);

			const recommendations = await resolver.getConfigurationRecommendations();

			const rec = recommendations.find((r) => r.key === 'sensitive_via_env');
			expect(rec).toBeDefined();
			expect(rec.type).toBe('security');
			expect(rec.priority).toBe('high');
		});

		it('should recommend environment variables for deployment settings', async () => {
			const setting = new ConfigurationSetting({
				key: 'workspaces_root',
				category_id: 'workspace',
				name: 'Workspaces Root',
				description: 'Test',
				type: 'path',
				current_value: null,
				default_value: '/default/workspace',
				env_var_name: 'WORKSPACES_ROOT'
			});

			mockSettingsManager.addSetting(setting);

			const recommendations = await resolver.getConfigurationRecommendations();

			const rec = recommendations.find((r) => r.key === 'workspaces_root');
			expect(rec).toBeDefined();
			expect(rec.type).toBe('deployment');
		});

		it('should recommend changing default security values', async () => {
			const setting = new ConfigurationSetting({
				key: 'terminal_key',
				category_id: 'auth',
				name: 'Terminal Key',
				description: 'Test',
				type: 'string',
				current_value: null,
				default_value: 'change-me-to-a-strong-password',
				is_sensitive: true
			});

			mockSettingsManager.addSetting(setting);

			const recommendations = await resolver.getConfigurationRecommendations();

			const rec = recommendations.find((r) => r.key === 'terminal_key');
			expect(rec).toBeDefined();
			expect(rec.priority).toBe('critical');
		});
	});

	describe('Cache management', () => {
		it('should clear all caches', () => {
			resolver.setCachedValue('key1', 'value1');
			resolver.setCachedValue('key2', 'value2');

			expect(resolver.cache.size).toBeGreaterThan(0);

			resolver.clearCache();

			expect(resolver.cache.size).toBe(0);
			expect(resolver.lastCacheUpdate.size).toBe(0);
		});

		it('should invalidate specific cache key', () => {
			resolver.setCachedValue('key1', 'value1');
			resolver.setCachedValue('key2', 'value2');

			resolver.invalidateCache('key1');

			expect(resolver.cache.has('key1')).toBe(false);
			expect(resolver.cache.has('key2')).toBe(true);
		});
	});

	describe('Performance', () => {
		it('should resolve values quickly', async () => {
			const settings = [];
			for (let i = 0; i < 100; i++) {
				const setting = new ConfigurationSetting({
					key: `perf_setting_${i}`,
					category_id: 'test',
					name: `Performance Test ${i}`,
					description: 'Test',
					type: 'string',
					current_value: `value_${i}`,
					default_value: 'default'
				});
				mockSettingsManager.addSetting(setting);
				settings.push(setting.key);
			}

			const start = Date.now();

			await resolver.resolveMultipleValues(settings);

			const duration = Date.now() - start;

			// Should resolve 100 settings in less than 50ms
			expect(duration).toBeLessThan(50);
		});
	});
});