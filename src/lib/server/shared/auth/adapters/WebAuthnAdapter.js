import { logger } from '../../utils/logger.js';
import { WebAuthnManager } from '../WebAuthnManager.js';

/**
 * WebAuthn Authentication Adapter
 * Integrates WebAuthn/Passkey authentication with the AuthManager system
 */
export class WebAuthnAdapter {
	constructor(databaseManager, authManager) {
		this.db = databaseManager;
		this.authManager = authManager;
		this.webauthnManager = new WebAuthnManager(databaseManager);
		this.name = 'webauthn';
		this.displayName = 'WebAuthn/Passkey';
		this.icon = '🔐';

		// Store active authentication sessions
		this.activeSessions = new Map();
	}

	/**
	 * Check if WebAuthn is available in the current environment
	 */
	async isAvailable(request) {
		try {
			const hostname = request.headers.host?.split(':')[0] || 'localhost';
			const isHttps = request.protocol === 'https' ||
				request.headers['x-forwarded-proto'] === 'https' ||
				hostname === 'localhost';

			const config = await this.webauthnManager.getWebAuthnConfig(hostname, isHttps);
			return config.isAvailable;
		} catch (error) {
			logger.error('WEBAUTHN_ADAPTER', `Availability check failed: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get authentication methods supported by this adapter
	 */
	getSupportedMethods() {
		return ['webauthn-register', 'webauthn-authenticate'];
	}

	/**
	 * Begin WebAuthn authentication process
	 * This handles both registration and authentication flows
	 */
	async beginAuthentication(request, method, credentials = {}) {
		try {
			const hostname = request.headers.host?.split(':')[0] || 'localhost';
			const isHttps = request.protocol === 'https' ||
				request.headers['x-forwarded-proto'] === 'https' ||
				hostname === 'localhost';

			// Check if WebAuthn is available
			if (!(await this.isAvailable(request))) {
				throw new Error('WebAuthn not available in current environment');
			}

			switch (method) {
				case 'webauthn-register':
					return await this.beginRegistration(request, hostname, isHttps, credentials);

				case 'webauthn-authenticate':
					return await this.beginAuthenticationFlow(request, hostname, isHttps, credentials);

				default:
					throw new Error(`Unsupported WebAuthn method: ${method}`);
			}

		} catch (error) {
			logger.error('WEBAUTHN_ADAPTER', `Begin authentication failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Complete WebAuthn authentication process
	 */
	async completeAuthentication(sessionId, request, data) {
		try {
			const session = this.activeSessions.get(sessionId);
			if (!session) {
				throw new Error('Invalid or expired authentication session');
			}

			// Remove session to prevent replay
			this.activeSessions.delete(sessionId);

			switch (session.method) {
				case 'webauthn-register':
					return await this.completeRegistration(session, data);

				case 'webauthn-authenticate':
					return await this.completeAuthenticationFlow(session, data);

				default:
					throw new Error(`Unsupported session method: ${session.method}`);
			}

		} catch (error) {
			logger.error('WEBAUTHN_ADAPTER', `Complete authentication failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Authenticate user with credentials (standard adapter interface)
	 * For WebAuthn, this is handled via the begin/complete flow
	 */
	async authenticate(credentials, context = {}) {
		throw new Error('WebAuthn requires begin/complete authentication flow. Use beginAuthentication() instead.');
	}

	/**
	 * Begin WebAuthn registration for an existing user
	 */
	async beginRegistration(request, hostname, isHttps, credentials) {
		const { userId, deviceName = 'WebAuthn Device' } = credentials;

		if (!userId) {
			throw new Error('User ID required for WebAuthn registration');
		}

		// Begin WebAuthn registration
		const registrationData = await this.webauthnManager.beginRegistration(
			userId,
			hostname,
			isHttps,
			{ deviceName }
		);

		// Store session data
		const sessionId = this.generateSessionId();
		this.activeSessions.set(sessionId, {
			method: 'webauthn-register',
			userId,
			deviceName,
			challengeId: registrationData.challengeId,
			timestamp: Date.now()
		});

		logger.info('WEBAUTHN_ADAPTER', `Started registration for user ${userId}`);

		return {
			sessionId,
			method: 'webauthn-register',
			challenge: registrationData.publicKeyCredentialCreationOptions,
			requiresUserInteraction: true
		};
	}

	/**
	 * Complete WebAuthn registration
	 */
	async completeRegistration(session, data) {
		const { credential } = data;

		if (!credential) {
			throw new Error('WebAuthn credential required');
		}

		// Complete registration with WebAuthn manager
		const result = await this.webauthnManager.completeRegistration(
			session.challengeId,
			credential,
			session.deviceName
		);

		logger.info('WEBAUTHN_ADAPTER', `Completed registration for user ${session.userId}`);

		return {
			success: true,
			method: 'webauthn-register',
			userId: session.userId,
			credentialId: result.credentialId,
			message: `WebAuthn device "${result.deviceName}" registered successfully`
		};
	}

	/**
	 * Begin WebAuthn authentication flow
	 */
	async beginAuthenticationFlow(request, hostname, isHttps, credentials) {
		const { username } = credentials;

		// Begin WebAuthn authentication
		const authData = await this.webauthnManager.beginAuthentication(
			hostname,
			isHttps,
			username
		);

		// Store session data
		const sessionId = this.generateSessionId();
		this.activeSessions.set(sessionId, {
			method: 'webauthn-authenticate',
			username,
			challengeId: authData.challengeId,
			timestamp: Date.now()
		});

		logger.info('WEBAUTHN_ADAPTER', `Started authentication${username ? ` for user ${username}` : ''}`);

		return {
			sessionId,
			method: 'webauthn-authenticate',
			challenge: authData.publicKeyCredentialRequestOptions,
			requiresUserInteraction: true
		};
	}

	/**
	 * Complete WebAuthn authentication flow
	 */
	async completeAuthenticationFlow(session, data) {
		const { credential } = data;

		if (!credential) {
			throw new Error('WebAuthn credential required');
		}

		// Complete authentication with WebAuthn manager
		const result = await this.webauthnManager.completeAuthentication(
			session.challengeId,
			credential
		);

		const user = result.user;

		logger.info('WEBAUTHN_ADAPTER', `Completed authentication for user ${user.username}`);

		return {
			success: true,
			method: 'webauthn-authenticate',
			user: {
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				email: user.email,
				isAdmin: user.isAdmin
			},
			credentialId: result.credentialId,
			authMethod: 'webauthn'
		};
	}

	/**
	 * Get user's WebAuthn credentials
	 */
	async getUserCredentials(userId) {
		return await this.webauthnManager.getUserCredentials(userId);
	}

	/**
	 * Revoke a WebAuthn credential
	 */
	async revokeCredential(credentialId, userId) {
		return await this.webauthnManager.revokeCredential(credentialId, userId);
	}

	/**
	 * Check hostname compatibility for existing credentials
	 */
	async checkHostnameCompatibility(oldHostname, newHostname, userId = null) {
		return await this.webauthnManager.checkHostnameCompatibility(oldHostname, newHostname, userId);
	}

	/**
	 * Get WebAuthn configuration for frontend
	 */
	async getConfig(request) {
		const hostname = request.headers.host?.split(':')[0] || 'localhost';
		const isHttps = request.protocol === 'https' ||
			request.headers['x-forwarded-proto'] === 'https' ||
			hostname === 'localhost';

		return await this.webauthnManager.getWebAuthnConfig(hostname, isHttps);
	}

	/**
	 * Validate user credentials format (not used for WebAuthn)
	 */
	validateCredentials(credentials) {
		// WebAuthn uses challenge/response, not traditional credentials
		return { valid: true };
	}

	/**
	 * Get adapter information
	 */
	getInfo() {
		return {
			name: this.name,
			displayName: this.displayName,
			icon: this.icon,
			description: 'Passwordless authentication using WebAuthn/Passkeys',
			requiresSetup: false,
			supportsRegistration: true,
			supportsAuthentication: true,
			requiresHttps: true,
			browserSupported: typeof window !== 'undefined' && 'credentials' in navigator
		};
	}

	/**
	 * Generate unique session ID
	 */
	generateSessionId() {
		return `webauthn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Cleanup expired sessions (run periodically)
	 */
	cleanupExpiredSessions() {
		const now = Date.now();
		const expiredSessions = [];

		for (const [sessionId, session] of this.activeSessions) {
			// Sessions expire after 5 minutes
			if (now - session.timestamp > 5 * 60 * 1000) {
				expiredSessions.push(sessionId);
			}
		}

		expiredSessions.forEach(sessionId => {
			this.activeSessions.delete(sessionId);
		});

		if (expiredSessions.length > 0) {
			logger.debug('WEBAUTHN_ADAPTER', `Cleaned up ${expiredSessions.length} expired sessions`);
		}
	}

	/**
	 * Start cleanup interval
	 */
	startCleanup() {
		// Cleanup every 5 minutes
		setInterval(() => {
			this.cleanupExpiredSessions();
		}, 5 * 60 * 1000);
	}
}