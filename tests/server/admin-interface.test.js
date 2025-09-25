import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { AuthMigrationManager } from '../../src/lib/server/shared/db/AuthMigrationManager.js';
import { AdminInterfaceManager } from '../../src/lib/server/shared/admin/AdminInterfaceManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('Admin Interface Manager', () => {
	let db;
	let migrationManager;
	let adminManager;
	let tempDbPath;
	let testAdminUserId;
	let testRegularUserId;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-admin-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run auth migrations
		migrationManager = new AuthMigrationManager(db);
		await migrationManager.runAllMigrations();

		// Create admin interface manager
		adminManager = new AdminInterfaceManager(db);

		// Get the admin user created by migration
		const migrationAdmin = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
		testAdminUserId = migrationAdmin.id;

		// Create test regular user
		const userResult = await db.run(`
			INSERT INTO users (username, display_name, email, password_hash, is_admin)
			VALUES ('testuser', 'Test User', 'test@example.com', 'hashed_password', 0)
		`);
		testRegularUserId = userResult.lastID;

		// Create test devices
		await db.run(`
			INSERT INTO user_devices (user_id, device_name, device_fingerprint, is_trusted)
			VALUES (?, 'Test Device', 'test-fingerprint-123', 1)
		`, [testRegularUserId]);

		// Create test sessions
		await db.run(`
			INSERT INTO auth_sessions (user_id, device_id, session_token, expires_at, is_active)
			VALUES (?, 1, 'test-session-token', ?, 1)
		`, [testRegularUserId, Date.now() + 3600000]);

		// Create test auth events
		await db.run(`
			INSERT INTO auth_events (user_id, device_id, event_type, ip_address, user_agent, details)
			VALUES (?, 1, 'login', '192.168.1.100', 'Test Browser', '{"method": "local"}')
		`, [testRegularUserId]);
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

	describe('User Management', () => {
		it('should list users with pagination', async () => {
			const result = await adminManager.listUsers({
				page: 1,
				limit: 10
			});

			expect(result.users).toHaveLength(2);
			expect(result.pagination.total).toBe(2);
			expect(result.pagination.page).toBe(1);
			expect(result.users[0]).toHaveProperty('username');
			expect(result.users[0]).toHaveProperty('email');
			expect(result.users[0]).toHaveProperty('isAdmin');
			expect(result.users[0]).not.toHaveProperty('passwordHash'); // Should not expose password
		});

		it('should filter users by search term', async () => {
			const result = await adminManager.listUsers({
				search: 'admin'
			});

			expect(result.users).toHaveLength(1);
			expect(result.users[0].username).toBe('admin');
		});

		it('should create new user', async () => {
			const userData = {
				username: 'newuser',
				displayName: 'New User',
				email: 'newuser@example.com',
				accessCode: 'newpassword123',
				isAdmin: false
			};

			const result = await adminManager.createUser(userData);

			expect(result.success).toBe(true);
			expect(result.user.username).toBe('newuser');
			expect(result.user.email).toBe('newuser@example.com');
			expect(result.user.is_admin).toBe(0);

			// Verify user was created in database
			const dbUser = await db.get('SELECT * FROM users WHERE username = ?', ['newuser']);
			expect(dbUser).toBeDefined();
			expect(dbUser.password_hash).not.toBe('newpassword123'); // Should be hashed
		});

		it('should validate user creation data', async () => {
			const invalidUserData = {
				username: '', // Invalid empty username
				email: 'invalid-email', // Invalid email format
				accessCode: '123' // Too short password
			};

			try {
				await adminManager.createUser(invalidUserData);
				expect.fail('Should have thrown validation error');
			} catch (error) {
				expect(error.message).toContain('Validation failed');
				expect(error.message).toContain('Username must be at least 2 characters');
				expect(error.message).toContain('Valid email is required');
				expect(error.message).toContain('Access code must be at least 6 characters');
			}
		});

		it('should prevent duplicate usernames', async () => {
			const userData = {
				username: 'admin', // Already exists
				displayName: 'Another Admin',
				email: 'another@example.com',
				accessCode: 'password123'
			};

			try {
				await adminManager.createUser(userData);
				expect.fail('Should have thrown duplicate username error');
			} catch (error) {
				expect(error.message).toContain('username already exists');
			}
		});

		it('should delete user and associated data', async () => {
			const result = await adminManager.deleteUser(testRegularUserId);

			expect(result.success).toBe(true);

			// Verify user was deleted
			const user = await db.get('SELECT * FROM users WHERE id = ?', [testRegularUserId]);
			expect(user).toBeUndefined();

			// Verify associated sessions were deleted
			const sessions = await db.all('SELECT * FROM auth_sessions WHERE user_id = ?', [testRegularUserId]);
			expect(sessions).toHaveLength(0);

			// Verify associated devices were deleted
			const devices = await db.all('SELECT * FROM user_devices WHERE user_id = ?', [testRegularUserId]);
			expect(devices).toHaveLength(0);
		});

		it('should prevent deleting the last admin user', async () => {
			const result = await adminManager.deleteUser(testAdminUserId);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Cannot delete the last admin user');
		});

		it('should get user details with related data', async () => {
			const result = await adminManager.getUserDetails(testRegularUserId);

			expect(result.success).toBe(true);
			expect(result.user.username).toBe('testuser');
			expect(result.user.devices).toHaveLength(1);
			expect(result.user.sessions).toHaveLength(1);
			expect(result.user.recentEvents).toBeDefined();
		});
	});

	describe('Device Management', () => {
		it('should list user devices with details', async () => {
			const devices = await adminManager.listUserDevices(testRegularUserId);

			expect(devices).toHaveLength(1);
			expect(devices[0]).toHaveProperty('deviceName', 'Test Device');
			expect(devices[0]).toHaveProperty('deviceFingerprint');
			expect(devices[0]).toHaveProperty('isTrusted');
			expect(devices[0]).toHaveProperty('activeSessions');
		});

		it('should revoke device and all its sessions', async () => {
			const deviceId = 1;
			const result = await adminManager.revokeDevice(deviceId);

			expect(result.success).toBe(true);

			// Verify sessions were revoked
			const activeSessions = await db.all(
				'SELECT * FROM auth_sessions WHERE device_id = ? AND is_active = 1',
				[deviceId]
			);
			expect(activeSessions).toHaveLength(0);
		});

		it('should rename device', async () => {
			const deviceId = 1;
			const newName = 'Updated Device Name';

			const result = await adminManager.renameDevice(deviceId, newName);

			expect(result.success).toBe(true);

			// Verify device name was updated
			const device = await db.get('SELECT * FROM user_devices WHERE id = ?', [deviceId]);
			expect(device.device_name).toBe(newName);
		});

		it('should toggle device trust status', async () => {
			const deviceId = 1;

			const result = await adminManager.toggleDeviceTrust(deviceId);

			expect(result.success).toBe(true);

			// Verify trust status was toggled
			const device = await db.get('SELECT * FROM user_devices WHERE id = ?', [deviceId]);
			expect(device.is_trusted).toBe(0); // Should be false now
		});
	});

	describe('Session Management', () => {
		it('should list active sessions', async () => {
			const sessions = await adminManager.listActiveSessions();

			expect(sessions.length).toBeGreaterThan(0);
			expect(sessions[0]).toHaveProperty('sessionToken');
			expect(sessions[0]).toHaveProperty('username');
			expect(sessions[0]).toHaveProperty('deviceName');
			expect(sessions[0]).toHaveProperty('lastActivity');
		});

		it('should revoke specific session', async () => {
			const sessionToken = 'test-session-token';

			const result = await adminManager.revokeSession(sessionToken);

			expect(result.success).toBe(true);

			// Verify session was revoked
			const session = await db.get(
				'SELECT * FROM auth_sessions WHERE session_token = ? AND is_active = 1',
				[sessionToken]
			);
			expect(session).toBeUndefined();
		});

		it('should revoke all sessions for user', async () => {
			const result = await adminManager.revokeAllUserSessions(testRegularUserId);

			expect(result.success).toBe(true);
			expect(result.revokedCount).toBe(1);

			// Verify all sessions were revoked
			const activeSessions = await db.all(
				'SELECT * FROM auth_sessions WHERE user_id = ? AND is_active = 1',
				[testRegularUserId]
			);
			expect(activeSessions).toHaveLength(0);
		});
	});

	describe('Authentication Configuration', () => {
		it('should get current authentication methods configuration', async () => {
			const config = await adminManager.getAuthConfiguration();

			expect(config).toHaveProperty('methods');
			expect(config.methods).toHaveProperty('local');
			expect(config.methods).toHaveProperty('webauthn');
			expect(config.methods).toHaveProperty('oauth');
			expect(config).toHaveProperty('security');
			expect(config).toHaveProperty('settings');
		});

		it('should update authentication method availability', async () => {
			const updates = {
				webauthn: { enabled: false },
				oauth: {
					enabled: true,
					providers: {
						google: { enabled: true },
						github: { enabled: false }
					}
				}
			};

			const result = await adminManager.updateAuthConfiguration(updates);

			expect(result.success).toBe(true);

			// Verify configuration was updated
			const config = await adminManager.getAuthConfiguration();
			expect(config.methods.webauthn.enabled).toBe(false);
			expect(config.methods.oauth.providers.google.enabled).toBe(true);
			expect(config.methods.oauth.providers.github.enabled).toBe(false);
		});

		it('should validate authentication configuration', async () => {
			const invalidConfig = {
				local: { enabled: false }, // Cannot disable local auth if it's the only method
				webauthn: { enabled: false },
				oauth: { enabled: false }
			};

			const result = await adminManager.updateAuthConfiguration(invalidConfig);

			expect(result.success).toBe(false);
			expect(result.error).toContain('At least one authentication method must be enabled');
		});
	});

	describe('Security Posture Dashboard', () => {
		it('should get security posture summary', async () => {
			const posture = await adminManager.getSecurityPosture();

			expect(posture).toHaveProperty('overall');
			expect(posture).toHaveProperty('factors');
			expect(posture.factors).toHaveProperty('httpsEnabled');
			expect(posture.factors).toHaveProperty('strongAuthentication');
			expect(posture.factors).toHaveProperty('certificateStatus');
			expect(posture.factors).toHaveProperty('sessionSecurity');
			expect(posture).toHaveProperty('recommendations');
			expect(posture).toHaveProperty('warnings');
		});

		it('should calculate security score correctly', async () => {
			const posture = await adminManager.getSecurityPosture();

			expect(posture.overall.score).toBeGreaterThanOrEqual(0);
			expect(posture.overall.score).toBeLessThanOrEqual(100);
			expect(posture.overall.level).toMatch(/^(low|medium|high)$/);
		});

		it('should provide contextual security recommendations', async () => {
			const posture = await adminManager.getSecurityPosture();

			expect(Array.isArray(posture.recommendations)).toBe(true);
			if (posture.recommendations.length > 0) {
				expect(posture.recommendations[0]).toHaveProperty('type');
				expect(posture.recommendations[0]).toHaveProperty('title');
				expect(posture.recommendations[0]).toHaveProperty('description');
				expect(posture.recommendations[0]).toHaveProperty('action');
			}
		});
	});

	describe('Audit Log Management', () => {
		it('should get audit logs with filtering', async () => {
			const logs = await adminManager.getAuditLogs({
				page: 1,
				limit: 10,
				eventType: 'login',
				userId: testRegularUserId
			});

			expect(logs.events).toHaveLength(1);
			expect(logs.events[0].eventType).toBe('login');
			expect(logs.events[0].userId).toBe(testRegularUserId);
			expect(logs.pagination).toHaveProperty('total');
		});

		it('should search audit logs by IP address', async () => {
			const logs = await adminManager.getAuditLogs({
				ipAddress: '192.168.1.100'
			});

			expect(logs.events.length).toBeGreaterThan(0);
			expect(logs.events[0].ipAddress).toBe('192.168.1.100');
		});

		it('should export audit logs', async () => {
			const exportData = await adminManager.exportAuditLogs({
				format: 'json',
				dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
				dateTo: new Date()
			});

			expect(exportData.success).toBe(true);
			expect(exportData.data).toBeDefined();
			expect(Array.isArray(exportData.data)).toBe(true);
		});
	});

	describe('System Statistics', () => {
		it('should get system usage statistics', async () => {
			const stats = await adminManager.getSystemStats();

			expect(stats).toHaveProperty('users');
			expect(stats).toHaveProperty('sessions');
			expect(stats).toHaveProperty('devices');
			expect(stats).toHaveProperty('authEvents');
			expect(stats.users.total).toBe(2);
			expect(stats.users.admins).toBe(1);
		});

		it('should get activity timeline', async () => {
			const timeline = await adminManager.getActivityTimeline({
				days: 7
			});

			expect(Array.isArray(timeline)).toBe(true);
			if (timeline.length > 0) {
				expect(timeline[0]).toHaveProperty('date');
				expect(timeline[0]).toHaveProperty('events');
			}
		});
	});

	describe('Admin User Management', () => {
		it('should promote user to admin', async () => {
			const result = await adminManager.promoteToAdmin(testRegularUserId);

			expect(result.success).toBe(true);

			// Verify user is now admin
			const user = await db.get('SELECT * FROM users WHERE id = ?', [testRegularUserId]);
			expect(user.is_admin).toBe(1);
		});

		it('should demote admin to regular user', async () => {
			// First promote the test user
			await adminManager.promoteToAdmin(testRegularUserId);

			// Now demote them
			const result = await adminManager.demoteFromAdmin(testRegularUserId);

			expect(result.success).toBe(true);

			// Verify user is no longer admin
			const user = await db.get('SELECT * FROM users WHERE id = ?', [testRegularUserId]);
			expect(user.is_admin).toBe(0);
		});

		it('should prevent demoting the last admin', async () => {
			const result = await adminManager.demoteFromAdmin(testAdminUserId);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Cannot demote the last admin user');
		});
	});

	describe('Backup and Maintenance', () => {
		it('should trigger database cleanup', async () => {
			const result = await adminManager.runDatabaseCleanup();

			expect(result.success).toBe(true);
			expect(result.stats).toHaveProperty('sessionsCleanedUp');
			expect(result.stats).toHaveProperty('eventsCleanedUp');
			expect(result.stats).toHaveProperty('devicesCleanedUp');
		});

		it('should get database health status', async () => {
			const health = await adminManager.getDatabaseHealth();

			expect(health).toHaveProperty('status');
			expect(health).toHaveProperty('size');
			expect(health).toHaveProperty('tables');
			expect(health.status).toMatch(/^(healthy|warning|error)$/);
		});
	});
});