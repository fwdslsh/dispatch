/**
 * Centralized Authentication Middleware
 *
 * Consolidates all authentication logic that was previously scattered across
 * 15+ locations in socket-handler.js and provides consistent patterns
 */

import { createErrorResponse, ErrorHandler } from '../../utils/error-handling.js';

/**
 * Authentication states
 */
export const AuthState = {
	UNAUTHENTICATED: 'unauthenticated',
	AUTHENTICATED: 'authenticated',
	FAILED: 'failed'
};

/**
 * Authentication events for logging and monitoring
 */
export const AuthEvent = {
	AUTH_SUCCESS: 'auth_success',
	AUTH_FAILURE: 'auth_failure',
	AUTH_REQUIRED: 'auth_required',
	PROTECTED_ACCESS_DENIED: 'protected_access_denied',
	PROTECTED_ACCESS_GRANTED: 'protected_access_granted'
};

/**
 * Centralized authentication middleware class
 */
export class AuthMiddleware {
	/**
	 * @param {Object} config Authentication configuration
	 * @param {string} config.terminalKey Authentication key
	 * @param {boolean} config.authRequired Whether authentication is required
	 * @param {Function} config.logger Optional logger function
	 * @param {boolean} config.enableSecurityLogging Enable detailed security logging
	 */
	constructor(config = {}) {
		this.terminalKey = config.terminalKey || process.env.TERMINAL_KEY || 'change-me';
		this.authRequired = config.authRequired ?? this.terminalKey !== 'change-me';
		this.logger = config.logger || console;
		this.enableSecurityLogging = config.enableSecurityLogging ?? true;

		// Track authentication state per socket
		this.socketAuthState = new Map();
		this.socketAuthHistory = new Map();

		// Track authentication attempts for rate limiting and monitoring
		this.authAttempts = new Map();
		this.maxAuthAttempts = config.maxAuthAttempts || 10;
		this.authAttemptWindow = config.authAttemptWindow || 300000; // 5 minutes
	}

	/**
	 * Initialize authentication for a socket
	 * @param {string} socketId Socket ID
	 */
	initializeSocket(socketId) {
		this.socketAuthState.set(socketId, {
			state: this.authRequired ? AuthState.UNAUTHENTICATED : AuthState.AUTHENTICATED,
			authenticatedAt: this.authRequired ? null : new Date(),
			attempts: 0
		});

		this.socketAuthHistory.set(socketId, []);

		if (this.enableSecurityLogging) {
			this.logSecurityEvent(socketId, AuthEvent.AUTH_REQUIRED, {
				authRequired: this.authRequired,
				initialState: this.socketAuthState.get(socketId).state
			});
		}
	}

	/**
	 * Handle authentication attempt
	 * @param {string} socketId Socket ID
	 * @param {string} key Authentication key provided
	 * @returns {Object} Authentication result
	 */
	authenticate(socketId, key) {
		const authState = this.socketAuthState.get(socketId);
		if (!authState) {
			this.initializeSocket(socketId);
			return this.authenticate(socketId, key);
		}

		// Check rate limiting
		if (!this.checkRateLimit(socketId)) {
			const result = {
				success: false,
				error: 'Too many authentication attempts. Please try again later.',
				state: AuthState.FAILED
			};

			this.logSecurityEvent(socketId, AuthEvent.AUTH_FAILURE, {
				reason: 'rate_limit_exceeded',
				attempts: authState.attempts
			});

			return result;
		}

		// Increment attempt counter
		authState.attempts++;

		let result;

		if (!this.authRequired) {
			// Authentication not required, always succeed
			authState.state = AuthState.AUTHENTICATED;
			authState.authenticatedAt = new Date();

			result = {
				success: true,
				message: 'Authentication not required',
				state: AuthState.AUTHENTICATED
			};

			this.logSecurityEvent(socketId, AuthEvent.AUTH_SUCCESS, {
				reason: 'no_auth_required'
			});
		} else if (this.validateKey(key)) {
			// Valid key provided
			authState.state = AuthState.AUTHENTICATED;
			authState.authenticatedAt = new Date();

			result = {
				success: true,
				message: 'Authentication successful',
				state: AuthState.AUTHENTICATED
			};

			this.logSecurityEvent(socketId, AuthEvent.AUTH_SUCCESS, {
				keyLength: key?.length || 0,
				attempts: authState.attempts
			});
		} else {
			// Invalid key
			authState.state = AuthState.FAILED;

			result = {
				success: false,
				error: 'Invalid authentication key',
				state: AuthState.FAILED
			};

			this.logSecurityEvent(socketId, AuthEvent.AUTH_FAILURE, {
				reason: 'invalid_key',
				keyLength: key?.length || 0,
				attempts: authState.attempts
			});
		}

		// Record authentication attempt
		this.recordAuthAttempt(socketId, result);

		return result;
	}

	/**
	 * Check if socket is authenticated
	 * @param {string} socketId Socket ID
	 * @returns {boolean} True if authenticated
	 */
	isAuthenticated(socketId) {
		const authState = this.socketAuthState.get(socketId);

		if (!authState) {
			this.initializeSocket(socketId);
			return this.isAuthenticated(socketId);
		}

		return authState.state === AuthState.AUTHENTICATED;
	}

	/**
	 * Require authentication for an operation
	 * @param {string} socketId Socket ID
	 * @param {string} operation Operation name for logging
	 * @returns {Object|null} Error response if not authenticated, null if authenticated
	 */
	requireAuth(socketId, operation = 'unknown') {
		if (this.isAuthenticated(socketId)) {
			this.logSecurityEvent(socketId, AuthEvent.PROTECTED_ACCESS_GRANTED, {
				operation
			});
			return null; // Access granted
		}

		this.logSecurityEvent(socketId, AuthEvent.PROTECTED_ACCESS_DENIED, {
			operation,
			reason: 'not_authenticated'
		});

		return createErrorResponse('Not authenticated');
	}

	/**
	 * Create authentication middleware function for socket operations
	 * @param {string} operation Operation name
	 * @returns {Function} Middleware function
	 */
	createMiddleware(operation) {
		return (socketId, data, next) => {
			const authError = this.requireAuth(socketId, operation);
			if (authError) {
				return next(authError);
			}
			next();
		};
	}

	/**
	 * Get authentication status for a socket
	 * @param {string} socketId Socket ID
	 * @returns {Object} Authentication status
	 */
	getAuthStatus(socketId) {
		const authState = this.socketAuthState.get(socketId);

		if (!authState) {
			this.initializeSocket(socketId);
			return this.getAuthStatus(socketId);
		}

		return {
			isAuthenticated: authState.state === AuthState.AUTHENTICATED,
			state: authState.state,
			authenticatedAt: authState.authenticatedAt,
			attempts: authState.attempts,
			authRequired: this.authRequired
		};
	}

	/**
	 * Clean up authentication state for disconnected socket
	 * @param {string} socketId Socket ID
	 */
	cleanup(socketId) {
		this.socketAuthState.delete(socketId);
		this.socketAuthHistory.delete(socketId);
		this.authAttempts.delete(socketId);

		if (this.enableSecurityLogging) {
			this.logger.info(`Auth cleanup completed for socket: ${socketId}`);
		}
	}

	/**
	 * Validate authentication key
	 * @private
	 * @param {string} key Key to validate
	 * @returns {boolean} True if valid
	 */
	validateKey(key) {
		if (!key || typeof key !== 'string') {
			return false;
		}

		return key === this.terminalKey;
	}

	/**
	 * Check rate limiting for authentication attempts
	 * @private
	 * @param {string} socketId Socket ID
	 * @returns {boolean} True if within rate limit
	 */
	checkRateLimit(socketId) {
		const attempts = this.authAttempts.get(socketId) || [];
		const now = Date.now();
		const windowStart = now - this.authAttemptWindow;

		// Filter attempts within the window
		const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);

		// Update the attempts list
		this.authAttempts.set(socketId, recentAttempts);

		return recentAttempts.length < this.maxAuthAttempts;
	}

	/**
	 * Record authentication attempt
	 * @private
	 * @param {string} socketId Socket ID
	 * @param {Object} result Authentication result
	 */
	recordAuthAttempt(socketId, result) {
		// Record timestamp for rate limiting
		const attempts = this.authAttempts.get(socketId) || [];
		attempts.push(Date.now());
		this.authAttempts.set(socketId, attempts);

		// Record in history
		const history = this.socketAuthHistory.get(socketId) || [];
		history.push({
			timestamp: new Date(),
			success: result.success,
			state: result.state,
			error: result.error
		});

		// Keep only last 10 attempts
		if (history.length > 10) {
			history.splice(0, history.length - 10);
		}

		this.socketAuthHistory.set(socketId, history);
	}

	/**
	 * Log security event
	 * @private
	 * @param {string} socketId Socket ID
	 * @param {string} event Event type
	 * @param {Object} details Event details
	 */
	logSecurityEvent(socketId, event, details = {}) {
		if (!this.enableSecurityLogging) {
			return;
		}

		const logEntry = {
			timestamp: new Date().toISOString(),
			socketId,
			event,
			details
		};

		// Use appropriate log level based on event
		const logLevel = this.getLogLevel(event);

		if (this.logger[logLevel]) {
			this.logger[logLevel](`[AUTH] ${event}:`, logEntry);
		} else {
			this.logger.info(`[AUTH] ${event}:`, logEntry);
		}
	}

	/**
	 * Get appropriate log level for event
	 * @private
	 * @param {string} event Event type
	 * @returns {string} Log level
	 */
	getLogLevel(event) {
		switch (event) {
			case AuthEvent.AUTH_FAILURE:
			case AuthEvent.PROTECTED_ACCESS_DENIED:
				return 'warn';
			case AuthEvent.AUTH_SUCCESS:
			case AuthEvent.PROTECTED_ACCESS_GRANTED:
				return 'info';
			default:
				return 'debug';
		}
	}

	/**
	 * Get authentication statistics
	 * @returns {Object} Authentication statistics
	 */
	getStatistics() {
		const totalSockets = this.socketAuthState.size;
		const authenticatedSockets = Array.from(this.socketAuthState.values()).filter(
			(state) => state.state === AuthState.AUTHENTICATED
		).length;

		const totalAttempts = Array.from(this.authAttempts.values()).reduce(
			(total, attempts) => total + attempts.length,
			0
		);

		return {
			totalSockets,
			authenticatedSockets,
			unauthenticatedSockets: totalSockets - authenticatedSockets,
			totalAuthAttempts: totalAttempts,
			authRequired: this.authRequired,
			rateLimit: {
				maxAttempts: this.maxAuthAttempts,
				windowMs: this.authAttemptWindow
			}
		};
	}

	/**
	 * Create AuthMiddleware with environment-based configuration
	 * @param {Object} overrides Configuration overrides
	 * @returns {AuthMiddleware} Configured middleware instance
	 */
	static create(overrides = {}) {
		const terminalKey = process.env.TERMINAL_KEY || 'change-me';

		return new AuthMiddleware({
			terminalKey,
			authRequired: terminalKey !== 'change-me',
			enableSecurityLogging: process.env.NODE_ENV !== 'production',
			...overrides
		});
	}
}

export default AuthMiddleware;
