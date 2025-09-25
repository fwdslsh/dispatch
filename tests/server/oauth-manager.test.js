import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { OAuthManager } from '../../src/lib/server/shared/auth/OAuthManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('OAuth Manager', () => {
	let db;
	let oauthManager;
	let tempDbPath;
	let testUserId;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-oauth-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Database initialization - tables will be created as needed

		// Create OAuth manager
		oauthManager = new OAuthManager(db, 'http://localhost:3000');

		// Create a test user
		const userResult = await db.run(`
			INSERT INTO users (username, display_name, email, password_hash, is_admin)
			VALUES ('testuser', 'Test User', 'test@example.com', 'hashed_password', 0)
		`);
		testUserId = userResult.lastID;
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

	describe('Configuration', () => {
		it('should initialize with correct base URL', () => {
			expect(oauthManager.baseUrl).toBe('http://localhost:3000');
		});

		it('should update base URL for tunnel scenarios', () => {
			oauthManager.updateBaseUrl('https://abc123.localtunnel.me');
			expect(oauthManager.baseUrl).toBe('https://abc123.localtunnel.me');
		});

		it('should get OAuth configuration', async () => {
			const config = await oauthManager.getOAuthConfig();

			expect(config).toHaveProperty('google');
			expect(config).toHaveProperty('github');
			expect(config.google).toHaveProperty('enabled', false);
			expect(config.github).toHaveProperty('enabled', false);
		});

		it('should update OAuth configuration', async () => {
			const newConfig = {
				google: {
					enabled: true,
					clientId: 'test-google-client-id',
					clientSecret: 'test-google-secret'
				},
				github: {
					enabled: true,
					clientId: 'test-github-client-id',
					clientSecret: 'test-github-secret'
				}
			};

			const result = await oauthManager.updateOAuthConfig(newConfig);

			expect(result.google.enabled).toBe(true);
			expect(result.github.enabled).toBe(true);
		});
	});

	describe('Provider Management', () => {
		beforeEach(async () => {
			// Enable providers for testing
			await oauthManager.updateOAuthConfig({
				google: {
					enabled: true,
					clientId: 'test-google-id',
					clientSecret: 'test-google-secret'
				},
				github: {
					enabled: true,
					clientId: 'test-github-id',
					clientSecret: 'test-github-secret'
				}
			});
		});

		it('should get enabled providers', async () => {
			const providers = await oauthManager.getEnabledProviders();

			expect(providers).toHaveLength(2);
			expect(providers).toContain('google');
			expect(providers).toContain('github');
		});

		it('should get provider configuration', async () => {
			const googleConfig = await oauthManager.getProviderConfig('google');

			expect(googleConfig).toHaveProperty('clientId', 'test-google-id');
			expect(googleConfig).toHaveProperty('clientSecret', 'test-google-secret');
			expect(googleConfig).toHaveProperty('callbackUrl');
			expect(googleConfig.callbackUrl).toBe('http://localhost:3000/api/auth/google/callback');
		});

		it('should generate correct callback URLs', () => {
			const googleCallback = oauthManager.getCallbackUrl('google');
			const githubCallback = oauthManager.getCallbackUrl('github');

			expect(googleCallback).toBe('http://localhost:3000/api/auth/google/callback');
			expect(githubCallback).toBe('http://localhost:3000/api/auth/github/callback');
		});

		it('should update callback URLs when base URL changes', () => {
			oauthManager.updateBaseUrl('https://myapp.example.com');

			const googleCallback = oauthManager.getCallbackUrl('google');
			expect(googleCallback).toBe('https://myapp.example.com/api/auth/google/callback');
		});
	});

	describe('Account Linking', () => {
		beforeEach(async () => {
			// Create OAuth account for testing
			await db.run(
				`
				INSERT INTO oauth_accounts (user_id, provider, provider_account_id,
					provider_email, provider_name, access_token)
				VALUES (?, 'google', '12345', 'test@example.com', 'Test User', 'access-token')
			`,
				[testUserId]
			);
		});

		it('should find user by OAuth account', async () => {
			const user = await oauthManager.findUserByOAuthAccount('google', '12345');

			expect(user).not.toBeNull();
			expect(user.username).toBe('testuser');
		});

		it('should link OAuth account to existing user', async () => {
			const oauthProfile = {
				provider: 'github',
				id: '67890',
				emails: [{ value: 'test@example.com' }],
				displayName: 'Test User GitHub',
				username: 'testuser-gh'
			};

			const result = await oauthManager.linkAccount(
				testUserId,
				oauthProfile,
				'github-access-token'
			);

			expect(result.success).toBe(true);
			expect(result.account).toHaveProperty('provider', 'github');
			expect(result.account).toHaveProperty('providerAccountId', '67890');
		});

		it('should create new user from OAuth profile', async () => {
			const oauthProfile = {
				provider: 'google',
				id: '54321',
				emails: [{ value: 'newuser@example.com' }],
				displayName: 'New User',
				username: 'newuser'
			};

			const result = await oauthManager.createUserFromOAuth(oauthProfile, 'google-access-token');

			expect(result.success).toBe(true);
			expect(result.user.email).toBe('newuser@example.com');
			expect(result.account.provider).toBe('google');
		});

		it('should handle OAuth profile with missing email', async () => {
			const oauthProfile = {
				provider: 'github',
				id: '99999',
				displayName: 'User Without Email',
				username: 'no-email-user'
			};

			const result = await oauthManager.createUserFromOAuth(oauthProfile, 'token');

			expect(result.success).toBe(true);
			expect(result.user.email).toBeNull();
		});
	});

	describe('Token Management', () => {
		let accountId;

		beforeEach(async () => {
			// Create OAuth account for testing
			const result = await db.run(
				`
				INSERT INTO oauth_accounts (user_id, provider, provider_account_id,
					provider_email, access_token, refresh_token, token_expires_at)
				VALUES (?, 'google', '12345', 'test@example.com', 'old-token', 'refresh-token', ?)
			`,
				[testUserId, Date.now() + 3600000]
			); // Expires in 1 hour
			accountId = result.lastID;
		});

		it('should refresh OAuth token', async () => {
			const newTokens = {
				accessToken: 'new-access-token',
				refreshToken: 'new-refresh-token',
				tokenExpiresAt: Date.now() + 7200000 // 2 hours
			};

			const result = await oauthManager.refreshToken(accountId, newTokens);

			expect(result.success).toBe(true);

			// Verify token was updated
			const account = await db.get('SELECT * FROM oauth_accounts WHERE id = ?', [accountId]);
			expect(account.access_token).toBe('new-access-token');
			expect(account.refresh_token).toBe('new-refresh-token');
		});

		it('should get accounts with expired tokens', async () => {
			// Create account with expired token
			await db.run(
				`
				INSERT INTO oauth_accounts (user_id, provider, provider_account_id,
					provider_email, access_token, token_expires_at)
				VALUES (?, 'github', '67890', 'expired@example.com', 'expired-token', ?)
			`,
				[testUserId, Date.now() - 3600000]
			); // Expired 1 hour ago

			const expiredAccounts = await oauthManager.getExpiredTokens();

			expect(expiredAccounts).toHaveLength(1);
			expect(expiredAccounts[0].provider).toBe('github');
		});

		it('should unlink OAuth account', async () => {
			const result = await oauthManager.unlinkAccount(accountId, testUserId);

			expect(result.success).toBe(true);

			// Verify account was deleted
			const account = await db.get('SELECT * FROM oauth_accounts WHERE id = ?', [accountId]);
			expect(account).toBeUndefined();
		});

		it('should prevent unlinking account from wrong user', async () => {
			// Create another user
			const otherUserResult = await db.run(`
				INSERT INTO users (username, email)
				VALUES ('otheruser', 'other@example.com')
			`);

			const result = await oauthManager.unlinkAccount(accountId, otherUserResult.lastID);

			expect(result.success).toBe(false);
			expect(result.error).toContain('not belong');
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid provider', async () => {
			await expect(oauthManager.getProviderConfig('invalid-provider')).rejects.toThrow(
				'Unsupported OAuth provider: invalid-provider'
			);
		});

		it('should handle missing OAuth configuration', async () => {
			// Clear OAuth config
			await oauthManager.updateOAuthConfig({
				google: { enabled: false },
				github: { enabled: false }
			});

			const providers = await oauthManager.getEnabledProviders();
			expect(providers).toHaveLength(0);
		});

		it('should validate OAuth profile data', async () => {
			const invalidProfile = {
				provider: 'google'
				// Missing required fields
			};

			const result = await oauthManager.createUserFromOAuth(invalidProfile, 'token');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid OAuth profile');
		});
	});

	describe('State Management', () => {
		it('should generate OAuth state parameter', () => {
			const state1 = oauthManager.generateState();
			const state2 = oauthManager.generateState();

			expect(state1).toMatch(/^oauth_\w+$/);
			expect(state2).toMatch(/^oauth_\w+$/);
			expect(state1).not.toBe(state2);
		});

		it('should validate OAuth state parameter', () => {
			const state = oauthManager.generateState();
			oauthManager.storeState(state, { provider: 'google', returnTo: '/dashboard' });

			const stateData = oauthManager.validateState(state);
			expect(stateData).toBeTruthy();
			expect(stateData.provider).toBe('google');
			expect(stateData.returnTo).toBe('/dashboard');

			// Should only validate once
			const isValidAgain = oauthManager.validateState(state);
			expect(isValidAgain).toBe(false);
		});

		it('should cleanup expired state', () => {
			const state = oauthManager.generateState();
			oauthManager.storeState(state, { provider: 'google' });

			// Mock time passage by manipulating state directly
			const stateData = oauthManager.pendingStates.get(state);
			stateData.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago

			// Cleanup should remove expired state
			oauthManager.cleanupExpiredStates();
			expect(oauthManager.pendingStates.has(state)).toBe(false);
		});
	});

	describe('Integration with AuthManager', () => {
		it('should return OAuth authentication result', async () => {
			const mockProfile = {
				provider: 'google',
				id: '12345',
				emails: [{ value: 'test@example.com' }],
				displayName: 'Test User'
			};

			const result = await oauthManager.handleOAuthCallback(mockProfile, 'access-token');

			expect(result).toHaveProperty('success');
			expect(result).toHaveProperty('user');
			expect(result).toHaveProperty('authMethod', 'oauth');
		});
	});
});
