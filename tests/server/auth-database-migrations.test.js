import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { AuthMigrationManager } from '../../src/lib/server/shared/db/AuthMigrationManager.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('Authentication Database Migrations', () => {
	let db;
	let migrationManager;
	let tempDbPath;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-auth-migrations-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		migrationManager = new AuthMigrationManager(db);
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

	describe('Auth Tables Creation', () => {
		it('should create all auth tables with correct schema', async () => {
			await migrationManager.runMigration('001_create_auth_tables');

			// Test users table
			const userResult = await db.run(`
				INSERT INTO users (username, display_name, email, password_hash, is_admin)
				VALUES ('testuser', 'Test User', 'test@example.com', 'hashed_password', 1)
			`);
			expect(userResult.lastID).toBeGreaterThan(0);

			// Test user_devices table with foreign key
			const deviceResult = await db.run(`
				INSERT INTO user_devices (user_id, device_name, device_fingerprint)
				VALUES (?, 'Chrome Browser', 'fp123456')
			`, [userResult.lastID]);
			expect(deviceResult.lastID).toBeGreaterThan(0);

			// Test auth_sessions table
			const sessionResult = await db.run(`
				INSERT INTO auth_sessions (user_id, device_id, session_token, expires_at)
				VALUES (?, ?, 'token123', ?)
			`, [userResult.lastID, deviceResult.lastID, Date.now() + 86400000]);
			expect(sessionResult.lastID).toBeGreaterThan(0);

			// Test webauthn_credentials table
			const credentialResult = await db.run(`
				INSERT INTO webauthn_credentials (user_id, credential_id, public_key, device_name)
				VALUES (?, 'cred123', 'pubkey123', 'Security Key')
			`, [userResult.lastID]);
			expect(credentialResult.lastID).toBeGreaterThan(0);

			// Test oauth_accounts table
			const oauthResult = await db.run(`
				INSERT INTO oauth_accounts (user_id, provider, provider_account_id, provider_email)
				VALUES (?, 'google', 'google123', 'test@gmail.com')
			`, [userResult.lastID]);
			expect(oauthResult.lastID).toBeGreaterThan(0);

			// Test auth_events table
			const eventResult = await db.run(`
				INSERT INTO auth_events (user_id, device_id, event_type, ip_address, details)
				VALUES (?, ?, 'login', '192.168.1.1', '{"method": "webauthn"}')
			`, [userResult.lastID, deviceResult.lastID]);
			expect(eventResult.lastID).toBeGreaterThan(0);

			// Test certificates table
			const certResult = await db.run(`
				INSERT INTO certificates (cert_type, domain, certificate_pem, private_key_pem, expires_at)
				VALUES ('mkcert', 'localhost', 'cert_data', 'key_data', ?)
			`, [Date.now() + 86400000]);
			expect(certResult.lastID).toBeGreaterThan(0);
		});

		it('should create proper indexes for performance', async () => {
			await migrationManager.runMigration('001_create_auth_tables');
			await migrationManager.runMigration('002_create_auth_indexes');

			// Test that indexes exist by checking sqlite_master
			const indexes = await db.all(`
				SELECT name FROM sqlite_master
				WHERE type='index' AND name LIKE 'idx_%'
			`);

			const expectedIndexes = [
				'idx_auth_sessions_user_id',
				'idx_auth_sessions_token',
				'idx_auth_sessions_expires_at',
				'idx_user_devices_user_id',
				'idx_user_devices_fingerprint',
				'idx_webauthn_credentials_user_id',
				'idx_webauthn_credentials_credential_id',
				'idx_oauth_accounts_user_id',
				'idx_oauth_accounts_provider',
				'idx_auth_events_user_id',
				'idx_auth_events_created_at',
				'idx_certificates_domain',
				'idx_certificates_active'
			];

			const indexNames = indexes.map(idx => idx.name);
			expectedIndexes.forEach(expectedIdx => {
				expect(indexNames).toContain(expectedIdx);
			});
		});

		it('should enforce foreign key constraints', async () => {
			await migrationManager.runMigration('001_create_auth_tables');

			// Create a user first
			const userResult = await db.run(`
				INSERT INTO users (username, email) VALUES ('testuser', 'test@example.com')
			`);

			// Try to create device with invalid user_id - should fail
			await expect(
				db.run(`
					INSERT INTO user_devices (user_id, device_name, device_fingerprint)
					VALUES (99999, 'Test Device', 'fp123')
				`)
			).rejects.toThrow();

			// Valid insertion should work
			const deviceResult = await db.run(`
				INSERT INTO user_devices (user_id, device_name, device_fingerprint)
				VALUES (?, 'Test Device', 'fp123')
			`, [userResult.lastID]);
			expect(deviceResult.lastID).toBeGreaterThan(0);
		});

		it('should handle unique constraints properly', async () => {
			await migrationManager.runMigration('001_create_auth_tables');

			// Create first user
			await db.run(`
				INSERT INTO users (username, email) VALUES ('testuser', 'test@example.com')
			`);

			// Try to create user with same username - should fail
			await expect(
				db.run(`
					INSERT INTO users (username, email) VALUES ('testuser', 'different@example.com')
				`)
			).rejects.toThrow();

			// Try to create user with same email - should fail
			await expect(
				db.run(`
					INSERT INTO users (username, email) VALUES ('differentuser', 'test@example.com')
				`)
			).rejects.toThrow();
		});
	});

	describe('Migration Rollback', () => {
		it('should rollback auth table creation', async () => {
			// Apply migration
			await migrationManager.runMigration('001_create_auth_tables');

			// Verify tables exist
			const tablesBefore = await db.all(`
				SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%user%'
			`);
			expect(tablesBefore.length).toBeGreaterThan(0);

			// Rollback migration
			await migrationManager.rollbackMigration('001_create_auth_tables');

			// Verify tables are removed
			const tablesAfter = await db.all(`
				SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%user%'
			`);
			expect(tablesAfter.length).toBe(0);
		});

		it('should preserve existing data during partial rollback', async () => {
			// Apply migration and add data
			await migrationManager.runMigration('001_create_auth_tables');

			// Add some existing session data to verify preservation
			await db.createRunSession('test-session', 'pty', { cwd: '/tmp' });

			// Rollback auth tables
			await migrationManager.rollbackMigration('001_create_auth_tables');

			// Verify original session data is preserved
			const session = await db.getRunSession('test-session');
			expect(session).toBeTruthy();
			expect(session.kind).toBe('pty');
		});
	});

	describe('Migration State Management', () => {
		it('should track applied migrations', async () => {
			await migrationManager.runMigration('001_create_auth_tables');

			const appliedMigrations = await migrationManager.getAppliedMigrations();
			expect(appliedMigrations).toContain('001_create_auth_tables');
		});

		it('should prevent double-applying migrations', async () => {
			await migrationManager.runMigration('001_create_auth_tables');

			// Second application should be idempotent
			await expect(
				migrationManager.runMigration('001_create_auth_tables')
			).resolves.not.toThrow();
		});

		it('should validate migration dependencies', async () => {
			// Try to apply index migration without table migration
			await expect(
				migrationManager.runMigration('002_create_auth_indexes')
			).rejects.toThrow('Dependencies not met');
		});
	});

	describe('Data Seeding', () => {
		it('should create initial admin user from TERMINAL_KEY', async () => {
			// Set test environment
			process.env.TERMINAL_KEY = 'test-admin-key';

			await migrationManager.runMigration('001_create_auth_tables');
			await migrationManager.runMigration('003_seed_initial_admin');

			// Check admin user was created
			const adminUser = await db.get(`
				SELECT * FROM users WHERE is_admin = 1
			`);
			expect(adminUser).toBeTruthy();
			expect(adminUser.username).toBe('admin');
			expect(adminUser.is_admin).toBe(1);

			// Clean up environment
			delete process.env.TERMINAL_KEY;
		});

		it('should migrate existing settings to auth categories', async () => {
			// Setup existing tunnel settings
			await db.setSettingsForCategory('tunnel', {
				enabled: true,
				subdomain: 'test-dispatch'
			});

			await migrationManager.runMigration('001_create_auth_tables');
			await migrationManager.runMigration('003_seed_initial_admin');

			// Check that auth settings were initialized
			const authSettings = await db.getSettingsByCategory('auth');
			expect(authSettings).toHaveProperty('enabled_methods');
			expect(authSettings.enabled_methods).toContain('local');

			const securitySettings = await db.getSettingsByCategory('security');
			expect(securitySettings).toHaveProperty('require_device_trust');
		});
	});

	describe('Cleanup Jobs Integration', () => {
		it('should support expired session cleanup after migration', async () => {
			await migrationManager.runMigration('001_create_auth_tables');

			// Create user and expired session
			const userResult = await db.run(`
				INSERT INTO users (username, email) VALUES ('testuser', 'test@example.com')
			`);

			const expiredTime = Date.now() - 86400000; // 1 day ago
			await db.run(`
				INSERT INTO auth_sessions (user_id, session_token, expires_at)
				VALUES (?, 'expired_token', ?)
			`, [userResult.lastID, expiredTime]);

			// Run cleanup job
			const deletedCount = await db.run(`
				DELETE FROM auth_sessions WHERE expires_at < ?
			`, [Date.now()]);

			expect(deletedCount.changes).toBe(1);
		});
	});
});