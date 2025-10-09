/**
 * Integration Test: JWT Auth Flow (T050)
 * Tests complete authentication flow: TERMINAL_KEY → JWT → validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '$lib/server/database/DatabaseManager.js';
import { SettingsRepository } from '$lib/server/database/SettingsRepository.js';
import { JWTService } from '$lib/server/auth/JWTService.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('JWT Auth Flow Integration', () => {
	let tempDir;
	let db;
	let settingsRepo;
	let jwtService;
	const TEST_TERMINAL_KEY = 'test-key-12345';

	beforeEach(async () => {
		// Setup test database
		tempDir = await mkdtemp(join(tmpdir(), 'dispatch-test-'));
		const dbPath = join(tempDir, 'test.db');
		db = new DatabaseManager({ dbPath });
		await db.init();

		// Setup repositories and services
		settingsRepo = new SettingsRepository(db);
		await settingsRepo.initializeDefaults();

		// Initialize JWTService with test key
		jwtService = new JWTService(TEST_TERMINAL_KEY);
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	describe('Complete Auth Flow', () => {
		it('should complete full flow: key → token → validation', () => {
			// Step 1: User provides TERMINAL_KEY
			const terminalKey = TEST_TERMINAL_KEY;

			// Step 2: Generate JWT token from key
			const payload = {
				userId: 'test-user',
				sessionId: 'test-session',
				timestamp: Date.now()
			};

			const token = jwtService.generateToken(payload);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

			// Step 3: Validate JWT token
			const decoded = jwtService.validateToken(token);

			expect(decoded).toBeDefined();
			expect(decoded.userId).toBe('test-user');
			expect(decoded.sessionId).toBe('test-session');
			expect(decoded.timestamp).toBe(payload.timestamp);

			// Verify JWT metadata
			expect(decoded).toHaveProperty('iat'); // Issued at
			expect(decoded).toHaveProperty('exp'); // Expires
		});

		it('should reject invalid terminal key', () => {
			// Generate token with correct key
			const token = jwtService.generateToken({ userId: 'test' });

			// Try to validate with wrong key
			const wrongKeyService = new JWTService('wrong-key-67890');

			expect(() => {
				wrongKeyService.validateToken(token);
			}).toThrow();
		});

		it('should handle token expiration metadata', () => {
			// Verify tokens include proper expiration metadata
			const token = jwtService.generateToken({ userId: 'test' });

			const decoded = jwtService.validateToken(token);

			// Verify expiration metadata is present
			expect(decoded.exp).toBeDefined();
			expect(decoded.iat).toBeDefined();

			// Expiration should be in the future
			expect(decoded.exp).toBeGreaterThan(decoded.iat);

			// Verify expiration is reasonable (should be days/weeks, not seconds)
			const expiresIn = decoded.exp - decoded.iat;
			expect(expiresIn).toBeGreaterThan(86400); // At least 1 day
		});

		it('should support token refresh flow', async () => {
			// Step 1: Generate initial token with short expiration
			const originalPayload = {
				userId: 'test-user',
				data: 'important-data'
			};

			const originalToken = jwtService.generateToken(originalPayload, '1s');
			const originalDecoded = jwtService.validateToken(originalToken);

			// Wait a moment to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Step 2: Refresh token (creates new token with extended expiration)
			const refreshedToken = jwtService.refreshToken(originalToken);

			// Step 3: Validate refreshed token
			const refreshedDecoded = jwtService.validateToken(refreshedToken);

			// Verify payload preserved
			expect(refreshedDecoded.userId).toBe('test-user');
			expect(refreshedDecoded.data).toBe('important-data');

			// Verify issued at is newer
			expect(refreshedDecoded.iat).toBeGreaterThanOrEqual(originalDecoded.iat);

			// Verify new expiration (30 days from refresh, should be >= original)
			expect(refreshedDecoded.exp).toBeGreaterThanOrEqual(originalDecoded.exp);
		});
	});

	describe('Multi-User Auth Scenarios', () => {
		it('should support multiple concurrent users with different tokens', () => {
			const users = [
				{ userId: 'user-1', role: 'admin' },
				{ userId: 'user-2', role: 'developer' },
				{ userId: 'user-3', role: 'viewer' }
			];

			// Generate tokens for all users
			const tokens = users.map((user) => ({
				user,
				token: jwtService.generateToken(user)
			}));

			// Validate all tokens independently
			tokens.forEach(({ user, token }) => {
				const decoded = jwtService.validateToken(token);

				expect(decoded.userId).toBe(user.userId);
				expect(decoded.role).toBe(user.role);
			});

			// Verify tokens are unique
			const tokenStrings = tokens.map((t) => t.token);
			const uniqueTokens = new Set(tokenStrings);
			expect(uniqueTokens.size).toBe(users.length);
		});

		it('should isolate tokens between users', () => {
			const user1Token = jwtService.generateToken({ userId: 'user-1', secret: 'data-1' });
			const user2Token = jwtService.generateToken({ userId: 'user-2', secret: 'data-2' });

			// Decode tokens
			const user1Data = jwtService.validateToken(user1Token);
			const user2Data = jwtService.validateToken(user2Token);

			// Verify isolation
			expect(user1Data.secret).toBe('data-1');
			expect(user2Data.secret).toBe('data-2');
			expect(user1Data.secret).not.toBe(user2Data.secret);
		});
	});

	describe('Settings Integration', () => {
		it('should store and retrieve terminal key from settings', async () => {
			// Store terminal key in settings
			await settingsRepo.updateInCategory('global', 'terminal_key', TEST_TERMINAL_KEY);

			// Retrieve from settings
			const settings = await settingsRepo.getByCategory('global');
			const storedKey = settings.terminal_key;

			expect(storedKey).toBe(TEST_TERMINAL_KEY);

			// Use retrieved key to create JWT service
			const serviceFromSettings = new JWTService(storedKey);

			// Verify it works
			const token = serviceFromSettings.generateToken({ test: true });
			const decoded = serviceFromSettings.validateToken(token);

			expect(decoded.test).toBe(true);
		});

		it('should handle missing terminal key in settings', async () => {
			// Check default settings
			const settings = await settingsRepo.getByCategory('global');

			// Terminal key may not be in defaults
			if (!settings.terminal_key) {
				expect(settings.terminal_key).toBeUndefined();
			}
		});
	});

	describe('Error Handling', () => {
		it('should reject malformed tokens', () => {
			const malformedTokens = [
				'not.a.token',
				'invalid-token',
				'',
				'a.b', // Only 2 parts
				'a.b.c.d' // Too many parts
			];

			malformedTokens.forEach((token) => {
				expect(() => {
					jwtService.validateToken(token);
				}).toThrow();
			});
		});

		it('should reject tokens with tampered payload', () => {
			const token = jwtService.generateToken({ userId: 'test' });

			// Split token parts
			const [header, payload, signature] = token.split('.');

			// Tamper with payload (change userId)
			const tamperedPayload = Buffer.from(
				JSON.stringify({ userId: 'hacker', iat: Date.now() })
			).toString('base64url');

			const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

			// Should fail validation
			expect(() => {
				jwtService.validateToken(tamperedToken);
			}).toThrow();
		});

		it('should handle empty or null payloads gracefully', () => {
			// Empty payload should work (JWT allows it)
			const emptyToken = jwtService.generateToken({});
			const decoded = jwtService.validateToken(emptyToken);

			expect(decoded).toBeDefined();
			expect(decoded).toHaveProperty('iat');
			expect(decoded).toHaveProperty('exp');
		});
	});

	describe('Token Lifecycle', () => {
		it('should track token creation and expiration times', () => {
			const beforeGeneration = Math.floor(Date.now() / 1000);

			const token = jwtService.generateToken({ userId: 'test' });
			const decoded = jwtService.validateToken(token);

			const afterGeneration = Math.floor(Date.now() / 1000);

			// Issued at should be within the time window
			expect(decoded.iat).toBeGreaterThanOrEqual(beforeGeneration);
			expect(decoded.iat).toBeLessThanOrEqual(afterGeneration);

			// Expiration should be 30 days from now (default)
			const expectedExpiration = decoded.iat + 30 * 24 * 60 * 60;
			expect(decoded.exp).toBe(expectedExpiration);
		});

		it('should support custom expiration times', () => {
			const expirations = ['1h', '7d', '90d'];

			expirations.forEach((expiration) => {
				const token = jwtService.generateToken({ userId: 'test' }, expiration);
				const decoded = jwtService.validateToken(token);

				expect(decoded.exp).toBeGreaterThan(decoded.iat);
			});
		});

		it('should maintain token validity and lifecycle', () => {
			// Generate token
			const token = jwtService.generateToken({ userId: 'test' });

			// Should be valid immediately
			const decoded = jwtService.validateToken(token);
			expect(decoded.userId).toBe('test');

			// Verify expiration is in the future
			const now = Math.floor(Date.now() / 1000);
			expect(decoded.exp).toBeGreaterThan(now);
			expect(decoded.iat).toBeLessThanOrEqual(now);

			// Verify token remains valid for multiple validations
			const decoded2 = jwtService.validateToken(token);
			expect(decoded2.userId).toBe('test');
			expect(decoded2.exp).toBe(decoded.exp); // Same token, same expiration
		});
	});

	describe('Security Features', () => {
		it('should use different signatures for different keys', () => {
			const payload = { userId: 'test', data: 'same' };

			const service1 = new JWTService('key-1');
			const service2 = new JWTService('key-2');

			const token1 = service1.generateToken(payload);
			const token2 = service2.generateToken(payload);

			// Tokens should be different (different signatures)
			expect(token1).not.toBe(token2);

			// Each service can only validate its own tokens
			expect(() => service1.validateToken(token2)).toThrow();
			expect(() => service2.validateToken(token1)).toThrow();
		});

		it('should include standard JWT claims', () => {
			const token = jwtService.generateToken({ userId: 'test' });
			const decoded = jwtService.validateToken(token);

			// Standard claims
			expect(decoded).toHaveProperty('iat'); // Issued at
			expect(decoded).toHaveProperty('exp'); // Expires

			// Custom payload
			expect(decoded).toHaveProperty('userId');
		});

		it('should prevent token reuse after key rotation', () => {
			const oldKey = 'old-key-12345';
			const newKey = 'new-key-67890';

			const oldService = new JWTService(oldKey);
			const newService = new JWTService(newKey);

			// Generate token with old key
			const oldToken = oldService.generateToken({ userId: 'test' });

			// Old token should work with old service
			expect(() => oldService.validateToken(oldToken)).not.toThrow();

			// Old token should fail with new service (after key rotation)
			expect(() => newService.validateToken(oldToken)).toThrow();

			// New tokens from new service should work
			const newToken = newService.generateToken({ userId: 'test' });
			expect(() => newService.validateToken(newToken)).not.toThrow();
		});
	});

	describe('Payload Validation', () => {
		it('should preserve complex payload structures', () => {
			const complexPayload = {
				userId: 'test-user',
				roles: ['admin', 'developer'],
				permissions: {
					sessions: ['create', 'read', 'delete'],
					workspaces: ['read', 'write']
				},
				metadata: {
					lastLogin: Date.now(),
					loginCount: 42
				}
			};

			const token = jwtService.generateToken(complexPayload);
			const decoded = jwtService.validateToken(token);

			// Verify all fields preserved
			expect(decoded.userId).toBe('test-user');
			expect(decoded.roles).toEqual(['admin', 'developer']);
			expect(decoded.permissions.sessions).toEqual(['create', 'read', 'delete']);
			expect(decoded.metadata.loginCount).toBe(42);
		});

		it('should handle special characters in payload', () => {
			const payload = {
				userId: 'user@example.com',
				name: 'Test User (Admin)',
				description: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?'
			};

			const token = jwtService.generateToken(payload);
			const decoded = jwtService.validateToken(token);

			expect(decoded.userId).toBe('user@example.com');
			expect(decoded.name).toBe('Test User (Admin)');
			expect(decoded.description).toBe(payload.description);
		});
	});
});
