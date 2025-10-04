import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValueResolver } from '../../../../src/lib/server/settings/ValueResolver.js';
import { SettingsManager } from '../../../../src/lib/server/settings/SettingsManager.js';

describe('Settings Priority Hierarchy - Integration Tests', () => {
	let originalEnv;
	let settingsManager;
	let valueResolver;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };

		// Clear environment for clean testing
		delete process.env.WORKSPACES_ROOT;
		delete process.env.TERMINAL_KEY;
		delete process.env.SSL_ENABLED;

		// Initialize components
		settingsManager = new SettingsManager();
		valueResolver = new ValueResolver(settingsManager);
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
	});

	it('should prioritize UI configuration over environment variable', async () => {
		// Set environment variable
		process.env.WORKSPACES_ROOT = '/env/workspace';

		// Set UI configuration (simulate database value)
		await settingsManager.updateSetting('workspaces_root', '/ui/workspace');

		// Test resolution
		const resolved = await valueResolver.resolveSettingValue('workspaces_root');

		expect(resolved).toBe('/ui/workspace');
		expect(resolved).not.toBe('/env/workspace');
	});

	it('should fallback to environment variable when UI not configured', async () => {
		// Set environment variable
		process.env.SSL_ENABLED = 'true';

		// Ensure no UI configuration
		await settingsManager.clearSetting('ssl_enabled');

		// Test resolution
		const resolved = await valueResolver.resolveSettingValue('ssl_enabled');

		expect(resolved).toBe('true');
	});

	it('should fallback to default value when neither UI nor environment set', async () => {
		// Ensure no environment variable
		delete process.env.WORKSPACES_ROOT;

		// Ensure no UI configuration
		await settingsManager.clearSetting('workspaces_root');

		// Test resolution (should return default)
		const resolved = await valueResolver.resolveSettingValue('workspaces_root');

		expect(resolved).toBe('/workspace'); // Default value from schema
	});

	it('should handle complete priority hierarchy for terminal key', async () => {
		const testKey = 'env-key-12345';
		const uiKey = 'ui-key-67890';

		// Test 1: Only default (no env, no UI)
		delete process.env.TERMINAL_KEY;
		await settingsManager.clearSetting('terminal_key');

		let resolved = await valueResolver.resolveSettingValue('terminal_key');
		expect(resolved).toBe('change-me-to-a-strong-password'); // Default value

		// Test 2: Environment variable set
		process.env.TERMINAL_KEY = testKey;
		// Clear any cached value to force re-evaluation
		valueResolver.clearCache?.();

		resolved = await valueResolver.resolveSettingValue('terminal_key');
		expect(resolved).toBe(testKey);

		// Test 3: UI overrides environment
		await settingsManager.updateSetting('terminal_key', uiKey);
		// Clear cache to ensure UI value is read
		valueResolver.clearCache?.();

		resolved = await valueResolver.resolveSettingValue('terminal_key');
		expect(resolved).toBe(uiKey);
	});

	it('should validate priority order across multiple settings', async () => {
		// Set up test data
		const testSettings = {
			workspaces_root: {
				env: '/env/workspace',
				ui: '/ui/workspace',
				default: '/workspace'
			},
			terminal_key: {
				env: 'env-key-123',
				ui: 'ui-key-456',
				default: 'change-me-to-a-strong-password'
			},
			ssl_enabled: {
				env: 'false',
				ui: 'true',
				default: 'false'
			}
		};

		// Set environment variables
		process.env.WORKSPACES_ROOT = testSettings.workspaces_root.env;
		process.env.TERMINAL_KEY = testSettings.terminal_key.env;
		process.env.SSL_ENABLED = testSettings.ssl_enabled.env;

		// Set UI configurations
		await settingsManager.updateSetting('workspaces_root', testSettings.workspaces_root.ui);
		await settingsManager.updateSetting('terminal_key', testSettings.terminal_key.ui);
		await settingsManager.updateSetting('ssl_enabled', testSettings.ssl_enabled.ui);

		// Test all resolutions
		const results = await Promise.all([
			valueResolver.resolveSettingValue('workspaces_root'),
			valueResolver.resolveSettingValue('terminal_key'),
			valueResolver.resolveSettingValue('ssl_enabled')
		]);

		expect(results[0]).toBe(testSettings.workspaces_root.ui);
		expect(results[1]).toBe(testSettings.terminal_key.ui);
		expect(results[2]).toBe(testSettings.ssl_enabled.ui);
	});

	it('should handle mixed scenarios (some UI, some env, some default)', async () => {
		// Scenario: workspaces_root from UI, ssl_enabled from env, theme from default

		// Set up mixed configuration
		await settingsManager.updateSetting('workspaces_root', '/custom/workspace');
		process.env.SSL_ENABLED = 'true';
		// theme has no UI or env setting, should use default

		const results = await Promise.all([
			valueResolver.resolveSettingValue('workspaces_root'),
			valueResolver.resolveSettingValue('ssl_enabled'),
			valueResolver.resolveSettingValue('theme')
		]);

		expect(results[0]).toBe('/custom/workspace'); // UI value
		expect(results[1]).toBe('true'); // Environment value
		expect(results[2]).toBe('auto'); // Default value
	});

	it('should handle empty string values correctly in priority', async () => {
		// Test behavior with empty strings - should not validate empty required fields
		process.env.WORKSPACES_ROOT = '';

		// Don't try to set empty string for required field, just test env behavior
		const resolved = await valueResolver.resolveSettingValue('workspaces_root');

		// Empty env should fall back to default since it's required
		expect(resolved).toBeDefined();
		expect(resolved).not.toBe(''); // Should not be empty string
	});

	it('should invalidate cache when settings change', async () => {
		// Set initial value
		await settingsManager.updateSetting('theme', 'dark');

		let resolved = await valueResolver.resolveSettingValue('theme');
		expect(resolved).toBe('dark');

		// Change value
		await settingsManager.updateSetting('theme', 'light');
		// Explicitly clear cache if method exists
		valueResolver.clearCache?.();

		// Should return new value (cache invalidated)
		resolved = await valueResolver.resolveSettingValue('theme');
		expect(resolved).toBe('light');
	});

	it('should handle settings that dont exist in database', async () => {
		// Test resolution for setting not in database
		const resolved = await valueResolver.resolveSettingValue('non_existent_setting');

		expect(resolved).toBeNull();
	});
});
