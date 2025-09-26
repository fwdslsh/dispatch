import { createDAOs } from './models/index.js';
import { logger } from '../utils/logger.js';

// Simple password hashing using Node.js crypto (without bcrypt dependency for now)
import { createHash, randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';
const pbkdf2Async = promisify(pbkdf2);

/**
 * Handles creation of initial admin user during system setup
 * Migrates from TERMINAL_KEY to proper user-based authentication
 */
export class AdminUserSeeder {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
	}

	/**
	 * Create initial admin user based on existing TERMINAL_KEY
	 * This provides backward compatibility for key-based authentication
	 */
	async createInitialAdmin(options = {}) {
		const {
			terminalKey = process.env.TERMINAL_KEY || 'change-me',
			username = 'admin',
			displayName = 'Administrator',
			email = null,
			forceCreate = false
		} = options;

		try {
			// Check if any admin user already exists
			const existingAdmins = await this.daos.users.getAdmins();
			if (existingAdmins.length > 0 && !forceCreate) {
				logger.info('SEEDER', `Admin user already exists: ${existingAdmins[0].username}`);
				return existingAdmins[0];
			}

			// Check if username is already taken
			if (await this.daos.users.exists(username, email)) {
				if (!forceCreate) {
					throw new Error(`Username '${username}' or email already exists`);
				}
				// If forcing, delete existing user
				const existing = await this.daos.users.getByUsername(username);
				if (existing) {
					await this.daos.users.delete(existing.id, true); // Hard delete
					logger.info('SEEDER', `Removed existing user '${username}' for admin creation`);
				}
			}

			// Hash the terminal key as the initial password
			const passwordHash = await this.hashPassword(terminalKey);

			// Create the admin user
			const adminUser = await this.daos.users.create({
				username,
				displayName,
				email,
				passwordHash,
				isAdmin: true,
				isActive: true
			});

			logger.info(
				'SEEDER',
				`Created initial admin user: ${adminUser.username} (ID: ${adminUser.id})`
			);

			// Log the admin creation event
			await this.daos.authEvents.create({
				userId: adminUser.id,
				eventType: 'admin_created',
				details: {
					method: 'initial_setup',
					username: adminUser.username
				}
			});

			return adminUser;
		} catch (error) {
			logger.error('SEEDER', `Failed to create initial admin user: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Create admin user from command line or setup process
	 */
	async createAdminInteractive(adminData) {
		const { username, password, email = null, displayName = null } = adminData;

		// Validate input
		if (!username || username.length < 3) {
			throw new Error('Username must be at least 3 characters long');
		}

		if (!password || password.length < 8) {
			throw new Error('Password must be at least 8 characters long');
		}

		// Check if username/email already exists
		if (await this.daos.users.exists(username, email)) {
			throw new Error('Username or email already exists');
		}

		try {
			// Hash password
			const passwordHash = await this.hashPassword(password);

			// Create admin user
			const adminUser = await this.daos.users.create({
				username,
				displayName: displayName || username,
				email,
				passwordHash,
				isAdmin: true,
				isActive: true
			});

			logger.info('SEEDER', `Created admin user: ${adminUser.username} (ID: ${adminUser.id})`);

			// Log the admin creation event
			await this.daos.authEvents.create({
				userId: adminUser.id,
				eventType: 'admin_created',
				details: {
					method: 'interactive_setup',
					username: adminUser.username
				}
			});

			return adminUser;
		} catch (error) {
			logger.error('SEEDER', `Failed to create admin user: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Update existing admin password
	 */
	async updateAdminPassword(username, newPassword) {
		try {
			const adminUser = await this.daos.users.getByUsername(username);
			if (!adminUser) {
				throw new Error(`Admin user '${username}' not found`);
			}

			if (!adminUser.isAdmin) {
				throw new Error(`User '${username}' is not an admin`);
			}

			// Hash new password
			const passwordHash = await this.hashPassword(newPassword);

			// Update user
			await this.daos.users.update(adminUser.id, { passwordHash });

			// Revoke all existing sessions for security
			await this.daos.authSessions.revokeAllForUser(adminUser.id);

			logger.info('SEEDER', `Updated password for admin user: ${username}`);

			// Log the password change event
			await this.daos.authEvents.create({
				userId: adminUser.id,
				eventType: 'password_changed',
				details: {
					method: 'admin_update',
					username: adminUser.username,
					sessions_revoked: true
				}
			});

			return adminUser;
		} catch (error) {
			logger.error('SEEDER', `Failed to update admin password: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Verify admin credentials (for login)
	 */
	async verifyAdminCredentials(username, password) {
		try {
			const user = await this.daos.users.getByUsername(username);
			if (!user || !user.isAdmin || !user.isActive) {
				return null;
			}

			// Backward compatibility: check if password is the raw terminal key
			const terminalKey = process.env.TERMINAL_KEY || 'change-me';
			if (password === terminalKey && user.passwordHash === terminalKey) {
				// Legacy terminal key login - backward compatibility
				logger.warn('SEEDER', `Admin using terminal key authentication: ${username}`);
				return user;
			}

			// Check hashed password
			const isValid = await this.verifyPassword(password, user.passwordHash);
			return isValid ? user : null;
		} catch (error) {
			logger.error('SEEDER', `Failed to verify admin credentials: ${error.message}`);
			return null;
		}
	}

	/**
	 * Get admin user setup status
	 */
	async getSetupStatus() {
		try {
			const admins = await this.daos.users.getAdmins();
			const terminalKey = process.env.TERMINAL_KEY || 'change-me';

			if (admins.length === 0) {
				return {
					hasAdmin: false,
					needsSetup: true,
					hasTerminalKey: terminalKey !== 'change-me',
					canAutoCreate: terminalKey !== 'change-me'
				};
			}

			const admin = admins[0];

			return {
				hasAdmin: true,
				needsSetup: false,
				adminUsername: admin.username,
				totalAdmins: admins.length
			};
		} catch (error) {
			logger.error('SEEDER', `Failed to get setup status: ${error.message}`);
			return {
				hasAdmin: false,
				needsSetup: true,
				error: error.message
			};
		}
	}

	/**
	 * Migrate from terminal key to proper password
	 */
	async migrateFromTerminalKey(username, newPassword) {
		try {
			const user = await this.daos.users.getByUsername(username);
			if (!user || !user.isAdmin) {
				throw new Error('Admin user not found');
			}

			const terminalKey = process.env.TERMINAL_KEY || 'change-me';
			if (user.passwordHash !== terminalKey) {
				throw new Error('User is not using terminal key authentication');
			}

			// Update to proper hashed password
			const passwordHash = await this.hashPassword(newPassword);
			await this.daos.users.update(user.id, { passwordHash });

			// Revoke all sessions to force re-login
			await this.daos.authSessions.revokeAllForUser(user.id);

			logger.info('SEEDER', `Updated admin '${username}' password authentication`);

			return user;
		} catch (error) {
			logger.error('SEEDER', `Failed to update admin password: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Hash password using PBKDF2 with salt
	 */
	async hashPassword(password) {
		const salt = randomBytes(32).toString('hex');
		const hash = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
		return salt + ':' + hash.toString('hex');
	}

	/**
	 * Verify password against hash
	 */
	async verifyPassword(password, hashedPassword) {
		const [salt, storedHash] = hashedPassword.split(':');
		if (!salt || !storedHash) {
			return false;
		}

		const hash = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
		return storedHash === hash.toString('hex');
	}
}
