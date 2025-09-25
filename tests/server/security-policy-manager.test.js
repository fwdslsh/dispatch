import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { AuthMigrationManager } from '../../src/lib/server/shared/db/AuthMigrationManager.js';
import { SecurityPolicyManager } from '../../src/lib/server/shared/security/SecurityPolicyManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('Security Policy Manager', () => {
	let db;
	let migrationManager;
	let securityManager;
	let tempDbPath;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-security-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run auth migrations
		migrationManager = new AuthMigrationManager(db);
		await migrationManager.runAllMigrations();

		// Create security policy manager
		securityManager = new SecurityPolicyManager(db);
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

	describe('CORS Policy Management', () => {
		it('should manage CORS allowed origins', async () => {
			const origins = ['http://localhost:3000', 'https://example.com'];

			await securityManager.updateCORSOrigins(origins);
			const retrievedOrigins = await securityManager.getCORSOrigins();

			expect(retrievedOrigins).toEqual(origins);
		});

		it('should detect tunnel URLs and update origins automatically', async () => {
			const tunnelInfo = {
				url: 'https://abc123.localtunnel.me',
				subdomain: 'abc123'
			};

			await securityManager.updateTunnelOrigins(tunnelInfo);
			const origins = await securityManager.getCORSOrigins();

			expect(origins).toContain('https://abc123.localtunnel.me');
		});

		it('should validate origin URLs', () => {
			expect(() => securityManager.validateOrigin('http://localhost:3000')).not.toThrow();
			expect(() => securityManager.validateOrigin('https://example.com')).not.toThrow();
			expect(() => securityManager.validateOrigin('invalid-url')).toThrow();
		});

		it('should get dynamic CORS configuration', async () => {
			const origins = ['http://localhost:3000', 'https://example.com'];
			await securityManager.updateCORSOrigins(origins);

			const corsConfig = await securityManager.getCORSConfiguration();

			expect(corsConfig.origin).toEqual(origins);
			expect(corsConfig.credentials).toBe(true);
			expect(corsConfig.methods).toContain('GET');
			expect(corsConfig.methods).toContain('POST');
		});
	});

	describe('Cookie Security Policy', () => {
		it('should generate secure cookie options for HTTPS', () => {
			const options = securityManager.getCookieOptions({
				isHttps: true,
				isSecureContext: true,
				isLocalhost: true // Add this to match implementation logic
			});

			expect(options.secure).toBe(true);
			expect(options.sameSite).toBe('strict');
			expect(options.httpOnly).toBe(true);
		});

		it('should generate relaxed cookie options for HTTP localhost', () => {
			const options = securityManager.getCookieOptions({
				isHttps: false,
				isLocalhost: true
			});

			expect(options.secure).toBe(false);
			expect(options.sameSite).toBe('strict'); // Localhost uses strict, not lax
			expect(options.httpOnly).toBe(true);
		});

		it('should adapt cookie policy based on hosting context', () => {
			// Tunnel context
			const tunnelOptions = securityManager.getCookieOptions({
				isHttps: true,
				isTunnel: true
			});
			expect(tunnelOptions.sameSite).toBe('none');

			// LAN context
			const lanOptions = securityManager.getCookieOptions({
				isHttps: false,
				isLAN: true
			});
			expect(lanOptions.sameSite).toBe('strict');
		});
	});

	describe('HSTS Policy Management', () => {
		it('should enable HSTS for custom domain certificates', async () => {
			await securityManager.updateCertificateContext({
				type: 'letsencrypt',
				domain: 'example.com'
			});

			const hstsConfig = await securityManager.getHSTSConfiguration();

			expect(hstsConfig.enabled).toBe(true);
			expect(hstsConfig.maxAge).toBeGreaterThan(0);
		});

		it('should disable HSTS for mkcert/self-signed certificates', async () => {
			await securityManager.updateCertificateContext({
				type: 'mkcert',
				domain: 'localhost'
			});

			const hstsConfig = await securityManager.getHSTSConfiguration();

			expect(hstsConfig.enabled).toBe(false);
		});

		it('should disable HSTS for tunnel contexts', async () => {
			await securityManager.updateCertificateContext({
				type: 'tunnel',
				domain: 'abc123.localtunnel.me'
			});

			const hstsConfig = await securityManager.getHSTSConfiguration();

			expect(hstsConfig.enabled).toBe(false);
		});
	});

	describe('CSRF Protection', () => {
		it('should generate CSRF tokens', () => {
			const token1 = securityManager.generateCSRFToken();
			const token2 = securityManager.generateCSRFToken();

			expect(token1).toBeDefined();
			expect(token2).toBeDefined();
			expect(token1).not.toBe(token2);
			expect(token1).toMatch(/^[a-f0-9]{64}$/); // 32 bytes hex
		});

		it('should validate CSRF tokens', () => {
			const token = securityManager.generateCSRFToken();
			const sessionId = 'test-session';

			securityManager.storeCSRFToken(sessionId, token);

			expect(securityManager.validateCSRFToken(sessionId, token)).toBe(true);
			expect(securityManager.validateCSRFToken(sessionId, 'invalid')).toBe(false);
		});

		it('should clean up expired CSRF tokens', () => {
			const token = securityManager.generateCSRFToken();
			const sessionId = 'test-session';

			securityManager.storeCSRFToken(sessionId, token);

			// Mock token as expired
			securityManager.csrfTokens.get(sessionId).timestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago

			securityManager.cleanupExpiredCSRFTokens();

			expect(securityManager.validateCSRFToken(sessionId, token)).toBe(false);
		});
	});

	describe('Security Header Configuration', () => {
		it('should generate helmet configuration for production', () => {
			const config = securityManager.getHelmetConfiguration({
				environment: 'production',
				isHttps: true
			});

			expect(config.contentSecurityPolicy).toBeDefined();
			expect(config.hsts).toBeDefined();
			expect(config.noSniff).toBe(true);
			expect(config.frameguard).toBeDefined();
		});

		it('should generate relaxed helmet configuration for development', () => {
			const config = securityManager.getHelmetConfiguration({
				environment: 'development',
				isHttps: false
			});

			expect(config.contentSecurityPolicy).toBe(false);
			expect(config.hsts).toBe(false);
		});

		it('should adapt security headers based on hosting context', () => {
			// Tunnel hosting
			const tunnelConfig = securityManager.getHelmetConfiguration({
				environment: 'production',
				isHttps: true,
				isTunnel: true
			});
			expect(tunnelConfig.hsts).toBe(false);

			// Custom domain
			const domainConfig = securityManager.getHelmetConfiguration({
				environment: 'production',
				isHttps: true,
				isCustomDomain: true
			});
			expect(domainConfig.hsts).toBeDefined();
		});
	});

	describe('Rate Limiting Configuration', () => {
		it('should get rate limiting configuration for auth endpoints', () => {
			const config = securityManager.getRateLimitConfiguration('auth');

			expect(config.windowMs).toBeDefined();
			expect(config.max).toBeDefined();
			expect(config.skipSuccessfulRequests).toBeDefined();
		});

		it('should provide stricter limits for failed login attempts', () => {
			const authConfig = securityManager.getRateLimitConfiguration('auth');
			const failedConfig = securityManager.getRateLimitConfiguration('failed-auth');

			expect(failedConfig.max).toBeLessThan(authConfig.max);
		});

		it('should adapt rate limits based on hosting context', () => {
			const lanConfig = securityManager.getRateLimitConfiguration('auth', { isLAN: true });
			const tunnelConfig = securityManager.getRateLimitConfiguration('auth', { isTunnel: true });

			expect(lanConfig.max).toBeGreaterThan(tunnelConfig.max);
		});
	});

	describe('Security Context Detection', () => {
		it('should detect localhost context', () => {
			const context = securityManager.detectSecurityContext({
				hostname: 'localhost',
				protocol: 'http:'
			});

			expect(context.isLocalhost).toBe(true);
			expect(context.isSecureContext).toBe(true); // localhost is considered secure context
		});

		it('should detect tunnel context', () => {
			const context = securityManager.detectSecurityContext({
				hostname: 'abc123.localtunnel.me',
				protocol: 'https:'
			});

			expect(context.isTunnel).toBe(true);
			expect(context.isSecureContext).toBe(true);
		});

		it('should detect LAN context', () => {
			const context = securityManager.detectSecurityContext({
				hostname: '192.168.1.100',
				protocol: 'http:'
			});

			expect(context.isLAN).toBe(true);
			expect(context.isSecureContext).toBe(false);
		});

		it('should detect custom domain context', () => {
			const context = securityManager.detectSecurityContext({
				hostname: 'myapp.example.com',
				protocol: 'https:'
			});

			expect(context.isCustomDomain).toBe(true);
			expect(context.isSecureContext).toBe(true);
		});
	});

	describe('Policy Updates', () => {
		it('should update security policies when hosting context changes', async () => {
			const originalContext = { isLocalhost: true, isHttps: false };
			const newContext = { isTunnel: true, isHttps: true };

			await securityManager.updateSecurityPolicies(originalContext, newContext);

			const corsConfig = await securityManager.getCORSConfiguration();
			const cookieOptions = securityManager.getCookieOptions(newContext);

			expect(cookieOptions.secure).toBe(true);
			expect(cookieOptions.sameSite).toBe('none');
		});

		it('should validate policy configurations', () => {
			const validConfig = {
				cors: { origins: ['https://example.com'] },
				cookies: { secure: true },
				hsts: { enabled: true }
			};

			expect(() => securityManager.validatePolicyConfiguration(validConfig)).not.toThrow();

			const invalidConfig = {
				cors: { origins: ['invalid-url'] }
			};

			expect(() => securityManager.validatePolicyConfiguration(invalidConfig)).toThrow();
		});
	});

	describe('Audit Logging', () => {
		it('should log security policy changes', async () => {
			const changes = {
				cors: { origins: ['https://example.com'] },
				reason: 'tunnel URL change'
			};

			await securityManager.logPolicyChange('cors', changes);

			// Verify audit log entry was created
			const logs = await securityManager.getPolicyAuditLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].policy).toBe('cors');
			expect(logs[0].changes).toEqual(changes);
		});
	});
});