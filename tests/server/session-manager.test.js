import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { SessionManager } from '../../src/lib/server/shared/auth/SessionManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('SessionManager JWT and Database Integration', () => {
	let db;
	let sessionManager;
	let tempDbPath;
	let testUser;
	let testDevice;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-session-manager-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run migrations to set up auth tables
		const { AuthMigrationManager } = await import(
			'../../src/lib/server/shared/db/AuthMigrationManager.js'
		);
		const migrationManager = new AuthMigrationManager(db);
		await migrationManager.runAllMigrations();

		// Create session manager
		sessionManager = new SessionManager(db);

		// Create test user and device
		const { createDAOs } = await import('../../src/lib/server/shared/db/models/index.js');
		const daos = createDAOs(db);

		testUser = await daos.users.create({
			username: 'testuser',
			email: 'test@example.com',
			passwordHash: 'hashed-password',
			isAdmin: false
		});

		testDevice = await daos.userDevices.createOrUpdate({
			userId: testUser.id,
			deviceName: 'Test Device',
			deviceFingerprint: 'test-fp-123',
			ipAddress: '192.168.1.100'
		});
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

	describe('JWT Token Generation and Validation', () => {
		it('should generate valid JWT tokens', async () => {
			const sessionData = {
				userId: testUser.id,
				deviceId: testDevice.id,
				ipAddress: '192.168.1.100',
				userAgent: 'Test Agent'
			};

			const session = await sessionManager.createSession(sessionData);

			expect(session.sessionToken).toBeDefined();
			expect(typeof session.sessionToken).toBe('string');
			expect(session.sessionToken.length).toBeGreaterThan(50); // JWT tokens are long

			// Token should have 3 parts separated by dots
			const parts = session.sessionToken.split('.');
			expect(parts.length).toBe(3);
		});

		it('should validate JWT tokens and return decoded payload', async () => {
			const session = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id,
				ipAddress: '192.168.1.100'
			});

			const validation = await sessionManager.validateToken(session.sessionToken);

			expect(validation.valid).toBe(true);
			expect(validation.payload).toBeDefined();
			expect(validation.payload.userId).toBe(testUser.id);
			expect(validation.payload.sessionId).toBe(session.id);
		});

		it('should reject invalid JWT tokens', async () => {
			const validation = await sessionManager.validateToken('invalid.jwt.token');

			expect(validation.valid).toBe(false);
			expect(validation.error).toContain('Invalid token');
		});

		it('should reject expired JWT tokens', async () => {
			// Create session with very short expiry
			const shortSession = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id,
				expiresAt: Date.now() + 100 // 100ms expiry
			});

			// Wait for token to expire
			await new Promise((resolve) => setTimeout(resolve, 150));

			const validation = await sessionManager.validateToken(shortSession.sessionToken);

			expect(validation.valid).toBe(false);
			expect(validation.error).toContain('expired');
		});

		it('should reject revoked session tokens', async () => {
			const session = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			// Revoke the session
			await sessionManager.revokeSession(session.id);

			const validation = await sessionManager.validateToken(session.sessionToken);

			expect(validation.valid).toBe(false);
			expect(validation.error).toContain('revoked');
		});
	});

	describe('Session Database Operations', () => {
		it('should create session in database', async () => {
			const sessionData = {
				userId: testUser.id,
				deviceId: testDevice.id,
				ipAddress: '192.168.1.100',
				userAgent: 'Mozilla/5.0'
			};

			const session = await sessionManager.createSession(sessionData);

			expect(session.id).toBeDefined();
			expect(session.userId).toBe(testUser.id);
			expect(session.deviceId).toBe(testDevice.id);
			expect(session.ipAddress).toBe('192.168.1.100');
			expect(session.userAgent).toBe('Mozilla/5.0');
			expect(session.isActive).toBe(true);
		});

		it('should retrieve session by token', async () => {
			const originalSession = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const retrievedSession = await sessionManager.getSessionByToken(originalSession.sessionToken);

			expect(retrievedSession).toBeDefined();
			expect(retrievedSession.id).toBe(originalSession.id);
			expect(retrievedSession.userId).toBe(testUser.id);
		});

		it('should retrieve session with user and device info', async () => {
			const session = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const fullSession = await sessionManager.getSessionWithDetails(session.id);

			expect(fullSession).toBeDefined();
			expect(fullSession.user).toBeDefined();
			expect(fullSession.user.username).toBe('testuser');
			expect(fullSession.device).toBeDefined();
			expect(fullSession.device.deviceName).toBe('Test Device');
		});

		it('should update session activity', async () => {
			const session = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const originalActivity = session.lastActivityAt;

			// Wait a bit to ensure timestamp difference
			await new Promise((resolve) => setTimeout(resolve, 10));

			await sessionManager.updateActivity(session.id, '192.168.1.200', 'Updated Agent');

			const updatedSession = await sessionManager.getSessionById(session.id);
			expect(updatedSession.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime());
			expect(updatedSession.ipAddress).toBe('192.168.1.200');
			expect(updatedSession.userAgent).toBe('Updated Agent');
		});
	});

	describe('Session Lifecycle Management', () => {
		it('should list user sessions', async () => {
			// Create multiple sessions for the user
			const session1 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const session2 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const sessions = await sessionManager.getUserSessions(testUser.id);

			expect(sessions.length).toBe(2);
			expect(sessions.map((s) => s.id)).toContain(session1.id);
			expect(sessions.map((s) => s.id)).toContain(session2.id);
		});

		it('should revoke single session', async () => {
			const session = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			expect(session.isActive).toBe(true);

			await sessionManager.revokeSession(session.id);

			const revokedSession = await sessionManager.getSessionById(session.id);
			expect(revokedSession.isActive).toBe(false);
		});

		it('should revoke all user sessions except current', async () => {
			const session1 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const session2 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const session3 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			// Revoke all except session2
			await sessionManager.revokeAllUserSessions(testUser.id, session2.id);

			const sessions = await sessionManager.getUserSessions(testUser.id, false); // active only
			expect(sessions.length).toBe(1);
			expect(sessions[0].id).toBe(session2.id);
		});

		it('should revoke all device sessions', async () => {
			// Create another device
			const { createDAOs } = await import('../../src/lib/server/shared/db/models/index.js');
			const daos = createDAOs(db);

			const device2 = await daos.userDevices.createOrUpdate({
				userId: testUser.id,
				deviceName: 'Device 2',
				deviceFingerprint: 'device-2-fp'
			});

			// Create sessions on both devices
			const session1 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const session2 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: device2.id
			});

			// Revoke all sessions on device 1
			await sessionManager.revokeDeviceSessions(testDevice.id);

			// Session 1 should be revoked, session 2 should still be active
			const validation1 = await sessionManager.validateToken(session1.sessionToken);
			const validation2 = await sessionManager.validateToken(session2.sessionToken);

			expect(validation1.valid).toBe(false);
			expect(validation2.valid).toBe(true);
		});
	});

	describe('Session Configuration and Policies', () => {
		it('should respect session timeout configuration', async () => {
			// Update session timeout to 1 hour
			await db.updateSettingInCategory('auth', 'session_timeout_hours', 1);

			const session = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const expectedExpiry = new Date(session.createdAt.getTime() + 1 * 60 * 60 * 1000);
			const actualExpiry = session.expiresAt;

			// Allow for small time differences (within 1 minute)
			const timeDiff = Math.abs(expectedExpiry.getTime() - actualExpiry.getTime());
			expect(timeDiff).toBeLessThan(60 * 1000);
		});

		it('should enforce max devices per user policy', async () => {
			// Set max devices to 2
			await db.updateSettingInCategory('auth', 'max_devices_per_user', 2);

			const { createDAOs } = await import('../../src/lib/server/shared/db/models/index.js');
			const daos = createDAOs(db);

			// Create 2 devices (we already have testDevice)
			const device2 = await daos.userDevices.createOrUpdate({
				userId: testUser.id,
				deviceName: 'Device 2',
				deviceFingerprint: 'device-2-fp'
			});

			// Try to create a 3rd device - should succeed but old ones might be cleaned up
			const device3 = await daos.userDevices.createOrUpdate({
				userId: testUser.id,
				deviceName: 'Device 3',
				deviceFingerprint: 'device-3-fp'
			});

			expect(device3).toBeDefined();

			// Check device count enforcement in session creation
			const deviceValidation = await sessionManager.validateDevicePolicy(testUser.id, device3.id);
			expect(deviceValidation.allowed).toBeDefined();
		});

		it('should get session statistics', async () => {
			// Create some sessions
			await sessionManager.createSession({ userId: testUser.id, deviceId: testDevice.id });
			await sessionManager.createSession({ userId: testUser.id, deviceId: testDevice.id });

			const stats = await sessionManager.getSessionStats();

			expect(stats).toHaveProperty('active');
			expect(stats).toHaveProperty('expired');
			expect(stats).toHaveProperty('recentActivity');
			expect(typeof stats.active).toBe('number');
		});
	});

	describe('Token Security and Rotation', () => {
		it('should use different secrets for different sessions', async () => {
			const session1 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			const session2 = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			// Tokens should be different even for same user/device
			expect(session1.sessionToken).not.toBe(session2.sessionToken);
		});

		it('should handle token refresh gracefully', async () => {
			const originalSession = await sessionManager.createSession({
				userId: testUser.id,
				deviceId: testDevice.id
			});

			// Refresh the session token
			const refreshedSession = await sessionManager.refreshSession(originalSession.id);

			expect(refreshedSession.sessionToken).toBeDefined();
			expect(refreshedSession.sessionToken).not.toBe(originalSession.sessionToken);
			expect(refreshedSession.id).toBe(originalSession.id); // Same session record

			// Old token should be invalid
			const oldValidation = await sessionManager.validateToken(originalSession.sessionToken);
			expect(oldValidation.valid).toBe(false);

			// New token should be valid
			const newValidation = await sessionManager.validateToken(refreshedSession.sessionToken);
			expect(newValidation.valid).toBe(true);
		});
	});
});
