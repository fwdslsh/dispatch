/**
 * Unit tests for ConfigurationService
 */

import { describe, it, expect } from 'vitest';
import { ConfigurationService } from '$lib/server/shared/ConfigurationService.js';

describe('ConfigurationService', () => {
	describe('constructor', () => {
		it('should initialize with default values when no env provided', () => {
			const config = new ConfigurationService({});

			expect(config.get('TERMINAL_KEY')).toBe('change-me');
			expect(config.get('PORT')).toBe(3030);
			expect(config.get('WORKSPACES_ROOT')).toBe('/workspace');
			expect(config.get('ENABLE_TUNNEL')).toBe(false);
		});

		it('should parse environment variables correctly', () => {
			const env = {
				TERMINAL_KEY: 'test-key-12345',
				PORT: '5173',
				WORKSPACES_ROOT: '/custom/workspace',
				ENABLE_TUNNEL: 'true',
				LT_SUBDOMAIN: 'my-subdomain',
				HOST_UID: '1000',
				HOST_GID: '1000',
				HOME: '/home/user',
				DEBUG: '*'
			};

			const config = new ConfigurationService(env);

			expect(config.get('TERMINAL_KEY')).toBe('test-key-12345');
			expect(config.get('PORT')).toBe(5173);
			expect(config.get('WORKSPACES_ROOT')).toBe('/custom/workspace');
			expect(config.get('ENABLE_TUNNEL')).toBe(true);
			expect(config.get('LT_SUBDOMAIN')).toBe('my-subdomain');
			expect(config.get('HOST_UID')).toBe(1000);
			expect(config.get('HOST_GID')).toBe(1000);
			expect(config.get('HOME')).toBe('/home/user');
			expect(config.get('DEBUG')).toBe('*');
		});

		it('should handle partial environment variables', () => {
			const env = {
				TERMINAL_KEY: 'partial-key',
				PORT: '8080'
			};

			const config = new ConfigurationService(env);

			expect(config.get('TERMINAL_KEY')).toBe('partial-key');
			expect(config.get('PORT')).toBe(8080);
			expect(config.get('WORKSPACES_ROOT')).toBe('/workspace'); // default
			expect(config.get('ENABLE_TUNNEL')).toBe(false); // default
		});

		it('should parse boolean ENABLE_TUNNEL correctly', () => {
			const configTrue = new ConfigurationService({ ENABLE_TUNNEL: 'true' });
			const configFalse = new ConfigurationService({ ENABLE_TUNNEL: 'false' });
			const configEmpty = new ConfigurationService({});

			expect(configTrue.get('ENABLE_TUNNEL')).toBe(true);
			expect(configFalse.get('ENABLE_TUNNEL')).toBe(false);
			expect(configEmpty.get('ENABLE_TUNNEL')).toBe(false);
		});

		it('should parse integer values correctly', () => {
			const config = new ConfigurationService({
				PORT: '7173',
				HOST_UID: '2000',
				HOST_GID: '2000'
			});

			expect(config.get('PORT')).toBe(7173);
			expect(config.get('HOST_UID')).toBe(2000);
			expect(config.get('HOST_GID')).toBe(2000);
		});

		it('should handle invalid PORT gracefully', () => {
			const config = new ConfigurationService({ PORT: 'invalid' });

			expect(config.get('PORT')).toBe(3030); // Falls back to default when parseInt returns NaN
		});
	});

	describe('get', () => {
		it('should return configuration value for valid key', () => {
			const config = new ConfigurationService({ TERMINAL_KEY: 'test-key' });

			expect(config.get('TERMINAL_KEY')).toBe('test-key');
		});

		it('should return undefined for non-existent key', () => {
			const config = new ConfigurationService({});

			expect(config.get('NON_EXISTENT')).toBeUndefined();
		});
	});

	describe('getAll', () => {
		it('should return all configuration values', () => {
			const env = {
				TERMINAL_KEY: 'test-key',
				PORT: '5000'
			};

			const config = new ConfigurationService(env);
			const allConfig = config.getAll();

			expect(allConfig).toEqual({
				TERMINAL_KEY: 'test-key',
				PORT: 5000,
				WORKSPACES_ROOT: '/workspace',
				ENABLE_TUNNEL: false,
				LT_SUBDOMAIN: undefined,
				HOST_UID: undefined,
				HOST_GID: undefined,
				HOME: undefined,
				DEBUG: undefined
			});
		});

		it('should return a copy of config (not reference)', () => {
			const config = new ConfigurationService({ TERMINAL_KEY: 'test' });
			const config1 = config.getAll();
			const config2 = config.getAll();

			config1.TERMINAL_KEY = 'modified';

			expect(config2.TERMINAL_KEY).toBe('test'); // Original unchanged
			expect(config.get('TERMINAL_KEY')).toBe('test'); // Service unchanged
		});
	});

	describe('validate', () => {
		it('should throw error when TERMINAL_KEY is missing', () => {
			const config = new ConfigurationService({});

			expect(() => config.validate()).toThrow(
				'TERMINAL_KEY environment variable required in production'
			);
		});

		it('should throw error when TERMINAL_KEY is default value', () => {
			const config = new ConfigurationService({ TERMINAL_KEY: 'change-me' });

			expect(() => config.validate()).toThrow(
				'TERMINAL_KEY environment variable required in production'
			);
		});

		it('should not throw when TERMINAL_KEY is valid', () => {
			const config = new ConfigurationService({ TERMINAL_KEY: 'valid-key-12345' });

			expect(() => config.validate()).not.toThrow();
		});
	});
});
