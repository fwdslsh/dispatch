import { createDAOs } from '../db/models/index.js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Admin Interface Manager
 * Provides comprehensive admin functionality for user management, device management,
 * session management, authentication configuration, and system monitoring.
 */
export class AdminInterfaceManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
	}

	// User Management
	async listUsers({ page = 1, limit = 10, search = '', orderBy = 'created_at', order = 'DESC' } = {}) {
		const offset = (page - 1) * limit;
		let query = `
			SELECT u.id, u.username, u.display_name, u.email, u.is_admin as isAdmin,
				   u.created_at as createdAt, u.updated_at as lastLogin,
				   COUNT(DISTINCT d.id) as deviceCount,
				   COUNT(DISTINCT s.id) as activeSessionCount
			FROM users u
			LEFT JOIN user_devices d ON u.id = d.user_id
			LEFT JOIN auth_sessions s ON u.id = s.user_id AND s.is_active = 1
		`;
		const params = [];

		if (search) {
			query += ` WHERE (u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)`;
			const searchPattern = `%${search}%`;
			params.push(searchPattern, searchPattern, searchPattern);
		}

		query += ` GROUP BY u.id ORDER BY u.${orderBy} ${order} LIMIT ? OFFSET ?`;
		params.push(limit, offset);

		const users = await this.db.all(query, params);

		// Get total count for pagination
		let countQuery = 'SELECT COUNT(*) as total FROM users u';
		const countParams = [];
		if (search) {
			countQuery += ' WHERE (u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)';
			const searchPattern = `%${search}%`;
			countParams.push(searchPattern, searchPattern, searchPattern);
		}

		const { total } = await this.db.get(countQuery, countParams);

		return {
			users,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit)
			}
		};
	}

	async createUser({ username, displayName, email, password, isAdmin = false }) {
		const errors = {};

		// Validation
		if (!username || username.trim().length < 2) {
			errors.username = 'Username must be at least 2 characters';
		}

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Valid email is required';
		}

		if (!password || password.length < 6) {
			errors.password = 'Password must be at least 6 characters';
		}

		if (Object.keys(errors).length > 0) {
			return { success: false, errors };
		}

		// Check for duplicate username
		const existingUser = await this.db.get('SELECT id FROM users WHERE username = ?', [username]);
		if (existingUser) {
			return { success: false, error: 'A user with this username already exists' };
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		try {
			const result = await this.db.run(`
				INSERT INTO users (username, display_name, email, password_hash, is_admin)
				VALUES (?, ?, ?, ?, ?)
			`, [username, displayName || username, email, passwordHash, isAdmin ? 1 : 0]);

			const user = await this.db.get('SELECT id, username, display_name, email, is_admin as isAdmin, created_at as createdAt FROM users WHERE id = ?', [result.lastID]);

			// Log the user creation
			await this.daos.authEvents.logEvent(user.id, null, 'user_created', '127.0.0.1', 'Admin Interface', {
				createdBy: 'admin',
				isAdmin
			});

			return { success: true, user };
		} catch (error) {
			return { success: false, error: 'Failed to create user: ' + error.message };
		}
	}

	async deleteUser(userId) {
		// Prevent deleting the last admin user
		const adminCount = await this.db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
		const userToDelete = await this.db.get('SELECT is_admin FROM users WHERE id = ?', [userId]);

		if (userToDelete.is_admin && adminCount.count <= 1) {
			return { success: false, error: 'Cannot delete the last admin user' };
		}

		try {
			// Delete in proper order due to foreign key constraints
			await this.db.run('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);
			await this.db.run('DELETE FROM user_devices WHERE user_id = ?', [userId]);
			await this.db.run('DELETE FROM oauth_accounts WHERE user_id = ?', [userId]);
			await this.db.run('DELETE FROM webauthn_credentials WHERE user_id = ?', [userId]);
			await this.db.run('DELETE FROM auth_events WHERE user_id = ?', [userId]);
			await this.db.run('DELETE FROM users WHERE id = ?', [userId]);

			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to delete user: ' + error.message };
		}
	}

	async getUserDetails(userId) {
		try {
			const user = await this.db.get(`
				SELECT id, username, display_name, email, is_admin as isAdmin,
					   created_at as createdAt, updated_at as lastLogin
				FROM users WHERE id = ?
			`, [userId]);

			if (!user) {
				return { success: false, error: 'User not found' };
			}

			// Get user devices with session info
			const devices = await this.db.all(`
				SELECT d.id, d.device_name as deviceName, d.device_fingerprint as deviceFingerprint,
					   d.is_trusted as isTrusted, d.created_at as createdAt,
					   COUNT(s.id) as activeSessions
				FROM user_devices d
				LEFT JOIN auth_sessions s ON d.id = s.device_id AND s.is_active = 1
				WHERE d.user_id = ?
				GROUP BY d.id
				ORDER BY d.created_at DESC
			`, [userId]);

			// Get active sessions
			const sessions = await this.db.all(`
				SELECT s.id, s.session_token as sessionToken, s.expires_at as expiresAt,
					   s.created_at as createdAt, d.device_name as deviceName
				FROM auth_sessions s
				JOIN user_devices d ON s.device_id = d.id
				WHERE s.user_id = ? AND s.is_active = 1
				ORDER BY s.created_at DESC
			`, [userId]);

			// Get recent events
			const recentEvents = await this.db.all(`
				SELECT event_type as eventType, ip_address as ipAddress,
					   user_agent as userAgent, details, created_at as createdAt
				FROM auth_events
				WHERE user_id = ?
				ORDER BY created_at DESC
				LIMIT 10
			`, [userId]);

			return {
				success: true,
				user: {
					...user,
					devices,
					sessions,
					recentEvents
				}
			};
		} catch (error) {
			return { success: false, error: 'Failed to get user details: ' + error.message };
		}
	}

	// Device Management
	async listUserDevices(userId) {
		return await this.db.all(`
			SELECT d.id, d.device_name as deviceName, d.device_fingerprint as deviceFingerprint,
				   d.is_trusted as isTrusted, d.created_at as createdAt,
				   COUNT(s.id) as activeSessions
			FROM user_devices d
			LEFT JOIN auth_sessions s ON d.id = s.device_id AND s.is_active = 1
			WHERE d.user_id = ?
			GROUP BY d.id
			ORDER BY d.created_at DESC
		`, [userId]);
	}

	async revokeDevice(deviceId) {
		try {
			// Revoke all active sessions for this device
			await this.db.run('UPDATE auth_sessions SET is_active = 0 WHERE device_id = ?', [deviceId]);
			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to revoke device: ' + error.message };
		}
	}

	async renameDevice(deviceId, newName) {
		try {
			await this.db.run('UPDATE user_devices SET device_name = ? WHERE id = ?', [newName, deviceId]);
			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to rename device: ' + error.message };
		}
	}

	async toggleDeviceTrust(deviceId, isTrusted) {
		try {
			await this.db.run('UPDATE user_devices SET is_trusted = ? WHERE id = ?', [isTrusted ? 1 : 0, deviceId]);
			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to toggle device trust: ' + error.message };
		}
	}

	async getAllDevices({ page = 1, limit = 20 } = {}) {
		const offset = (page - 1) * limit;

		try {
			const devices = await this.db.all(`
				SELECT d.id, d.device_name as deviceName, d.device_fingerprint as deviceFingerprint,
					   d.is_trusted as isTrusted, d.created_at as createdAt,
					   u.username, u.id as userId,
					   COUNT(s.id) as activeSessions,
					   MAX(s.last_activity_at) as lastActivity
				FROM user_devices d
				JOIN users u ON d.user_id = u.id
				LEFT JOIN auth_sessions s ON d.id = s.device_id AND s.is_active = 1
				GROUP BY d.id
				ORDER BY d.created_at DESC
				LIMIT ? OFFSET ?
			`, [limit, offset]);

			// Get total count
			const { total } = await this.db.get('SELECT COUNT(*) as total FROM user_devices');
			const totalPages = Math.ceil(total / limit);

			return {
				success: true,
				devices,
				total,
				page,
				totalPages,
				limit
			};
		} catch (error) {
			return { success: false, error: 'Failed to get devices: ' + error.message };
		}
	}

	async getUserDevices(userId, { page = 1, limit = 20 } = {}) {
		const offset = (page - 1) * limit;

		try {
			const devices = await this.db.all(`
				SELECT d.id, d.device_name as deviceName, d.device_fingerprint as deviceFingerprint,
					   d.is_trusted as isTrusted, d.created_at as createdAt,
					   COUNT(s.id) as activeSessions,
					   MAX(s.last_activity_at) as lastActivity
				FROM user_devices d
				LEFT JOIN auth_sessions s ON d.id = s.device_id AND s.is_active = 1
				WHERE d.user_id = ?
				GROUP BY d.id
				ORDER BY d.created_at DESC
				LIMIT ? OFFSET ?
			`, [userId, limit, offset]);

			// Get total count for this user
			const { total } = await this.db.get('SELECT COUNT(*) as total FROM user_devices WHERE user_id = ?', [userId]);
			const totalPages = Math.ceil(total / limit);

			return {
				success: true,
				devices,
				total,
				page,
				totalPages,
				limit
			};
		} catch (error) {
			return { success: false, error: 'Failed to get user devices: ' + error.message };
		}
	}

	async getDeviceDetails(deviceId) {
		try {
			const device = await this.db.get(`
				SELECT d.id, d.device_name as deviceName, d.device_fingerprint as deviceFingerprint,
					   d.is_trusted as isTrusted, d.created_at as createdAt,
					   u.username, u.id as userId, u.display_name as userDisplayName
				FROM user_devices d
				JOIN users u ON d.user_id = u.id
				WHERE d.id = ?
			`, [deviceId]);

			if (!device) {
				return { success: false, error: 'Device not found' };
			}

			// Get active sessions for this device
			const sessions = await this.db.all(`
				SELECT s.id, s.session_token as sessionToken, s.expires_at as expiresAt,
					   s.created_at as createdAt, s.last_activity_at as lastActivity,
					   s.ip_address as ipAddress, s.user_agent as userAgent
				FROM auth_sessions s
				WHERE s.device_id = ? AND s.is_active = 1
				ORDER BY s.last_activity_at DESC
			`, [deviceId]);

			// Get recent auth events for this device
			const recentEvents = await this.db.all(`
				SELECT ae.event_type as eventType, ae.ip_address as ipAddress,
					   ae.user_agent as userAgent, ae.details, ae.created_at as createdAt
				FROM auth_events ae
				WHERE ae.device_id = ?
				ORDER BY ae.created_at DESC
				LIMIT 10
			`, [deviceId]);

			return {
				success: true,
				device: {
					...device,
					sessions,
					recentEvents
				}
			};
		} catch (error) {
			return { success: false, error: 'Failed to get device details: ' + error.message };
		}
	}

	// Session Management
	async listActiveSessions() {
		return await this.db.all(`
			SELECT s.id, s.session_token as sessionToken, s.expires_at as expiresAt,
				   s.created_at as createdAt, s.last_activity as lastActivity,
				   u.username, d.device_name as deviceName
			FROM auth_sessions s
			JOIN users u ON s.user_id = u.id
			JOIN user_devices d ON s.device_id = d.id
			WHERE s.is_active = 1
			ORDER BY s.last_activity DESC
		`);
	}

	async revokeSession(sessionToken) {
		try {
			await this.db.run('UPDATE auth_sessions SET is_active = 0 WHERE session_token = ?', [sessionToken]);
			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to revoke session: ' + error.message };
		}
	}

	async revokeAllUserSessions(userId) {
		try {
			const result = await this.db.run('UPDATE auth_sessions SET is_active = 0 WHERE user_id = ?', [userId]);
			return { success: true, revokedCount: result.changes };
		} catch (error) {
			return { success: false, error: 'Failed to revoke sessions: ' + error.message };
		}
	}

	// Authentication Configuration
	async getAuthConfiguration() {
		const config = {
			methods: {
				local: { enabled: true },
				webauthn: { enabled: false },
				oauth: {
					enabled: false,
					providers: {
						google: { enabled: false },
						github: { enabled: false }
					}
				}
			},
			security: {
				rateLimiting: { enabled: true },
				csrfProtection: { enabled: true },
				sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
			},
			settings: {}
		};

		// Get actual settings from database
		try {
			const authSettings = await this.daos.settings.getCategorySettings('auth');
			const securitySettings = await this.daos.settings.getCategorySettings('security');
			const oauthSettings = await this.daos.settings.getCategorySettings('oauth');

			if (authSettings.webauthn_enabled === 'true') {
				config.methods.webauthn.enabled = true;
			}

			if (oauthSettings.enabled === 'true') {
				config.methods.oauth.enabled = true;
				if (oauthSettings.google_enabled === 'true') {
					config.methods.oauth.providers.google.enabled = true;
				}
				if (oauthSettings.github_enabled === 'true') {
					config.methods.oauth.providers.github.enabled = true;
				}
			}

			config.settings = { ...authSettings, ...securitySettings, ...oauthSettings };
		} catch (error) {
			console.error('Error loading auth configuration:', error);
		}

		return config;
	}

	async updateAuthConfiguration(updates) {
		// Validate that at least one auth method remains enabled
		const currentConfig = await this.getAuthConfiguration();
		const newConfig = { ...currentConfig.methods };

		if (updates.local?.enabled === false) newConfig.local.enabled = false;
		if (updates.webauthn?.enabled === false) newConfig.webauthn.enabled = false;
		if (updates.oauth?.enabled === false) newConfig.oauth.enabled = false;

		const hasEnabledMethod = newConfig.local.enabled || newConfig.webauthn.enabled || newConfig.oauth.enabled;
		if (!hasEnabledMethod) {
			return { success: false, error: 'At least one authentication method must be enabled' };
		}

		try {
			// Update settings
			if (updates.webauthn !== undefined) {
				await this.daos.settings.setSettingsForCategory('auth', { webauthn_enabled: updates.webauthn.enabled.toString() });
			}

			if (updates.oauth !== undefined) {
				const oauthSettings = {
					enabled: updates.oauth.enabled.toString()
				};

				if (updates.oauth.providers) {
					if (updates.oauth.providers.google !== undefined) {
						oauthSettings.google_enabled = updates.oauth.providers.google.enabled.toString();
					}
					if (updates.oauth.providers.github !== undefined) {
						oauthSettings.github_enabled = updates.oauth.providers.github.enabled.toString();
					}
				}

				await this.daos.settings.setSettingsForCategory('oauth', oauthSettings);
			}

			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to update configuration: ' + error.message };
		}
	}

	// Security Posture Dashboard
	async getSecurityPosture() {
		const factors = {
			httpsEnabled: false,
			strongAuthentication: false,
			certificateStatus: 'none',
			sessionSecurity: true
		};

		const recommendations = [];
		const warnings = [];

		// Check HTTPS status
		try {
			const certSettings = await this.daos.settings.getCategorySettings('certificates');
			if (certSettings.type === 'letsencrypt' || certSettings.type === 'mkcert') {
				factors.httpsEnabled = true;
				factors.certificateStatus = certSettings.type;
			}
		} catch (error) {
			console.error('Error checking certificate status:', error);
		}

		// Check authentication methods
		const authConfig = await this.getAuthConfiguration();
		if (authConfig.methods.webauthn.enabled || authConfig.methods.oauth.enabled) {
			factors.strongAuthentication = true;
		} else {
			recommendations.push({
				type: 'authentication',
				title: 'Enable Strong Authentication',
				description: 'Consider enabling WebAuthn or OAuth for improved security',
				action: 'Configure WebAuthn or OAuth providers'
			});
		}

		// Check HTTPS
		if (!factors.httpsEnabled) {
			warnings.push({
				type: 'security',
				title: 'HTTPS Not Enabled',
				description: 'Application is not using HTTPS, which is required for secure authentication',
				severity: 'high'
			});

			recommendations.push({
				type: 'certificate',
				title: 'Enable HTTPS',
				description: 'Set up a certificate to enable secure connections',
				action: 'Upload certificate or configure Let\'s Encrypt'
			});
		}

		// Calculate overall security score
		let score = 0;
		if (factors.httpsEnabled) score += 30;
		if (factors.strongAuthentication) score += 25;
		if (factors.certificateStatus === 'letsencrypt') score += 25;
		if (factors.sessionSecurity) score += 20;

		const overall = {
			score,
			level: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'
		};

		return {
			overall,
			factors,
			recommendations,
			warnings
		};
	}

	// Audit Log Management
	async getAuditLogs({ page = 1, limit = 50, eventType = '', userId = '', ipAddress = '', dateFrom = null, dateTo = null } = {}) {
		const offset = (page - 1) * limit;
		let query = `
			SELECT ae.id, ae.event_type as eventType, ae.ip_address as ipAddress,
				   ae.user_agent as userAgent, ae.details, ae.created_at as createdAt,
				   u.username, ae.user_id as userId
			FROM auth_events ae
			LEFT JOIN users u ON ae.user_id = u.id
			WHERE 1=1
		`;
		const params = [];

		if (eventType) {
			query += ' AND ae.event_type = ?';
			params.push(eventType);
		}

		if (userId) {
			query += ' AND ae.user_id = ?';
			params.push(userId);
		}

		if (ipAddress) {
			query += ' AND ae.ip_address = ?';
			params.push(ipAddress);
		}

		if (dateFrom) {
			query += ' AND ae.created_at >= ?';
			params.push(dateFrom.getTime ? dateFrom.getTime() : dateFrom);
		}

		if (dateTo) {
			query += ' AND ae.created_at <= ?';
			params.push(dateTo.getTime ? dateTo.getTime() : dateTo);
		}

		query += ' ORDER BY ae.created_at DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const events = await this.db.all(query, params);

		// Get total count
		let countQuery = 'SELECT COUNT(*) as total FROM auth_events ae WHERE 1=1';
		const countParams = [];

		if (eventType) {
			countQuery += ' AND ae.event_type = ?';
			countParams.push(eventType);
		}

		if (userId) {
			countQuery += ' AND ae.user_id = ?';
			countParams.push(userId);
		}

		if (ipAddress) {
			countQuery += ' AND ae.ip_address = ?';
			countParams.push(ipAddress);
		}

		if (dateFrom) {
			countQuery += ' AND ae.created_at >= ?';
			countParams.push(dateFrom.getTime ? dateFrom.getTime() : dateFrom);
		}

		if (dateTo) {
			countQuery += ' AND ae.created_at <= ?';
			countParams.push(dateTo.getTime ? dateTo.getTime() : dateTo);
		}

		const { total } = await this.db.get(countQuery, countParams);

		return {
			events,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit)
			}
		};
	}

	async exportAuditLogs({ format = 'json', dateFrom = null, dateTo = null } = {}) {
		try {
			let query = 'SELECT * FROM auth_events WHERE 1=1';
			const params = [];

			if (dateFrom) {
				query += ' AND created_at >= ?';
				params.push(dateFrom.getTime ? dateFrom.getTime() : dateFrom);
			}

			if (dateTo) {
				query += ' AND created_at <= ?';
				params.push(dateTo.getTime ? dateTo.getTime() : dateTo);
			}

			query += ' ORDER BY created_at DESC';

			const events = await this.db.all(query, params);

			return { success: true, data: events };
		} catch (error) {
			return { success: false, error: 'Failed to export audit logs: ' + error.message };
		}
	}

	// System Statistics
	async getSystemStats() {
		const stats = {};

		// User statistics
		const userStats = await this.db.get(`
			SELECT COUNT(*) as total,
				   SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) as admins,
				   SUM(CASE WHEN updated_at > ? THEN 1 ELSE 0 END) as activeInLast30Days
			FROM users
		`, [Date.now() - (30 * 24 * 60 * 60 * 1000)]);

		stats.users = userStats;

		// Session statistics
		const sessionStats = await this.db.get(`
			SELECT COUNT(*) as total,
				   SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
			FROM auth_sessions
		`);

		stats.sessions = sessionStats;

		// Device statistics
		const deviceStats = await this.db.get(`
			SELECT COUNT(*) as total,
				   SUM(CASE WHEN is_trusted = 1 THEN 1 ELSE 0 END) as trusted
			FROM user_devices
		`);

		stats.devices = deviceStats;

		// Auth event statistics
		const eventStats = await this.db.get(`
			SELECT COUNT(*) as total,
				   SUM(CASE WHEN event_type = 'login' THEN 1 ELSE 0 END) as logins,
				   SUM(CASE WHEN event_type = 'logout' THEN 1 ELSE 0 END) as logouts,
				   SUM(CASE WHEN event_type LIKE '%failed%' THEN 1 ELSE 0 END) as failures
			FROM auth_events
			WHERE created_at > ?
		`, [Date.now() - (7 * 24 * 60 * 60 * 1000)]); // Last 7 days

		stats.authEvents = eventStats;

		return stats;
	}

	async getActivityTimeline({ days = 7 } = {}) {
		const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);

		const events = await this.db.all(`
			SELECT DATE(created_at / 1000, 'unixepoch') as date,
				   COUNT(*) as events,
				   event_type
			FROM auth_events
			WHERE created_at > ?
			GROUP BY date, event_type
			ORDER BY date DESC
		`, [startDate]);

		// Group by date
		const timeline = {};
		for (const event of events) {
			if (!timeline[event.date]) {
				timeline[event.date] = { date: event.date, events: {} };
			}
			timeline[event.date].events[event.event_type] = event.events;
		}

		return Object.values(timeline);
	}

	// Admin User Management
	async promoteToAdmin(userId) {
		try {
			await this.db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [userId]);

			// Log the promotion
			await this.daos.authEvents.logEvent(userId, null, 'admin_promoted', '127.0.0.1', 'Admin Interface', {
				promotedBy: 'admin'
			});

			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to promote user: ' + error.message };
		}
	}

	async demoteFromAdmin(userId) {
		// Check if this is the last admin
		const adminCount = await this.db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
		if (adminCount.count <= 1) {
			return { success: false, error: 'Cannot demote the last admin user' };
		}

		try {
			await this.db.run('UPDATE users SET is_admin = 0 WHERE id = ?', [userId]);

			// Log the demotion
			await this.daos.authEvents.logEvent(userId, null, 'admin_demoted', '127.0.0.1', 'Admin Interface', {
				demotedBy: 'admin'
			});

			return { success: true };
		} catch (error) {
			return { success: false, error: 'Failed to demote user: ' + error.message };
		}
	}

	// Backup and Maintenance
	async runDatabaseCleanup() {
		const stats = {
			sessionsCleanedUp: 0,
			eventsCleanedUp: 0,
			devicesCleanedUp: 0
		};

		try {
			// Clean up expired sessions
			const expiredSessions = await this.db.run(`
				UPDATE auth_sessions SET is_active = 0
				WHERE expires_at < ? AND is_active = 1
			`, [Date.now()]);
			stats.sessionsCleanedUp = expiredSessions.changes;

			// Clean up old auth events (older than 90 days)
			const oldEvents = await this.db.run(`
				DELETE FROM auth_events
				WHERE created_at < ?
			`, [Date.now() - (90 * 24 * 60 * 60 * 1000)]);
			stats.eventsCleanedUp = oldEvents.changes;

			// Clean up devices with no active sessions (older than 30 days)
			const unusedDevices = await this.db.run(`
				DELETE FROM user_devices
				WHERE id NOT IN (
					SELECT DISTINCT device_id FROM auth_sessions WHERE is_active = 1
				) AND created_at < ?
			`, [Date.now() - (30 * 24 * 60 * 60 * 1000)]);
			stats.devicesCleanedUp = unusedDevices.changes;

			return { success: true, stats };
		} catch (error) {
			return { success: false, error: 'Database cleanup failed: ' + error.message };
		}
	}

	async getDatabaseHealth() {
		const health = {
			status: 'healthy',
			size: 0,
			tables: {}
		};

		try {
			// Get database file size (SQLite specific)
			const sizeResult = await this.db.get("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
			health.size = sizeResult.size;

			// Get table statistics
			const tables = ['users', 'user_devices', 'auth_sessions', 'auth_events', 'webauthn_credentials', 'oauth_accounts'];

			for (const table of tables) {
				try {
					const count = await this.db.get(`SELECT COUNT(*) as count FROM ${table}`);
					health.tables[table] = count.count;
				} catch (error) {
					health.tables[table] = 'error';
					health.status = 'warning';
				}
			}

			// Check for potential issues
			if (health.size > 100 * 1024 * 1024) { // > 100MB
				health.status = 'warning';
			}

		} catch (error) {
			health.status = 'error';
			console.error('Database health check failed:', error);
		}

		return health;
	}

	// User Management methods for API compatibility
	async getUsers({ page = 1, limit = 20, search = '', sortBy = 'created_at', sortOrder = 'desc' } = {}) {
		const offset = (page - 1) * limit;
		const order = sortOrder.toUpperCase();

		let query = `
			SELECT u.id, u.username, u.display_name, u.email, u.is_admin,
				   u.created_at, u.updated_at as last_active,
				   COUNT(DISTINCT d.id) as device_count,
				   COUNT(DISTINCT s.id) as active_session_count
			FROM users u
			LEFT JOIN user_devices d ON u.id = d.user_id
			LEFT JOIN auth_sessions s ON u.id = s.user_id AND s.is_active = 1
		`;
		const params = [];

		if (search) {
			query += ` WHERE (u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)`;
			const searchPattern = `%${search}%`;
			params.push(searchPattern, searchPattern, searchPattern);
		}

		// Validate sortBy to prevent SQL injection
		const validSortColumns = ['username', 'email', 'display_name', 'created_at', 'updated_at'];
		const actualSortColumn = sortBy === 'last_active' ? 'updated_at' : sortBy;
		const sortColumn = validSortColumns.includes(actualSortColumn) ? actualSortColumn : 'created_at';

		query += ` GROUP BY u.id ORDER BY u.${sortColumn} ${order} LIMIT ? OFFSET ?`;
		params.push(limit, offset);

		const users = await this.db.all(query, params);

		// Get total count for pagination
		let countQuery = 'SELECT COUNT(*) as total FROM users u';
		const countParams = [];
		if (search) {
			countQuery += ' WHERE (u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?)';
			const searchPattern = `%${search}%`;
			countParams.push(searchPattern, searchPattern, searchPattern);
		}

		const { total } = await this.db.get(countQuery, countParams);
		const totalPages = Math.ceil(total / limit);

		return {
			success: true,
			users,
			total,
			page,
			totalPages,
			limit
		};
	}

	async createUser({ username, email, displayName, accessCode, isAdmin = false }) {
		const errors = {};

		// Validation
		if (!username || username.trim().length < 2) {
			errors.username = 'Username must be at least 2 characters';
		}

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Valid email is required';
		}

		if (!displayName || displayName.trim().length < 1) {
			errors.displayName = 'Display name is required';
		}

		if (!accessCode || accessCode.length < 6) {
			errors.accessCode = 'Access code must be at least 6 characters';
		}

		if (Object.keys(errors).length > 0) {
			throw new Error('Validation failed: ' + Object.values(errors).join(', '));
		}

		// Check for duplicate username
		const existingUser = await this.db.get('SELECT id FROM users WHERE username = ?', [username]);
		if (existingUser) {
			throw new Error('A user with this username already exists');
		}

		// Check for duplicate email
		const existingEmail = await this.db.get('SELECT id FROM users WHERE email = ?', [email]);
		if (existingEmail) {
			throw new Error('A user with this email already exists');
		}

		// Hash access code
		const passwordHash = await bcrypt.hash(accessCode, 10);

		try {
			const result = await this.db.run(`
				INSERT INTO users (username, display_name, email, password_hash, is_admin)
				VALUES (?, ?, ?, ?, ?)
			`, [username, displayName, email, passwordHash, isAdmin ? 1 : 0]);

			const user = await this.db.get(`
				SELECT id, username, display_name, email, is_admin, created_at, updated_at as last_active
				FROM users WHERE id = ?
			`, [result.lastID]);

			// Log the user creation
			await this.daos.authEvents.logEvent(user.id, null, 'user_created', '127.0.0.1', 'Admin Interface', {
				createdBy: 'admin',
				isAdmin: isAdmin ? 1 : 0
			});

			return {
				success: true,
				user
			};
		} catch (error) {
			throw new Error('Failed to create user: ' + error.message);
		}
	}

	async updateUser(userId, updates) {
		const allowedUpdates = ['username', 'email', 'displayName', 'isAdmin'];
		const updateFields = {};
		const params = [];

		// Build update query dynamically
		for (const [key, value] of Object.entries(updates)) {
			if (allowedUpdates.includes(key)) {
				if (key === 'displayName') {
					updateFields.display_name = value;
				} else if (key === 'isAdmin') {
					updateFields.is_admin = value ? 1 : 0;
				} else {
					updateFields[key] = value;
				}
			}
		}

		if (Object.keys(updateFields).length === 0) {
			throw new Error('No valid fields to update');
		}

		// Validation
		if (updateFields.username && updateFields.username.trim().length < 2) {
			throw new Error('Username must be at least 2 characters');
		}

		if (updateFields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateFields.email)) {
			throw new Error('Valid email is required');
		}

		// Check for duplicates
		if (updateFields.username) {
			const existing = await this.db.get('SELECT id FROM users WHERE username = ? AND id != ?', [updateFields.username, userId]);
			if (existing) {
				throw new Error('A user with this username already exists');
			}
		}

		if (updateFields.email) {
			const existing = await this.db.get('SELECT id FROM users WHERE email = ? AND id != ?', [updateFields.email, userId]);
			if (existing) {
				throw new Error('A user with this email already exists');
			}
		}

		// Prevent removing admin privileges from the last admin
		if (updateFields.is_admin === 0) {
			const adminCount = await this.db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
			const userToUpdate = await this.db.get('SELECT is_admin FROM users WHERE id = ?', [userId]);

			if (userToUpdate.is_admin && adminCount.count <= 1) {
				throw new Error('Cannot remove admin privileges from the last admin user');
			}
		}

		try {
			const setClause = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
			const values = Object.values(updateFields);
			values.push(userId);

			await this.db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values);

			const user = await this.db.get(`
				SELECT id, username, display_name, email, is_admin, created_at, updated_at as last_active
				FROM users WHERE id = ?
			`, [userId]);

			// Log the user update
			await this.daos.authEvents.logEvent(userId, null, 'user_updated', '127.0.0.1', 'Admin Interface', {
				updatedFields: Object.keys(updateFields),
				updatedBy: 'admin'
			});

			return {
				success: true,
				user
			};
		} catch (error) {
			throw new Error('Failed to update user: ' + error.message);
		}
	}
}