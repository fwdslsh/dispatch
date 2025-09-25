import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { AuthMigrationManager } from '../../src/lib/server/shared/db/AuthMigrationManager.js';
import { OAuthAdapter } from '../../src/lib/server/shared/auth/adapters/OAuthAdapter.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('OAuth Adapter', () => {
	let db;
	let migrationManager;
	let oauthAdapter;
	let tempDbPath;
	let testUserId;
	let mockRequest;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-oauth-adapter-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run auth migrations
		migrationManager = new AuthMigrationManager(db);
		await migrationManager.runAllMigrations();

		// Create OAuth adapter
		oauthAdapter = new OAuthAdapter(db, null);

		// Create a test user
		const userResult = await db.run(`
			INSERT INTO users (username, display_name, email, password_hash, is_admin)
			VALUES ('testuser', 'Test User', 'test@example.com', 'hashed_password', 0)
		`);
		testUserId = userResult.lastID;

		// Mock request object
		mockRequest = {
			headers: {
				host: 'localhost:3000'
			},
			protocol: 'http'
		};
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

	describe('Adapter Interface', () => {
		it('should implement adapter interface correctly', () => {
			expect(oauthAdapter.name).toBe('oauth');
			expect(oauthAdapter.displayName).toBe('OAuth Provider');
			expect(oauthAdapter.icon).toBe('🌐');

			expect(typeof oauthAdapter.isAvailable).toBe('function');
			expect(typeof oauthAdapter.getSupportedMethods).toBe('function');
			expect(typeof oauthAdapter.beginAuthentication).toBe('function');
			expect(typeof oauthAdapter.completeAuthentication).toBe('function');
		});

		it('should get adapter info', () => {
			const info = oauthAdapter.getInfo();

			expect(info.name).toBe('oauth');
			expect(info.displayName).toBe('OAuth Provider');
			expect(info.requiresHttps).toBe(false); // OAuth can work over HTTP for localhost
			expect(info.supportsRegistration).toBe(false);
			expect(info.supportsAuthentication).toBe(true);
		});

		it('should get supported methods', () => {
			const methods = oauthAdapter.getSupportedMethods();

			expect(methods).toContain('oauth-google');
			expect(methods).toContain('oauth-github');
		});
	});

	describe('Availability Checking', () => {
		beforeEach(async () => {
			// Enable OAuth providers for testing using DatabaseManager interface
			await db.setSettingsForCategory(
				'auth',
				{
					oauth_providers: {
						google: { enabled: true, clientId: 'test-google-id', clientSecret: 'test-secret' },
						github: { enabled: true, clientId: 'test-github-id', clientSecret: 'test-secret' }
					}
				},
				'OAuth provider configuration'
			);
		});

		it('should detect availability when providers are configured', async () => {
			const isAvailable = await oauthAdapter.isAvailable(mockRequest);
			expect(isAvailable).toBe(true);
		});

		it('should detect unavailability when no providers are enabled', async () => {
			// Disable all providers
			await db.setSettingsForCategory(
				'auth',
				{
					oauth_providers: {
						google: { enabled: false },
						github: { enabled: false }
					}
				},
				'OAuth provider configuration'
			);

			const isAvailable = await oauthAdapter.isAvailable(mockRequest);
			expect(isAvailable).toBe(false);
		});
	});

	describe('Authentication Initiation', () => {
		beforeEach(async () => {
			// Enable OAuth providers
			await db.setSettingsForCategory(
				'auth',
				{
					oauth_providers: {
						google: { enabled: true, clientId: 'test-google-id', clientSecret: 'test-secret' },
						github: { enabled: true, clientId: 'test-github-id', clientSecret: 'test-secret' }
					}
				},
				'OAuth provider configuration'
			);
		});

		it('should begin Google OAuth authentication', async () => {
			const result = await oauthAdapter.beginAuthentication(mockRequest, 'oauth-google', {
				returnTo: '/dashboard'
			});

			expect(result.sessionId).toBeDefined();
			expect(result.method).toBe('oauth-google');
			expect(result.redirectUrl).toBeDefined();
			expect(result.redirectUrl).toContain('accounts.google.com');
			expect(result.requiresUserInteraction).toBe(true);
		});

		it('should begin GitHub OAuth authentication', async () => {
			const result = await oauthAdapter.beginAuthentication(mockRequest, 'oauth-github', {
				returnTo: '/dashboard'
			});

			expect(result.sessionId).toBeDefined();
			expect(result.method).toBe('oauth-github');
			expect(result.redirectUrl).toBeDefined();
			expect(result.redirectUrl).toContain('github.com');
			expect(result.requiresUserInteraction).toBe(true);
		});

		it('should fail authentication for unsupported provider', async () => {
			await expect(
				oauthAdapter.beginAuthentication(mockRequest, 'oauth-unsupported', {})
			).rejects.toThrow('Unsupported OAuth method: oauth-unsupported');
		});

		it('should fail when provider is disabled', async () => {
			// Disable Google OAuth
			await db.setSettingsForCategory(
				'auth',
				{
					oauth_providers: {
						google: { enabled: false },
						github: { enabled: true, clientId: 'test-github-id', clientSecret: 'test-secret' }
					}
				},
				'OAuth provider configuration'
			);

			await expect(
				oauthAdapter.beginAuthentication(mockRequest, 'oauth-google', {})
			).rejects.toThrow('Google OAuth is not enabled');
		});
	});

	describe('Authentication Completion', () => {
		let sessionId;

		beforeEach(async () => {
			// Enable OAuth providers
			await db.setSettingsForCategory(
				'auth',
				{
					oauth_providers: {
						google: { enabled: true, clientId: 'test-google-id', clientSecret: 'test-secret' },
						github: { enabled: true, clientId: 'test-github-id', clientSecret: 'test-secret' }
					}
				},
				'OAuth provider configuration'
			);

			// Begin authentication to get a session
			const beginResult = await oauthAdapter.beginAuthentication(mockRequest, 'oauth-google', {});
			sessionId = beginResult.sessionId;
		});

		it('should complete OAuth authentication for existing user', async () => {
			// Create OAuth account linking
			await db.run(
				`
				INSERT INTO oauth_accounts (user_id, provider, provider_account_id,
					provider_email, provider_name, access_token)
				VALUES (?, 'google', '12345', 'test@example.com', 'Test User', 'access-token')
			`,
				[testUserId]
			);

			const mockOAuthResult = {
				success: true,
				user: { id: testUserId, username: 'testuser', email: 'test@example.com' },
				authMethod: 'oauth',
				provider: 'google'
			};

			const result = await oauthAdapter.completeAuthentication(sessionId, mockRequest, {
				oauthResult: mockOAuthResult
			});

			expect(result.success).toBe(true);
			expect(result.method).toBe('oauth-google');
			expect(result.user).toBeDefined();
			expect(result.user.username).toBe('testuser');
			expect(result.authMethod).toBe('oauth');
		});

		it('should complete OAuth authentication for new user', async () => {
			const mockOAuthResult = {
				success: true,
				user: { id: 999, username: 'newuser', email: 'newuser@example.com' },
				authMethod: 'oauth',
				provider: 'google',
				isNewUser: true
			};

			const result = await oauthAdapter.completeAuthentication(sessionId, mockRequest, {
				oauthResult: mockOAuthResult
			});

			expect(result.success).toBe(true);
			expect(result.method).toBe('oauth-google');
			expect(result.user).toBeDefined();
			expect(result.user.email).toBe('newuser@example.com');
			expect(result.authMethod).toBe('oauth');
		});

		it('should fail completion with invalid session ID', async () => {
			const mockOAuthResult = {
				provider: 'google',
				profile: { id: '12345' },
				accessToken: 'token'
			};

			await expect(
				oauthAdapter.completeAuthentication('invalid-session-id', mockRequest, {
					oauthResult: mockOAuthResult
				})
			).rejects.toThrow('Invalid or expired OAuth session');
		});

		it('should handle OAuth profile without email', async () => {
			const mockOAuthResult = {
				success: true,
				user: { id: 888, username: 'githubuser', email: null },
				authMethod: 'oauth',
				provider: 'github',
				isNewUser: true
			};

			const result = await oauthAdapter.completeAuthentication(sessionId, mockRequest, {
				oauthResult: mockOAuthResult
			});

			expect(result.success).toBe(true);
			expect(result.user.email).toBeNull();
		});
	});

	describe('Session Management', () => {
		it('should generate unique session IDs', () => {
			const sessionId1 = oauthAdapter.generateSessionId();
			const sessionId2 = oauthAdapter.generateSessionId();

			expect(sessionId1).not.toBe(sessionId2);
			expect(sessionId1).toMatch(/^oauth_\d+_\w+$/);
		});

		it('should cleanup expired sessions', () => {
			// Create a mock session
			const sessionId = oauthAdapter.generateSessionId();
			oauthAdapter.activeSessions.set(sessionId, {
				method: 'oauth-google',
				state: 'test-state',
				timestamp: Date.now() - 11 * 60 * 1000 // 11 minutes ago (expired)
			});

			// Verify session exists
			expect(oauthAdapter.activeSessions.has(sessionId)).toBe(true);

			// Run cleanup
			oauthAdapter.cleanupExpiredSessions();

			// Verify session was cleaned up
			expect(oauthAdapter.activeSessions.has(sessionId)).toBe(false);
		});
	});

	describe('Error Handling', () => {
		it('should handle missing OAuth configuration', async () => {
			// Clear OAuth config
			await db.setSettingsForCategory('auth', {}, 'Empty auth configuration');

			await expect(
				oauthAdapter.beginAuthentication(mockRequest, 'oauth-google', {})
			).rejects.toThrow('Google OAuth is not enabled');
		});

		it('should reject traditional authenticate method', async () => {
			await expect(oauthAdapter.authenticate({ username: 'test' })).rejects.toThrow(
				'OAuth requires begin/complete authentication flow'
			);
		});
	});

	describe('Validation', () => {
		it('should validate OAuth credentials', () => {
			const result = oauthAdapter.validateCredentials({ provider: 'google' });
			expect(result.valid).toBe(true);
		});

		it('should validate OAuth state parameters', () => {
			const state = 'oauth_12345_abcdef';
			const result = oauthAdapter.validateOAuthState(state);
			expect(result.valid).toBe(true);
		});
	});

	describe('Provider Configuration', () => {
		it('should get provider redirect URLs', async () => {
			const googleRedirect = oauthAdapter.getProviderRedirectUrl('google', mockRequest);
			const githubRedirect = oauthAdapter.getProviderRedirectUrl('github', mockRequest);

			expect(googleRedirect).toBe('http://localhost:3000/api/auth/google/callback');
			expect(githubRedirect).toBe('http://localhost:3000/api/auth/github/callback');
		});

		it('should update redirect URLs for tunnel scenarios', async () => {
			const tunnelRequest = {
				...mockRequest,
				headers: { host: 'abc123.localtunnel.me' },
				protocol: 'https'
			};

			const googleRedirect = oauthAdapter.getProviderRedirectUrl('google', tunnelRequest);
			expect(googleRedirect).toBe('https://abc123.localtunnel.me/api/auth/google/callback');
		});
	});
});
