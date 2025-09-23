import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../shared/utils/logger.js';

/**
 * Authentication Manager for Dispatch
 * Handles SSH key, GitHub OAuth, Google OAuth, and legacy key-based authentication
 */
export class AuthManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.jwtSecret = process.env.JWT_SECRET || this.generateSecret();
		this.isFirstUser = true; // Will be set based on DB check
	}

	async init() {
		await this.createAuthTables();
		await this.checkFirstUser();
	}

	generateSecret() {
		// Generate a random secret for JWT signing
		return crypto.randomBytes(64).toString('hex');
	}

	async createAuthTables() {
		// Users table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				username TEXT UNIQUE,
				email TEXT,
				is_admin BOOLEAN DEFAULT FALSE,
				auth_methods TEXT NOT NULL, -- JSON array of enabled auth methods
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		// Authentication sessions table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS auth_sessions (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				method TEXT NOT NULL, -- 'ssh_key', 'github_oauth', 'google_oauth', 'legacy_key'
				expires_at INTEGER NOT NULL,
				created_at INTEGER NOT NULL,
				metadata TEXT, -- JSON for method-specific data
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		// SSH keys table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS ssh_keys (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				public_key TEXT NOT NULL,
				fingerprint TEXT UNIQUE NOT NULL,
				name TEXT,
				created_at INTEGER NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		// OAuth providers configuration
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS oauth_config (
				provider TEXT PRIMARY KEY, -- 'github' or 'google'
				client_id TEXT NOT NULL,
				client_secret TEXT NOT NULL,
				enabled BOOLEAN DEFAULT TRUE,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		// OAuth states for CSRF protection
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS oauth_states (
				state TEXT PRIMARY KEY,
				provider TEXT NOT NULL,
				expires_at INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);

		// Create indexes
		await this.db.run('CREATE INDEX IF NOT EXISTS ix_auth_sessions_user ON auth_sessions(user_id)');
		await this.db.run('CREATE INDEX IF NOT EXISTS ix_auth_sessions_expires ON auth_sessions(expires_at)');
		await this.db.run('CREATE INDEX IF NOT EXISTS ix_ssh_keys_user ON ssh_keys(user_id)');
		await this.db.run('CREATE INDEX IF NOT EXISTS ix_oauth_states_expires ON oauth_states(expires_at)');
	}

	async checkFirstUser() {
		const userCount = await this.db.get('SELECT COUNT(*) as count FROM users');
		this.isFirstUser = userCount.count === 0;
		return this.isFirstUser;
	}

	/**
	 * Create a new user (setup/legacy method)
	 */
	async createUserLegacy(username, email, isAdmin = false, authMethods = []) {
		const userId = crypto.randomUUID();
		const now = Date.now();

		await this.db.run(
			`INSERT INTO users (id, username, email, is_admin, auth_methods, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[userId, username, email, isAdmin, JSON.stringify(authMethods), now, now]
		);

		return userId;
	}

	/**
	 * Generate a secure session token
	 */
	generateSessionToken() {
		return crypto.randomBytes(32).toString('hex');
	}

	/**
	 * Create an authentication session
	 */
	async createSession(userId, method, expiresInMs = 7 * 24 * 60 * 60 * 1000, metadata = {}) {
		const sessionId = this.generateSessionToken();
		const now = Date.now();
		const expiresAt = now + expiresInMs;

		await this.db.run(
			`INSERT INTO auth_sessions (id, user_id, method, expires_at, created_at, metadata)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[sessionId, userId, method, expiresAt, now, JSON.stringify(metadata)]
		);

		return {
			sessionId,
			expiresAt,
			token: this.generateJWT(userId, sessionId, method)
		};
	}

	/**
	 * Generate JWT token for session
	 */
	generateJWT(userId, sessionId, method) {
		return jwt.sign(
			{
				userId,
				sessionId,
				method,
				iat: Math.floor(Date.now() / 1000)
			},
			this.jwtSecret,
			{ expiresIn: '7d' }
		);
	}

	/**
	 * Verify JWT token and get session info
	 */
	async verifyToken(token) {
		try {
			const decoded = jwt.verify(token, this.jwtSecret);
			const session = await this.db.get(
				'SELECT * FROM auth_sessions WHERE id = ? AND user_id = ? AND expires_at > ?',
				[decoded.sessionId, decoded.userId, Date.now()]
			);

			if (!session) {
				return null;
			}

			return {
				userId: decoded.userId,
				sessionId: decoded.sessionId,
				method: decoded.method,
				session
			};
		} catch (error) {
			logger.warn('AUTH', 'Invalid token:', error.message);
			return null;
		}
	}

	/**
	 * Clean up expired sessions and OAuth states
	 */
	async cleanupExpired() {
		const now = Date.now();
		await this.db.run('DELETE FROM auth_sessions WHERE expires_at < ?', [now]);
		await this.db.run('DELETE FROM oauth_states WHERE expires_at < ?', [now]);
	}

	/**
	 * Add SSH key for user
	 */
	async addSSHKey(userId, publicKey, name = null) {
		const keyId = crypto.randomUUID();
		const fingerprint = this.generateSSHFingerprint(publicKey);
		const now = Date.now();

		await this.db.run(
			`INSERT INTO ssh_keys (id, user_id, public_key, fingerprint, name, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[keyId, userId, publicKey, fingerprint, name, now]
		);

		return { keyId, fingerprint };
	}

	/**
	 * Generate SSH key fingerprint
	 */
	generateSSHKeyFingerprint(publicKey) {
		// Simple hash-based fingerprint for SSH keys
		return crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
	}

	// Alias for backwards compatibility
	generateSSHFingerprint(publicKey) {
		return this.generateSSHKeyFingerprint(publicKey);
	}

	/**
	 * Verify SSH key authentication
	 */
	async verifySSHKey(publicKey) {
		const fingerprint = this.generateSSHFingerprint(publicKey);
		const sshKey = await this.db.get(
			'SELECT sk.*, u.* FROM ssh_keys sk JOIN users u ON sk.user_id = u.id WHERE sk.fingerprint = ?',
			[fingerprint]
		);

		return sshKey || null;
	}

	/**
	 * Handle first user SSH key authentication - creates user and sets as admin
	 */
	async handleFirstUserSSHAuth(publicKey, email = null, username = null) {
		// Check if this is indeed the first user
		const isFirstUser = await this.checkFirstUser();
		if (!isFirstUser) {
			return null; // Not first user, use normal auth flow
		}

		// Create first admin user
		const defaultUsername = username || 'admin';
		const defaultEmail = email || 'admin@dispatch.local';

		const userId = await this.createUserLegacy(defaultUsername, defaultEmail, true, ['ssh_key']);

		// Add SSH key for the user
		await this.addSSHKey(userId, publicKey, 'First Admin Key');

		// Update first user status
		this.isFirstUser = false;

		// Return user data in same format as verifySSHKey
		const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
		const sshKey = await this.db.get('SELECT * FROM ssh_keys WHERE user_id = ?', [userId]);

		return {
			...sshKey,
			user_id: user.id,
			username: user.username,
			email: user.email,
			is_admin: user.is_admin
		};
	}

	/**
	 * Store OAuth configuration
	 */
	async setOAuthConfig(provider, clientId, clientSecret) {
		const now = Date.now();
		await this.db.run(
			`INSERT OR REPLACE INTO oauth_config (provider, client_id, client_secret, enabled, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[provider, clientId, clientSecret, true, now, now]
		);
	}

	/**
	 * Get OAuth configuration
	 */
	async getOAuthConfig(provider) {
		return await this.db.get('SELECT * FROM oauth_config WHERE provider = ? AND enabled = ?', [
			provider,
			true
		]);
	}

	/**
	 * Create OAuth state for CSRF protection
	 */
	async createOAuthState(provider, expiresInMs = 10 * 60 * 1000) {
		const state = crypto.randomBytes(32).toString('hex');
		const now = Date.now();
		const expiresAt = now + expiresInMs;

		await this.db.run(
			'INSERT INTO oauth_states (state, provider, expires_at, created_at) VALUES (?, ?, ?, ?)',
			[state, provider, expiresAt, now]
		);

		return state;
	}

	/**
	 * Verify OAuth state
	 */
	async verifyOAuthState(state, provider) {
		const stateRecord = await this.db.get(
			'SELECT * FROM oauth_states WHERE state = ? AND provider = ? AND expires_at > ?',
			[state, provider, Date.now()]
		);

		if (stateRecord) {
			// Delete used state
			await this.db.run('DELETE FROM oauth_states WHERE state = ?', [state]);
			return true;
		}

		return false;
	}

	/**
	 * Find or create user from OAuth profile
	 */
	async findOrCreateOAuthUser(provider, profile) {
		// Try to find existing user by email
		let user = await this.db.get('SELECT * FROM users WHERE email = ?', [profile.email]);

		if (!user) {
			// Create new user
			const userId = await this.createUserLegacy(
				profile.username || profile.login || profile.email,
				profile.email,
				this.isFirstUser, // First user becomes admin
				[`${provider}_oauth`]
			);
			user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
			
			// Update first user status
			if (this.isFirstUser) {
				this.isFirstUser = false;
			}
		} else {
			// Update auth methods if needed
			const authMethods = JSON.parse(user.auth_methods || '[]');
			const oauthMethod = `${provider}_oauth`;
			if (!authMethods.includes(oauthMethod)) {
				authMethods.push(oauthMethod);
				await this.db.run(
					'UPDATE users SET auth_methods = ?, updated_at = ? WHERE id = ?',
					[JSON.stringify(authMethods), Date.now(), user.id]
				);
			}
		}

		return user;
	}

	/**
	 * Admin User Management Methods
	 */

	/**
	 * Get all users (admin only)
	 */
	async getAllUsers() {
		const users = await this.db.all(`
			SELECT
				id, username, email, is_admin, auth_methods,
				created_at, updated_at,
				(SELECT MAX(created_at) FROM auth_sessions WHERE user_id = users.id) as last_login_at
			FROM users
			ORDER BY created_at ASC
		`);

		return users.map(user => ({
			...user,
			isAdmin: !!user.is_admin,
			authMethods: JSON.parse(user.auth_methods || '[]'),
			createdAt: user.created_at,
			updatedAt: user.updated_at,
			lastLoginAt: user.last_login_at
		}));
	}

	/**
	 * Create user (admin API version)
	 */
	async createUser(userData) {
		const { username, email, isAdmin = false } = userData;
		const userId = crypto.randomUUID();
		const now = Date.now();

		await this.db.run(
			`INSERT INTO users (id, username, email, is_admin, auth_methods, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[userId, username, email, isAdmin, JSON.stringify([]), now, now]
		);

		const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
		return {
			...user,
			isAdmin: !!user.is_admin,
			authMethods: JSON.parse(user.auth_methods || '[]'),
			createdAt: user.created_at,
			updatedAt: user.updated_at
		};
	}

	/**
	 * Update user (admin only)
	 */
	async updateUser(userId, updates) {
		const { username, email, isAdmin } = updates;
		const now = Date.now();

		await this.db.run(
			`UPDATE users
			 SET username = ?, email = ?, is_admin = ?, updated_at = ?
			 WHERE id = ?`,
			[username, email, isAdmin, now, userId]
		);

		const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
		return {
			...user,
			isAdmin: !!user.is_admin,
			authMethods: JSON.parse(user.auth_methods || '[]'),
			createdAt: user.created_at,
			updatedAt: user.updated_at
		};
	}

	/**
	 * Delete user (admin only)
	 */
	async deleteUser(userId) {
		// Delete user's SSH keys
		await this.db.run('DELETE FROM ssh_keys WHERE user_id = ?', [userId]);

		// Delete user's sessions
		await this.db.run('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);

		// Delete user
		await this.db.run('DELETE FROM users WHERE id = ?', [userId]);
	}

	/**
	 * SSH Key Management for Admin
	 */

	/**
	 * Get SSH keys for a user (admin only)
	 */
	async getUserSSHKeys(userId) {
		const keys = await this.db.all(
			'SELECT id, name, public_key, fingerprint, created_at FROM ssh_keys WHERE user_id = ? ORDER BY created_at DESC',
			[userId]
		);

		return keys.map(key => ({
			...key,
			publicKey: key.public_key,
			createdAt: key.created_at
		}));
	}

	/**
	 * Add SSH key for user (admin only)
	 */
	async addUserSSHKey(userId, keyData) {
		const { name, publicKey } = keyData;
		const keyId = crypto.randomUUID();
		const fingerprint = this.generateSSHKeyFingerprint(publicKey);
		const now = Date.now();

		await this.db.run(
			`INSERT INTO ssh_keys (id, user_id, public_key, fingerprint, name, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[keyId, userId, publicKey, fingerprint, name, now]
		);

		const key = await this.db.get('SELECT * FROM ssh_keys WHERE id = ?', [keyId]);
		return {
			...key,
			publicKey: key.public_key,
			createdAt: key.created_at
		};
	}

	/**
	 * Delete SSH key (admin only)
	 */
	async deleteUserSSHKey(userId, keyId) {
		await this.db.run('DELETE FROM ssh_keys WHERE id = ? AND user_id = ?', [keyId, userId]);
	}

	/**
	 * OAuth Configuration Management
	 */

	/**
	 * Get all OAuth configuration (admin only)
	 */
	async getAllOAuthConfig() {
		const configs = await this.db.all('SELECT * FROM oauth_config');

		const result = {
			github: { enabled: false, clientId: '', clientSecret: '' },
			google: { enabled: false, clientId: '', clientSecret: '' }
		};

		for (const config of configs) {
			if (config.provider === 'github' || config.provider === 'google') {
				result[config.provider] = {
					enabled: !!config.enabled,
					clientId: config.client_id || '',
					clientSecret: config.client_secret || ''
				};
			}
		}

		return result;
	}

	/**
	 * Get user by ID
	 */
	async getUserById(userId) {
		return await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
	}

	/**
	 * Verify JWT token
	 */
	verifyJWT(token) {
		return jwt.verify(token, this.jwtSecret);
	}

	/**
	 * Update OAuth configuration (admin only)
	 */
	async updateOAuthConfig(oauthConfig) {
		const now = Date.now();

		for (const [provider, config] of Object.entries(oauthConfig)) {
			if (provider === 'github' || provider === 'google') {
				if (config.enabled && config.clientId && config.clientSecret) {
					// Insert or update OAuth config
					await this.db.run(`
						INSERT OR REPLACE INTO oauth_config
						(provider, client_id, client_secret, enabled, created_at, updated_at)
						VALUES (?, ?, ?, ?, ?, ?)
					`, [provider, config.clientId, config.clientSecret, true, now, now]);
				} else {
					// Disable or remove config
					await this.db.run(`
						INSERT OR REPLACE INTO oauth_config
						(provider, client_id, client_secret, enabled, created_at, updated_at)
						VALUES (?, ?, ?, ?, ?, ?)
					`, [provider, '', '', false, now, now]);
				}
			}
		}
	}
}