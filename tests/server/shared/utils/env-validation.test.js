/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateEnvironment, validateEnvironmentOrThrow } from '../../../../src/lib/server/shared/utils/env-validation.js';

describe('Environment Validation', () => {
	// Helper to create test environment
	const createEnv = (overrides = {}) => ({
		NODE_ENV: 'development',
		...overrides
	});

	describe('Development Environment', () => {
		it('should pass validation with minimal development config', async () => {
			const env = createEnv();
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should warn about missing TERMINAL_KEY in development', async () => {
			const env = createEnv();
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('TERMINAL_KEY'))).toBe(true);
		});

		it('should warn about missing ENCRYPTION_KEY in development', async () => {
			const env = createEnv();
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('ENCRYPTION_KEY'))).toBe(true);
		});

		it('should accept valid PORT in development', async () => {
			const env = createEnv({ PORT: '3030' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should error on invalid PORT', async () => {
			const env = createEnv({ PORT: '99999' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('PORT'))).toBe(true);
		});
	});

	describe('Production Environment', () => {
		it('should require TERMINAL_KEY in production', async () => {
			const env = createEnv({ NODE_ENV: 'production' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('TERMINAL_KEY'))).toBe(true);
		});

		it('should require ENCRYPTION_KEY in production', async () => {
			const env = createEnv({ NODE_ENV: 'production' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('ENCRYPTION_KEY'))).toBe(true);
		});

		it('should require PUBLIC_BASE_URL in production', async () => {
			const env = createEnv({ NODE_ENV: 'production' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('PUBLIC_BASE_URL'))).toBe(true);
		});

		it('should pass with all required production variables', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should warn about weak TERMINAL_KEY patterns', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'testkey12345',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('weak pattern'))).toBe(true);
		});

		it('should warn about short TERMINAL_KEY', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'short',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('too short'))).toBe(true);
		});

		it('should require HTTPS for PUBLIC_BASE_URL in production', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'http://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('HTTPS'))).toBe(true);
		});

		it('should error on invalid PUBLIC_BASE_URL', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'not-a-valid-url'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.includes('not a valid URL'))).toBe(true);
		});
	});

	describe('Optional Configuration', () => {
		it('should warn about invalid LOG_LEVEL', async () => {
			const env = createEnv({ DISPATCH_LOG_LEVEL: 'invalid' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('LOG_LEVEL'))).toBe(true);
		});

		it('should accept valid LOG_LEVEL values', async () => {
			const validLevels = ['error', 'warn', 'info', 'debug'];

			for (const level of validLevels) {
				const env = createEnv({ DISPATCH_LOG_LEVEL: level });
				const result = await validateEnvironment(env);

				expect(result.valid).toBe(true);
				expect(result.warnings.some((w) => w.includes('LOG_LEVEL'))).toBe(false);
			}
		});

		it('should warn about unset WORKSPACES_ROOT', async () => {
			const env = createEnv();
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('WORKSPACES_ROOT'))).toBe(true);
		});

		it('should warn when ENABLE_TUNNEL is true but PORT is not set', async () => {
			const env = createEnv({ ENABLE_TUNNEL: 'true' });
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('LocalTunnel'))).toBe(true);
		});
	});

	describe('validateEnvironmentOrThrow', () => {
		it('should not throw for valid environment', async () => {
			const env = createEnv();

			await expect(validateEnvironmentOrThrow(env)).resolves.not.toThrow();
		});

		it('should throw for invalid environment', async () => {
			const env = createEnv({
				NODE_ENV: 'production'
				// Missing required production variables
			});

			await expect(validateEnvironmentOrThrow(env)).rejects.toThrow(
				'Environment validation failed'
			);
		});

		it('should include error details in thrown error', async () => {
			const env = createEnv({
				NODE_ENV: 'production'
			});

			try {
				await validateEnvironmentOrThrow(env);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error.message).toContain('TERMINAL_KEY');
				expect(error.message).toContain('ENCRYPTION_KEY');
				expect(error.message).toContain('PUBLIC_BASE_URL');
			}
		});
	});

	describe('ENCRYPTION_KEY Validation', () => {
		it('should accept 44-character base64 key (standard padding)', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('ENCRYPTION_KEY length'))).toBe(false);
		});

		it('should accept 43-character URL-safe base64 key (no padding)', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb24',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('ENCRYPTION_KEY length'))).toBe(false);
		});

		it('should warn about incorrect key length', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'too-short',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('ENCRYPTION_KEY length'))).toBe(true);
		});

		it('should error on non-base64 characters', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'not@valid#base64!characters',
				PUBLIC_BASE_URL: 'https://dispatch.example.com'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('valid base64'))).toBe(true);
		});
	});

	describe('URL Validation', () => {
		it('should allow localhost with http in production', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'http://localhost:3030'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('HTTPS'))).toBe(false);
		});

		it('should warn about trailing slash in PUBLIC_BASE_URL', async () => {
			const env = createEnv({
				NODE_ENV: 'production',
				TERMINAL_KEY: 'a-very-strong-and-long-key-for-production-use',
				ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
				PUBLIC_BASE_URL: 'https://dispatch.example.com/'
			});
			const result = await validateEnvironment(env);

			expect(result.valid).toBe(true);
			expect(result.warnings.some((w) => w.includes('trailing slash'))).toBe(true);
		});
	});
});
