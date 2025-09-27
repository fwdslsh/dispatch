import { logger } from '../../utils/logger.js';

/**
 * Local authentication adapter for simple username/password auth
 * Supports both legacy terminal key and proper password authentication
 */
export class LocalAuthAdapter {
	constructor(databaseManager, daos) {
		this.db = databaseManager;
		this.daos = daos;
		this.name = 'local';
	}

	/**
	 * Authenticate user with username and password or access code
	 */
	async authenticate(credentials) {
		try {
			logger.info('LOCAL_AUTH', `Authenticate called with credentials: ${JSON.stringify(credentials)}`);
			const { username, password, accessCode } = credentials;

			// Handle access code authentication (simple terminal key)
			if (accessCode) {
				logger.info('LOCAL_AUTH', `Using access code authentication with code: ${accessCode}`);
				return await this.authenticateWithAccessCode(accessCode);
			}

			// Handle username/password authentication
			if (!username || !password) {
				return {
					success: false,
					error: 'Username and password are required',
					reason: 'missing_credentials'
				};
			}

			// Find user by username
			const user = await this.daos.users.getByUsername(username);
			if (!user) {
				return {
					success: false,
					error: 'Invalid credentials',
					reason: 'user_not_found',
					username: username
				};
			}

			// Check if user is active
			if (!user.isActive) {
				return {
					success: false,
					error: 'Account is disabled',
					reason: 'account_disabled',
					userId: user.id
				};
			}

			// Verify password
			const isValidPassword = await this.verifyPassword(password, user.passwordHash);
			if (!isValidPassword) {
				return {
					success: false,
					error: 'Invalid credentials',
					reason: 'invalid_password',
					userId: user.id
				};
			}

			// Return successful authentication
			return {
				success: true,
				user: {
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					email: user.email,
					isAdmin: user.isAdmin,
					isActive: user.isActive
				}
			};
		} catch (error) {
			logger.error('LOCAL_AUTH', `Authentication error: ${error.message}`);
			return {
				success: false,
				error: 'Authentication failed',
				reason: 'internal_error'
			};
		}
	}

	/**
	 * Verify password against stored hash
	 */
	async verifyPassword(password, storedHash) {
		try {
			// Check if it's a properly hashed password (contains salt separator)
			if (storedHash.includes(':')) {
				return await this.verifyHashedPassword(password, storedHash);
			}

			// Direct comparison for simple stored passwords (not recommended)
			return password === storedHash;
		} catch (error) {
			logger.error('LOCAL_AUTH', `Password verification error: ${error.message}`);
			return false;
		}
	}

	/**
	 * Verify hashed password using PBKDF2
	 */
	async verifyHashedPassword(password, hashedPassword) {
		try {
			const { pbkdf2 } = await import('crypto');
			const { promisify } = await import('util');
			const pbkdf2Async = promisify(pbkdf2);

			const [salt, storedHash] = hashedPassword.split(':');
			if (!salt || !storedHash) {
				return false;
			}

			const hash = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
			return storedHash === hash.toString('hex');
		} catch (error) {
			logger.error('LOCAL_AUTH', `Hashed password verification error: ${error.message}`);
			return false;
		}
	}

	/**
	 * Validate credentials format (called during registration)
	 */
	validateCredentials(credentials) {
		const { username, password } = credentials;

		const errors = [];

		// Username validation
		if (!username) {
			errors.push('Username is required');
		} else if (username.length < 3) {
			errors.push('Username must be at least 3 characters long');
		} else if (username.length > 50) {
			errors.push('Username must be less than 50 characters long');
		} else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			errors.push('Username can only contain letters, numbers, underscores, and hyphens');
		}

		// Password validation
		if (!password) {
			errors.push('Password is required');
		} else if (password.length < 8) {
			errors.push('Password must be at least 8 characters long');
		} else if (password.length > 128) {
			errors.push('Password must be less than 128 characters long');
		}

		return {
			valid: errors.length === 0,
			errors: errors
		};
	}

	/**
	 * Hash password for storage
	 */
	async hashPassword(password) {
		try {
			const { pbkdf2, randomBytes } = await import('crypto');
			const { promisify } = await import('util');
			const pbkdf2Async = promisify(pbkdf2);

			const salt = randomBytes(32).toString('hex');
			const hash = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
			return salt + ':' + hash.toString('hex');
		} catch (error) {
			logger.error('LOCAL_AUTH', `Password hashing error: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Create new user account (for admin registration)
	 */
	async createUser(userData) {
		try {
			const { username, password, email, displayName, isAdmin = false } = userData;

			// Validate credentials
			const validation = this.validateCredentials({ username, password });
			if (!validation.valid) {
				return {
					success: false,
					errors: validation.errors
				};
			}

			// Check if user already exists
			const existingUser = await this.daos.users.getByUsername(username);
			if (existingUser) {
				return {
					success: false,
					errors: ['Username already exists']
				};
			}

			if (email) {
				const existingEmail = await this.daos.users.getByEmail(email);
				if (existingEmail) {
					return {
						success: false,
						errors: ['Email already exists']
					};
				}
			}

			// Hash password
			const passwordHash = await this.hashPassword(password);

			// Create user
			const user = await this.daos.users.create({
				username,
				displayName: displayName || username,
				email,
				passwordHash,
				isAdmin,
				isActive: true
			});

			logger.info('LOCAL_AUTH', `Created new user: ${username} (ID: ${user.id})`);

			return {
				success: true,
				user: {
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					email: user.email,
					isAdmin: user.isAdmin
				}
			};
		} catch (error) {
			logger.error('LOCAL_AUTH', `User creation error: ${error.message}`);
			return {
				success: false,
				errors: ['Failed to create user account']
			};
		}
	}

	/**
	 * Update user password
	 */
	async updatePassword(userId, currentPassword, newPassword) {
		try {
			// Get user
			const user = await this.daos.users.getById(userId);
			if (!user) {
				return {
					success: false,
					error: 'User not found'
				};
			}

			// Verify current password
			const isValidCurrent = await this.verifyPassword(currentPassword, user.passwordHash);
			if (!isValidCurrent) {
				return {
					success: false,
					error: 'Current password is incorrect'
				};
			}

			// Validate new password
			const validation = this.validateCredentials({
				username: user.username,
				password: newPassword
			});
			if (!validation.valid) {
				return {
					success: false,
					errors: validation.errors
				};
			}

			// Hash new password
			const newPasswordHash = await this.hashPassword(newPassword);

			// Update user
			await this.daos.users.update(userId, { passwordHash: newPasswordHash });

			logger.info('LOCAL_AUTH', `Updated password for user: ${user.username} (ID: ${userId})`);

			return { success: true };
		} catch (error) {
			logger.error('LOCAL_AUTH', `Password update error: ${error.message}`);
			return {
				success: false,
				error: 'Failed to update password'
			};
		}
	}

	/**
	 * Enable or disable user account
	 */
	async setUserActive(userId, isActive) {
		try {
			const user = await this.daos.users.getById(userId);
			if (!user) {
				return {
					success: false,
					error: 'User not found'
				};
			}

			await this.daos.users.update(userId, { isActive });

			logger.info('LOCAL_AUTH', `Set user ${user.username} active status to: ${isActive}`);

			return { success: true };
		} catch (error) {
			logger.error('LOCAL_AUTH', `Set user active error: ${error.message}`);
			return {
				success: false,
				error: 'Failed to update user status'
			};
		}
	}

	/**
	 * Get adapter configuration
	 */
	getConfig() {
		return {
			name: this.name,
			displayName: 'Local Authentication',
			description: 'Username and password authentication',
			supportsRegistration: true,
			supportsPasswordReset: true,
			requiresSetup: false
		};
	}

	/**
	 * Check if adapter is properly configured
	 */
	async isConfigured() {
		// Local auth is always available - no external dependencies
		return true;
	}

	/**
	 * Get authentication form fields for frontend
	 */
	getAuthFields() {
		return [
			{
				name: 'username',
				type: 'text',
				label: 'Username',
				required: true,
				placeholder: 'Enter your username'
			},
			{
				name: 'password',
				type: 'password',
				label: 'Password',
				required: true,
				placeholder: 'Enter your password'
			}
		];
	}

	/**
	 * Authenticate with access code (terminal key)
	 */
	async authenticateWithAccessCode(accessCode) {
		try {
			// Get terminal key from environment
			const terminalKey = process.env.TERMINAL_KEY || 'change-me';

			// Check if access code matches terminal key
			if (accessCode !== terminalKey) {
				return {
					success: false,
					error: 'Invalid access code',
					reason: 'invalid_access_code'
				};
			}

			// For access code authentication, return the admin user
			// This is a simplified approach - in a more complex setup,
			// you might have different access codes for different users
			const adminUser = await this.daos.users.getByUsername('admin');
			if (!adminUser) {
				return {
					success: false,
					error: 'Admin user not found',
					reason: 'user_not_found'
				};
			}

			// Check if admin user is active
			if (!adminUser.isActive) {
				return {
					success: false,
					error: 'Admin account is disabled',
					reason: 'account_disabled'
				};
			}

			logger.info('LOCAL_AUTH', `Access code authentication successful for admin user`);

			return {
				success: true,
				user: {
					id: adminUser.id,
					username: adminUser.username,
					displayName: adminUser.displayName,
					email: adminUser.email,
					isAdmin: adminUser.isAdmin,
					isActive: adminUser.isActive
				},
				authMethod: 'access_code'
			};
		} catch (error) {
			logger.error('LOCAL_AUTH', `Access code authentication error: ${error.message}`);
			return {
				success: false,
				error: 'Authentication failed',
				reason: 'auth_error'
			};
		}
	}
}
