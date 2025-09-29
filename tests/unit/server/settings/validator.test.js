/**
 * Unit tests for SettingsValidator service
 * Tests validation logic for different setting types and constraints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsValidator } from '../../../../src/lib/server/settings/SettingsValidator.js';
import { ConfigurationSetting } from '../../../../src/lib/server/settings/ConfigurationSetting.js';

describe('SettingsValidator', () => {
	let validator;

	beforeEach(() => {
		validator = new SettingsValidator();
	});

	describe('validateSetting - Terminal Key', () => {
		let terminalKeySetting;

		beforeEach(() => {
			terminalKeySetting = new ConfigurationSetting({
				key: 'terminal_key',
				category_id: 'authentication',
				name: 'Terminal Key',
				description: 'Authentication key for terminal access',
				type: 'string',
				is_sensitive: true,
				is_required: true
			});
		});

		it('should accept valid terminal key with minimum length', () => {
			const result = validator.validateSetting(terminalKeySetting, 'testkey12345');
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject terminal key shorter than 12 characters', () => {
			const result = validator.validateSetting(terminalKeySetting, 'short');
			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Terminal key must be at least 12 characters long');
		});

		it('should reject terminal key with weak patterns', () => {
			const result = validator.validateSetting(terminalKeySetting, 'password1234');
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('security'))).toBe(true);
		});

		it('should reject terminal key with default value', () => {
			const result = validator.validateSetting(terminalKeySetting, 'change-me');
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('default'))).toBe(true);
		});

		it('should warn about common weak passwords', () => {
			const result = validator.validateSetting(terminalKeySetting, 'admin1234567');
			expect(result.warnings.length).toBeGreaterThan(0);
		});
	});

	describe('validateSetting - OAuth Client ID', () => {
		let oauthClientIdSetting;

		beforeEach(() => {
			oauthClientIdSetting = new ConfigurationSetting({
				key: 'oauth_client_id',
				category_id: 'authentication',
				name: 'OAuth Client ID',
				description: 'OAuth application client ID',
				type: 'string',
				is_sensitive: false,
				is_required: false
			});
		});

		it('should accept valid OAuth client ID', () => {
			const result = validator.validateSetting(
				oauthClientIdSetting,
				'abc123-def456-ghi789'
			);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should accept empty value for optional setting', () => {
			const result = validator.validateSetting(oauthClientIdSetting, '');
			expect(result.valid).toBe(true);
		});

		it('should reject client ID with invalid characters', () => {
			const result = validator.validateSetting(oauthClientIdSetting, 'invalid<>client');
			expect(result.valid).toBe(false);
		});

		it('should reject client ID that is too short', () => {
			const result = validator.validateSetting(oauthClientIdSetting, 'abc');
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('at least'))).toBe(true);
		});
	});

	describe('validateSetting - OAuth Redirect URI', () => {
		let redirectUriSetting;

		beforeEach(() => {
			redirectUriSetting = new ConfigurationSetting({
				key: 'oauth_redirect_uri',
				category_id: 'authentication',
				name: 'OAuth Redirect URI',
				description: 'OAuth callback URL',
				type: 'url',
				is_sensitive: false,
				is_required: false
			});
		});

		it('should accept valid HTTPS redirect URI', () => {
			const result = validator.validateSetting(
				redirectUriSetting,
				'https://example.com/auth/callback'
			);
			expect(result.valid).toBe(true);
		});

		it('should accept localhost HTTP for development', () => {
			const result = validator.validateSetting(
				redirectUriSetting,
				'http://localhost:3000/callback'
			);
			expect(result.valid).toBe(true);
		});

		it('should warn about HTTP in production', () => {
			const result = validator.validateSetting(
				redirectUriSetting,
				'http://example.com/callback'
			);
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings.some((w) => w.includes('HTTPS'))).toBe(true);
		});

		it('should reject invalid URL format', () => {
			const result = validator.validateSetting(redirectUriSetting, 'not-a-url');
			expect(result.valid).toBe(false);
		});

		it('should reject redirect URI with query parameters', () => {
			const result = validator.validateSetting(
				redirectUriSetting,
				'https://example.com/callback?param=value'
			);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('query'))).toBe(true);
		});
	});

	describe('validateSetting - Workspaces Root', () => {
		let workspacesRootSetting;

		beforeEach(() => {
			workspacesRootSetting = new ConfigurationSetting({
				key: 'workspaces_root',
				category_id: 'workspace',
				name: 'Workspaces Root',
				description: 'Root directory for workspaces',
				type: 'path',
				is_sensitive: false,
				is_required: true
			});
		});

		it('should accept valid absolute path', () => {
			const result = validator.validateSetting(workspacesRootSetting, '/home/user/workspaces');
			expect(result.valid).toBe(true);
		});

		it('should reject relative path', () => {
			const result = validator.validateSetting(workspacesRootSetting, './workspaces');
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('absolute'))).toBe(true);
		});

		it('should reject path with invalid characters', () => {
			const result = validator.validateSetting(workspacesRootSetting, '/home/user/<invalid>');
			expect(result.valid).toBe(false);
		});

		it('should accept path with spaces when properly formatted', () => {
			const result = validator.validateSetting(
				workspacesRootSetting,
				'/home/user/my workspaces'
			);
			expect(result.valid).toBe(true);
		});
	});

	describe('validateSetting - OAuth Scope', () => {
		let scopeSetting;

		beforeEach(() => {
			scopeSetting = new ConfigurationSetting({
				key: 'oauth_scope',
				category_id: 'authentication',
				name: 'OAuth Scope',
				description: 'OAuth permission scopes',
				type: 'string',
				is_sensitive: false,
				is_required: false
			});
		});

		it('should accept valid space-separated scopes', () => {
			const result = validator.validateSetting(scopeSetting, 'read write admin');
			expect(result.valid).toBe(true);
		});

		it('should accept single scope', () => {
			const result = validator.validateSetting(scopeSetting, 'read');
			expect(result.valid).toBe(true);
		});

		it('should accept empty scope for optional setting', () => {
			const result = validator.validateSetting(scopeSetting, '');
			expect(result.valid).toBe(true);
		});

		it('should reject scope with invalid characters', () => {
			const result = validator.validateSetting(scopeSetting, 'read<>write');
			expect(result.valid).toBe(false);
		});
	});

	describe('validateSetting - Required fields', () => {
		let requiredSetting;

		beforeEach(() => {
			requiredSetting = new ConfigurationSetting({
				key: 'required_field',
				category_id: 'test',
				name: 'Required Field',
				description: 'A required field',
				type: 'string',
				is_sensitive: false,
				is_required: true
			});
		});

		it('should reject empty value for required setting', () => {
			const result = validator.validateSetting(requiredSetting, '');
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('required'))).toBe(true);
		});

		it('should reject null value for required setting', () => {
			const result = validator.validateSetting(requiredSetting, null);
			expect(result.valid).toBe(false);
		});

		it('should reject whitespace-only value for required setting', () => {
			const result = validator.validateSetting(requiredSetting, '   ');
			expect(result.valid).toBe(false);
		});

		it('should accept non-empty value for required setting', () => {
			const result = validator.validateSetting(requiredSetting, 'valid value');
			expect(result.valid).toBe(true);
		});
	});

	describe('validateCategorySettings', () => {
		it('should validate multiple settings at once', () => {
			const settings = [
				new ConfigurationSetting({
					key: 'setting1',
					category_id: 'test',
					name: 'Setting 1',
					description: 'Test setting 1',
					type: 'string',
					is_required: true
				}),
				new ConfigurationSetting({
					key: 'setting2',
					category_id: 'test',
					name: 'Setting 2',
					description: 'Test setting 2',
					type: 'string',
					is_required: false
				})
			];

			const values = {
				setting1: 'valid value',
				setting2: ''
			};

			const result = validator.validateCategorySettings(settings, values);

			expect(result.valid).toBe(true);
			expect(result.results).toHaveLength(2);
			expect(result.results[0].valid).toBe(true);
			expect(result.results[1].valid).toBe(true);
		});

		it('should return validation errors for invalid settings', () => {
			const settings = [
				new ConfigurationSetting({
					key: 'required_field',
					category_id: 'test',
					name: 'Required Field',
					description: 'Required field',
					type: 'string',
					is_required: true
				})
			];

			const values = {
				required_field: ''
			};

			const result = validator.validateCategorySettings(settings, values);

			expect(result.valid).toBe(false);
			expect(result.results[0].valid).toBe(false);
			expect(result.results[0].errors.length).toBeGreaterThan(0);
		});

		it('should collect all errors and warnings', () => {
			const settings = [
				new ConfigurationSetting({
					key: 'terminal_key',
					category_id: 'auth',
					name: 'Terminal Key',
					description: 'Key',
					type: 'string',
					is_required: true,
					is_sensitive: true
				}),
				new ConfigurationSetting({
					key: 'oauth_redirect_uri',
					category_id: 'auth',
					name: 'Redirect URI',
					description: 'URI',
					type: 'url',
					is_required: false
				})
			];

			const values = {
				terminal_key: 'short',
				oauth_redirect_uri: 'http://example.com/callback'
			};

			const result = validator.validateCategorySettings(settings, values);

			expect(result.valid).toBe(false);
			expect(result.allErrors.length).toBeGreaterThan(0);
			expect(result.allWarnings.length).toBeGreaterThan(0);
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle null setting gracefully', () => {
			const result = validator.validateSetting(null, 'value');
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('Invalid'))).toBe(true);
		});

		it('should handle undefined value', () => {
			const setting = new ConfigurationSetting({
				key: 'test',
				category_id: 'test',
				name: 'Test',
				description: 'Test',
				type: 'string',
				is_required: false
			});

			const result = validator.validateSetting(setting, undefined);
			expect(result.valid).toBe(true);
		});

		it('should handle extremely long values', () => {
			const setting = new ConfigurationSetting({
				key: 'test',
				category_id: 'test',
				name: 'Test',
				description: 'Test',
				type: 'string',
				is_required: false
			});

			const longValue = 'a'.repeat(10000);
			const result = validator.validateSetting(setting, longValue);

			// Should have warning about length
			expect(result.warnings.length).toBeGreaterThan(0);
		});

		it('should handle special characters in values', () => {
			const setting = new ConfigurationSetting({
				key: 'test',
				category_id: 'test',
				name: 'Test',
				description: 'Test',
				type: 'string',
				is_required: false
			});

			const specialValue = 'value with 特殊 characters @#$%';
			const result = validator.validateSetting(setting, specialValue);

			expect(result).toBeDefined();
			expect(result.valid).toBeDefined();
		});
	});

	describe('Performance', () => {
		it('should validate settings quickly', () => {
			const setting = new ConfigurationSetting({
				key: 'test',
				category_id: 'test',
				name: 'Test',
				description: 'Test',
				type: 'string',
				is_required: false
			});

			const start = Date.now();

			for (let i = 0; i < 1000; i++) {
				validator.validateSetting(setting, `test_value_${i}`);
			}

			const duration = Date.now() - start;

			// Should complete 1000 validations in less than 100ms
			expect(duration).toBeLessThan(100);
		});
	});
});