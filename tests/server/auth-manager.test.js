import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { AuthManager } from '../../src/lib/server/shared/auth/AuthManager.js';
import { LocalAuthAdapter } from '../../src/lib/server/shared/auth/adapters/LocalAuthAdapter.js';
import { SessionManager } from '../../src/lib/server/shared/auth/SessionManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('AuthManager Core System', () => {
	let db;
	let authManager;
	let sessionManager;
	let tempDbPath;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-auth-manager-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run migrations to set up auth tables
		const { AuthMigrationManager } = await import('../../src/lib/server/shared/db/AuthMigrationManager.js');
		const migrationManager = new AuthMigrationManager(db);
		await migrationManager.runAllMigrations();

		// Create session manager
		sessionManager = new SessionManager(db);

		// Create auth manager with default local adapter
		authManager = new AuthManager(db, sessionManager);
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

	describe('AuthManager Adapter Pattern', () => {
		it('should register and use authentication adapters', async () => {
			// Create a mock adapter
			const mockAdapter = {
				name: 'mock',
				authenticate: vi.fn().mockResolvedValue({
					success: true,
					user: { id: 1, username: 'testuser' }
				}),
				validateCredentials: vi.fn().mockReturnValue(true)
			};

			// Register the adapter
			authManager.registerAdapter('mock', mockAdapter);

			// Enable the mock authentication method in configuration
			await authManager.updateAuthConfig({
				enabled_methods: ['local', 'mock']
			});

			// Verify adapter is registered
			const adapters = authManager.getAvailableAdapters();
			expect(adapters).toContain('mock');

			// Test authentication with the adapter
			const result = await authManager.authenticate('mock', {
				username: 'admin',
				password: 'testpass'
			});

			expect(mockAdapter.authenticate).toHaveBeenCalledWith({
				username: 'admin',
				password: 'testpass'
			});
			expect(result.success).toBe(true);
		});

		it('should handle adapter registration errors', () => {
			expect(() => {
				authManager.registerAdapter('invalid', null);
			}).toThrow('Adapter must be an object');

			expect(() => {
				authManager.registerAdapter('invalid', {});
			}).toThrow('Adapter must have an authenticate method');
		});

		it('should return error for unknown adapter', async () => {
			const result = await authManager.authenticate('nonexistent', {});
			expect(result.success).toBe(false);
			expect(result.error).toContain('Authentication method "nonexistent" not enabled');
		});
	});

	describe('Local Authentication', () => {
		it('should authenticate with valid credentials', async () => {
			// Use the admin user created by migrations

			// Test authentication
			const result = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Test Device',
				ipAddress: '127.0.0.1',
				userAgent: 'Test Agent'
			});

			expect(result.success).toBe(true);
			expect(result.user).toBeDefined();
			expect(result.user.username).toBe('admin');
			expect(result.sessionToken).toBeDefined();
			expect(result.device).toBeDefined();
		});

		it('should reject invalid credentials', async () => {
			const result = await authManager.authenticate('local', {
				username: 'nonexistent',
				password: 'wrong'
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid credentials');
		});

		it('should handle missing required fields', async () => {
			const result = await authManager.authenticate('local', {
				username: 'admin'
				// missing password
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Username and password are required');
		});
	});

	describe('Session Management Integration', () => {
		// Use the admin user created by migrations

		it('should create session after successful authentication', async () => {
			const authResult = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Test Device',
				ipAddress: '127.0.0.1'
			});

			expect(authResult.success).toBe(true);
			expect(authResult.sessionToken).toBeDefined();

			// Verify session exists in database
			const session = await sessionManager.getSessionByToken(authResult.sessionToken);
			expect(session).toBeDefined();
			// Should be admin user (ID 1)
			expect(session.userId).toBe(1);
		});

		it('should validate active session tokens', async () => {
			const authResult = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Test Device'
			});

			const validationResult = await authManager.validateSession(authResult.sessionToken);
			expect(validationResult.valid).toBe(true);
			expect(validationResult.user).toBeDefined();
			expect(validationResult.device).toBeDefined();
		});

		it('should reject invalid session tokens', async () => {
			const validationResult = await authManager.validateSession('invalid-token');
			expect(validationResult.valid).toBe(false);
		});

		it('should logout and invalidate session', async () => {
			const authResult = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Test Device'
			});

			const logoutResult = await authManager.logout(authResult.sessionToken);
			expect(logoutResult.success).toBe(true);

			// Session should now be invalid
			const validationResult = await authManager.validateSession(authResult.sessionToken);
			expect(validationResult.valid).toBe(false);
		});
	});

	describe('Device Management', () => {
		// Use the admin user created by migrations

		it('should create device on first authentication', async () => {
			const result = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'New Device',
				deviceFingerprint: 'device-fp-123',
				ipAddress: '192.168.1.100'
			});

			expect(result.success).toBe(true);
			expect(result.device.deviceName).toBe('New Device');
			expect(result.device.deviceFingerprint).toBe('device-fp-123');
		});

		it('should reuse existing device on subsequent authentications', async () => {
			// First auth
			const result1 = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Existing Device',
				deviceFingerprint: 'device-fp-456',
				ipAddress: '192.168.1.100'
			});

			// Second auth with same fingerprint
			const result2 = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Updated Name', // Name might be different
				deviceFingerprint: 'device-fp-456', // Same fingerprint
				ipAddress: '192.168.1.101' // Different IP
			});

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
			expect(result1.device.id).toBe(result2.device.id); // Same device
		});

		it('should revoke all device sessions', async () => {
			const auth1 = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Device 1',
				deviceFingerprint: 'device-fp-1'
			});

			const auth2 = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				deviceName: 'Device 1',
				deviceFingerprint: 'device-fp-1'
			});

			// Both sessions should be valid initially
			expect((await authManager.validateSession(auth1.sessionToken)).valid).toBe(true);
			expect((await authManager.validateSession(auth2.sessionToken)).valid).toBe(true);

			// Revoke all sessions for device
			await authManager.revokeDeviceSessions(auth1.device.id);

			// Both sessions should now be invalid
			expect((await authManager.validateSession(auth1.sessionToken)).valid).toBe(false);
			expect((await authManager.validateSession(auth2.sessionToken)).valid).toBe(false);
		});
	});

	describe('Rate Limiting and Security', () => {
		it('should track failed login attempts', async () => {
			const credentials = {
				username: 'nonexistent',
				password: 'wrong',
				ipAddress: '192.168.1.200'
			};

			// Multiple failed attempts (more than the default 10 attempts limit)
			for (let i = 0; i < 12; i++) {
				const result = await authManager.authenticate('local', credentials);
				expect(result.success).toBe(false);
			}

			// Should be rate limited now
			const result = await authManager.authenticate('local', credentials);
			expect(result.success).toBe(false);
			expect(result.error).toContain('rate limited');
		});

		it('should log authentication events', async () => {
			// Use the admin user created by migrations

			// Successful auth
			const result = await authManager.authenticate('local', {
				username: 'admin',
				password: 'change-me', // Default TERMINAL_KEY value
				ipAddress: '192.168.1.50'
			});

			expect(result.success).toBe(true);

			// Check that login event was logged
			const { createDAOs } = await import('../../src/lib/server/shared/db/models/index.js');
			const daos = createDAOs(db);
			const events = await daos.authEvents.getByUserId(result.user.id, { limit: 10 });

			const loginEvent = events.find(e => e.eventType === 'login');
			expect(loginEvent).toBeDefined();
			expect(loginEvent.ipAddress).toBe('192.168.1.50');
		});
	});

	describe('Configuration and Settings', () => {
		it('should respect authentication settings', async () => {
			// Disable local auth
			await db.updateSettingInCategory('auth', 'enabled_methods', ['webauthn']);

			const result = await authManager.authenticate('local', {
				username: 'admin',
				password: 'test-key-123'
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('not enabled');
		});

		it('should get authentication configuration', async () => {
			const config = await authManager.getAuthConfig();

			expect(config).toHaveProperty('enabled_methods');
			expect(config).toHaveProperty('default_method');
			expect(config).toHaveProperty('session_timeout_hours');
			expect(Array.isArray(config.enabled_methods)).toBe(true);
		});

		it('should update authentication configuration', async () => {
			const newConfig = {
				enabled_methods: ['local', 'webauthn'],
				session_timeout_hours: 12,
				require_device_trust: true
			};

			await authManager.updateAuthConfig(newConfig);

			const updatedConfig = await authManager.getAuthConfig();
			expect(updatedConfig.enabled_methods).toEqual(['local', 'webauthn']);
			expect(updatedConfig.session_timeout_hours).toBe(12);
		});
	});
});