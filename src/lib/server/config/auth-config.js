/**
 * Authentication Configuration
 *
 * Centralizes authentication configuration and key management logic
 * that was previously scattered across multiple files
 */

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG = {
	// Authentication settings
	terminalKey: 'change-me',
	authRequired: null, // Will be computed based on terminalKey

	// Rate limiting settings
	maxAuthAttempts: 10,
	authAttemptWindow: 300000, // 5 minutes in milliseconds

	// Security settings
	enableSecurityLogging: true,
	logFailedAttempts: true,
	logSuccessfulAuth: true,

	// Session settings
	sessionTimeout: null, // No timeout by default
	requireReauth: false,

	// Environment-specific settings
	isDevelopment: false,
	isProduction: false
};

/**
 * Authentication configuration class
 */
export class AuthConfig {
	constructor(overrides = {}) {
		// Start with defaults
		this.config = { ...DEFAULT_AUTH_CONFIG };

		// Apply environment-based configuration
		this.applyEnvironmentConfig();

		// Apply overrides
		Object.assign(this.config, overrides);

		// Compute derived settings
		this.computeDerivedSettings();

		// Validate configuration
		this.validateConfig();
	}

	/**
	 * Apply configuration from environment variables
	 * @private
	 */
	applyEnvironmentConfig() {
		// Terminal key from environment
		if (process.env.TERMINAL_KEY) {
			this.config.terminalKey = process.env.TERMINAL_KEY;
		}

		// Environment detection
		this.config.isDevelopment = process.env.NODE_ENV === 'development';
		this.config.isProduction = process.env.NODE_ENV === 'production';

		// Security logging (disabled in production by default)
		if (process.env.ENABLE_SECURITY_LOGGING) {
			this.config.enableSecurityLogging = process.env.ENABLE_SECURITY_LOGGING === 'true';
		} else if (this.config.isProduction) {
			this.config.enableSecurityLogging = false;
		}

		// Rate limiting configuration
		if (process.env.MAX_AUTH_ATTEMPTS) {
			this.config.maxAuthAttempts = parseInt(process.env.MAX_AUTH_ATTEMPTS, 10);
		}

		if (process.env.AUTH_ATTEMPT_WINDOW) {
			this.config.authAttemptWindow = parseInt(process.env.AUTH_ATTEMPT_WINDOW, 10);
		}

		// Session timeout
		if (process.env.SESSION_TIMEOUT) {
			this.config.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT, 10);
		}

		// Re-authentication requirement
		if (process.env.REQUIRE_REAUTH) {
			this.config.requireReauth = process.env.REQUIRE_REAUTH === 'true';
		}
	}

	/**
	 * Compute derived configuration settings
	 * @private
	 */
	computeDerivedSettings() {
		// Authentication required if terminal key is not default
		if (this.config.authRequired === null) {
			this.config.authRequired = this.config.terminalKey !== 'change-me';
		}

		// In development, be more permissive with rate limiting
		if (this.config.isDevelopment) {
			this.config.maxAuthAttempts = Math.max(this.config.maxAuthAttempts, 50);
		}
	}

	/**
	 * Validate configuration
	 * @private
	 */
	validateConfig() {
		const errors = [];

		// Validate terminal key
		if (!this.config.terminalKey || typeof this.config.terminalKey !== 'string') {
			errors.push('Terminal key must be a non-empty string');
		}

		if (this.config.terminalKey === 'change-me' && this.config.isProduction) {
			errors.push('Terminal key must be changed from default in production');
		}

		if (this.config.terminalKey.length < 8 && this.config.authRequired) {
			errors.push('Terminal key should be at least 8 characters for security');
		}

		// Validate rate limiting settings
		if (this.config.maxAuthAttempts < 1) {
			errors.push('Max auth attempts must be at least 1');
		}

		if (this.config.authAttemptWindow < 1000) {
			errors.push('Auth attempt window must be at least 1 second');
		}

		// Validate session timeout
		if (this.config.sessionTimeout !== null && this.config.sessionTimeout < 60000) {
			errors.push('Session timeout must be at least 1 minute if specified');
		}

		if (errors.length > 0) {
			throw new Error(`Authentication configuration validation failed:\n${errors.join('\n')}`);
		}
	}

	/**
	 * Get configuration value
	 * @param {string} key Configuration key
	 * @param {*} defaultValue Default value if key not found
	 * @returns {*} Configuration value
	 */
	get(key, defaultValue = undefined) {
		return this.config.hasOwnProperty(key) ? this.config[key] : defaultValue;
	}

	/**
	 * Set configuration value
	 * @param {string} key Configuration key
	 * @param {*} value Configuration value
	 */
	set(key, value) {
		this.config[key] = value;
		this.computeDerivedSettings();
	}

	/**
	 * Get all configuration as object
	 * @returns {Object} Configuration object
	 */
	getAll() {
		return { ...this.config };
	}

	/**
	 * Check if authentication is required
	 * @returns {boolean} True if authentication is required
	 */
	isAuthRequired() {
		return this.config.authRequired;
	}

	/**
	 * Check if security logging is enabled
	 * @returns {boolean} True if security logging is enabled
	 */
	isSecurityLoggingEnabled() {
		return this.config.enableSecurityLogging;
	}

	/**
	 * Get rate limiting configuration
	 * @returns {Object} Rate limiting configuration
	 */
	getRateLimitConfig() {
		return {
			maxAttempts: this.config.maxAuthAttempts,
			windowMs: this.config.authAttemptWindow
		};
	}

	/**
	 * Get authentication key for validation
	 * @returns {string} Terminal key
	 */
	getAuthKey() {
		return this.config.terminalKey;
	}

	/**
	 * Check if key is valid
	 * @param {string} key Key to validate
	 * @returns {boolean} True if key is valid
	 */
	isValidKey(key) {
		if (!key || typeof key !== 'string') {
			return false;
		}

		return key === this.config.terminalKey;
	}

	/**
	 * Get security configuration
	 * @returns {Object} Security configuration
	 */
	getSecurityConfig() {
		return {
			enableSecurityLogging: this.config.enableSecurityLogging,
			logFailedAttempts: this.config.logFailedAttempts,
			logSuccessfulAuth: this.config.logSuccessfulAuth,
			sessionTimeout: this.config.sessionTimeout,
			requireReauth: this.config.requireReauth
		};
	}

	/**
	 * Create configuration summary for logging
	 * @returns {Object} Configuration summary (without sensitive data)
	 */
	getSummary() {
		return {
			authRequired: this.config.authRequired,
			keyLength: this.config.terminalKey.length,
			keyIsDefault: this.config.terminalKey === 'change-me',
			maxAuthAttempts: this.config.maxAuthAttempts,
			authAttemptWindowMs: this.config.authAttemptWindow,
			enableSecurityLogging: this.config.enableSecurityLogging,
			environment: this.config.isDevelopment
				? 'development'
				: this.config.isProduction
					? 'production'
					: 'unknown',
			sessionTimeout: this.config.sessionTimeout,
			requireReauth: this.config.requireReauth
		};
	}

	/**
	 * Create AuthConfig instance from environment variables
	 * @param {Object} overrides Configuration overrides
	 * @returns {AuthConfig} Configured instance
	 */
	static fromEnvironment(overrides = {}) {
		return new AuthConfig(overrides);
	}

	/**
	 * Create AuthConfig instance for development
	 * @param {Object} overrides Configuration overrides
	 * @returns {AuthConfig} Development configuration
	 */
	static forDevelopment(overrides = {}) {
		return new AuthConfig({
			terminalKey: 'test',
			enableSecurityLogging: true,
			maxAuthAttempts: 100,
			isDevelopment: true,
			...overrides
		});
	}

	/**
	 * Create AuthConfig instance for production
	 * @param {string} terminalKey Production terminal key
	 * @param {Object} overrides Configuration overrides
	 * @returns {AuthConfig} Production configuration
	 */
	static forProduction(terminalKey, overrides = {}) {
		if (!terminalKey || terminalKey === 'change-me') {
			throw new Error('Production terminal key must be specified and cannot be default');
		}

		return new AuthConfig({
			terminalKey,
			enableSecurityLogging: false,
			maxAuthAttempts: 10,
			isProduction: true,
			requireReauth: true,
			...overrides
		});
	}

	/**
	 * Create AuthConfig instance for testing
	 * @param {Object} overrides Configuration overrides
	 * @returns {AuthConfig} Test configuration
	 */
	static forTesting(overrides = {}) {
		return new AuthConfig({
			terminalKey: 'test-key',
			enableSecurityLogging: false,
			maxAuthAttempts: 1000,
			authAttemptWindow: 1000,
			...overrides
		});
	}
}

/**
 * Create and export default configuration instance
 */
export const authConfig = AuthConfig.fromEnvironment();

export default authConfig;
