import { logger } from '../utils/logger.js';

/**
 * Manages authentication-related database migrations
 * Provides rollback capabilities and tracks migration state
 */
export class AuthMigrationManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.migrations = new Map();
		this.initializeMigrations();
	}

	/**
	 * Initialize all available migrations with their up/down scripts
	 */
	initializeMigrations() {
		// Migration 001: Create auth tables
		this.migrations.set('001_create_auth_tables', {
			dependencies: [],
			up: async () => {
				// Users table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS users (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						username TEXT UNIQUE NOT NULL,
						display_name TEXT,
						email TEXT UNIQUE,
						password_hash TEXT,
						is_admin BOOLEAN DEFAULT FALSE,
						is_active BOOLEAN DEFAULT TRUE,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`);

				// User devices table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS user_devices (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER NOT NULL,
						device_name TEXT NOT NULL,
						device_fingerprint TEXT UNIQUE NOT NULL,
						last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						last_ip_address TEXT,
						user_agent TEXT,
						is_trusted BOOLEAN DEFAULT FALSE,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
					)
				`);

				// Authentication sessions table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS auth_sessions (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER NOT NULL,
						device_id INTEGER,
						session_token TEXT UNIQUE NOT NULL,
						expires_at DATETIME NOT NULL,
						last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						ip_address TEXT,
						user_agent TEXT,
						is_active BOOLEAN DEFAULT TRUE,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
						FOREIGN KEY (device_id) REFERENCES user_devices(id) ON DELETE SET NULL
					)
				`);

				// WebAuthn credentials table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS webauthn_credentials (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER NOT NULL,
						credential_id TEXT UNIQUE NOT NULL,
						public_key TEXT NOT NULL,
						counter INTEGER DEFAULT 0,
						device_name TEXT,
						aaguid TEXT,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						last_used_at DATETIME,
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
					)
				`);

				// OAuth accounts table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS oauth_accounts (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER NOT NULL,
						provider TEXT NOT NULL,
						provider_account_id TEXT NOT NULL,
						provider_email TEXT,
						provider_name TEXT,
						access_token TEXT,
						refresh_token TEXT,
						token_expires_at DATETIME,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						UNIQUE(provider, provider_account_id),
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
					)
				`);

				// Authentication events table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS auth_events (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER,
						device_id INTEGER,
						event_type TEXT NOT NULL,
						ip_address TEXT,
						user_agent TEXT,
						details TEXT,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
						FOREIGN KEY (device_id) REFERENCES user_devices(id) ON DELETE SET NULL
					)
				`);

				// Certificates table
				await this.db.run(`
					CREATE TABLE IF NOT EXISTS certificates (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						cert_type TEXT NOT NULL,
						domain TEXT NOT NULL,
						certificate_pem TEXT NOT NULL,
						private_key_pem TEXT NOT NULL,
						ca_certificate_pem TEXT,
						issued_at DATETIME,
						expires_at DATETIME,
						is_active BOOLEAN DEFAULT TRUE,
						auto_renew BOOLEAN DEFAULT FALSE,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
					)
				`);

				logger.info('MIGRATION', 'Created authentication tables');
			},
			down: async () => {
				// Drop tables in reverse order of creation (respecting foreign keys)
				const tables = [
					'auth_events',
					'oauth_accounts',
					'webauthn_credentials',
					'auth_sessions',
					'user_devices',
					'users',
					'certificates'
				];

				for (const table of tables) {
					await this.db.run(`DROP TABLE IF EXISTS ${table}`);
				}

				logger.info('MIGRATION', 'Dropped authentication tables');
			}
		});

		// Migration 002: Create indexes
		this.migrations.set('002_create_auth_indexes', {
			dependencies: ['001_create_auth_tables'],
			up: async () => {
				const indexes = [
					'CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)',
					'CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(session_token)',
					'CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)',
					'CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)',
					'CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(device_fingerprint)',
					'CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id)',
					'CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id)',
					'CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id)',
					'CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider, provider_account_id)',
					'CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id)',
					'CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at)',
					'CREATE INDEX IF NOT EXISTS idx_certificates_domain ON certificates(domain)',
					'CREATE INDEX IF NOT EXISTS idx_certificates_active ON certificates(is_active)'
				];

				for (const indexSql of indexes) {
					await this.db.run(indexSql);
				}

				logger.info('MIGRATION', 'Created authentication indexes');
			},
			down: async () => {
				const indexes = [
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

				for (const indexName of indexes) {
					await this.db.run(`DROP INDEX IF EXISTS ${indexName}`);
				}

				logger.info('MIGRATION', 'Dropped authentication indexes');
			}
		});

		// Migration 003: Seed initial data
		this.migrations.set('003_seed_initial_admin', {
			dependencies: ['001_create_auth_tables'],
			up: async () => {
				// Create initial admin user based on TERMINAL_KEY
				const terminalKey = process.env.TERMINAL_KEY || 'change-me';

				// Check if admin user already exists
				const existingAdmin = await this.db.get(`
					SELECT id FROM users WHERE is_admin = 1 LIMIT 1
				`);

				if (!existingAdmin) {
					await this.db.run(`
						INSERT INTO users (username, display_name, is_admin, is_active, password_hash)
						VALUES ('admin', 'Administrator', 1, 1, ?)
					`, [terminalKey]); // Store terminal key as password hash temporarily

					logger.info('MIGRATION', 'Created initial admin user');
				}

				// Initialize auth settings
				const authSettings = {
					enabled_methods: ['local'],
					default_method: 'local',
					session_timeout_hours: 24,
					max_devices_per_user: 10,
					webauthn_enabled: false,
					oauth_providers: {
						google: { enabled: false },
						github: { enabled: false }
					}
				};

				await this.db.setSettingsForCategory('auth', authSettings, 'Authentication configuration');

				// Initialize security settings
				const securitySettings = {
					require_https: false,
					hsts_enabled: false,
					require_device_trust: false,
					cors_origins: ['*'],
					csrf_protection: true,
					rate_limiting: {
						enabled: true,
						max_requests: 100,
						window_minutes: 15
					},
					cookie_settings: {
						secure: false,
						same_site: 'Lax',
						http_only: true
					}
				};

				await this.db.setSettingsForCategory('security', securitySettings, 'Security policy configuration');

				// Initialize certificate settings
				const certificateSettings = {
					active_profile: 'none',
					mkcert: {
						enabled: false,
						domains: ['localhost', '127.0.0.1']
					},
					letsencrypt: {
						enabled: false,
						email: null,
						domains: [],
						auto_renew: true
					},
					tunnel_tls: {
						enabled: false,
						auto_configure: true
					}
				};

				await this.db.setSettingsForCategory('certificates', certificateSettings, 'Certificate management configuration');

				logger.info('MIGRATION', 'Initialized auth, security, and certificate settings');
			},
			down: async () => {
				// Remove admin user
				await this.db.run(`DELETE FROM users WHERE username = 'admin'`);

				// Remove settings categories
				await this.db.deleteSettingsCategory('auth');
				await this.db.deleteSettingsCategory('security');
				await this.db.deleteSettingsCategory('certificates');

				logger.info('MIGRATION', 'Removed initial admin and settings');
			}
		});
	}

	/**
	 * Run a specific migration
	 */
	async runMigration(migrationId) {
		const migration = this.migrations.get(migrationId);
		if (!migration) {
			throw new Error(`Migration ${migrationId} not found`);
		}

		// Check if already applied
		const appliedMigrations = await this.getAppliedMigrations();
		if (appliedMigrations.includes(migrationId)) {
			logger.info('MIGRATION', `Migration ${migrationId} already applied, skipping`);
			return;
		}

		// Check dependencies
		for (const dep of migration.dependencies) {
			if (!appliedMigrations.includes(dep)) {
				throw new Error(`Dependencies not met for ${migrationId}. Missing: ${dep}`);
			}
		}

		try {
			await migration.up();
			await this.recordMigration(migrationId);
			logger.info('MIGRATION', `Successfully applied migration ${migrationId}`);
		} catch (error) {
			logger.error('MIGRATION', `Failed to apply migration ${migrationId}:`, error);
			throw error;
		}
	}

	/**
	 * Rollback a specific migration
	 */
	async rollbackMigration(migrationId) {
		const migration = this.migrations.get(migrationId);
		if (!migration) {
			throw new Error(`Migration ${migrationId} not found`);
		}

		const appliedMigrations = await this.getAppliedMigrations();
		if (!appliedMigrations.includes(migrationId)) {
			logger.info('MIGRATION', `Migration ${migrationId} not applied, skipping rollback`);
			return;
		}

		try {
			await migration.down();
			await this.removeMigrationRecord(migrationId);
			logger.info('MIGRATION', `Successfully rolled back migration ${migrationId}`);
		} catch (error) {
			logger.error('MIGRATION', `Failed to rollback migration ${migrationId}:`, error);
			throw error;
		}
	}

	/**
	 * Get list of applied migrations
	 */
	async getAppliedMigrations() {
		// Ensure migration tracking table exists
		await this.ensureMigrationTable();

		const rows = await this.db.all('SELECT migration_id FROM auth_migrations ORDER BY applied_at');
		return rows.map(row => row.migration_id);
	}

	/**
	 * Record that a migration has been applied
	 */
	async recordMigration(migrationId) {
		await this.ensureMigrationTable();

		await this.db.run(`
			INSERT INTO auth_migrations (migration_id, applied_at)
			VALUES (?, ?)
		`, [migrationId, Date.now()]);
	}

	/**
	 * Remove migration record (for rollbacks)
	 */
	async removeMigrationRecord(migrationId) {
		await this.db.run('DELETE FROM auth_migrations WHERE migration_id = ?', [migrationId]);
	}

	/**
	 * Ensure the migration tracking table exists
	 */
	async ensureMigrationTable() {
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS auth_migrations (
				migration_id TEXT PRIMARY KEY,
				applied_at INTEGER NOT NULL
			)
		`);
	}

	/**
	 * Run all pending migrations in order
	 */
	async runAllMigrations() {
		const migrationOrder = [
			'001_create_auth_tables',
			'002_create_auth_indexes',
			'003_seed_initial_admin'
		];

		for (const migrationId of migrationOrder) {
			await this.runMigration(migrationId);
		}
	}
}