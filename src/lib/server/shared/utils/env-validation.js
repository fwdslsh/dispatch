/**
 * Environment Variable Validation
 * Validates environment variables on server startup
 */
import { logger } from './logger.js';
import { resolve } from 'node:path';
import { access, constants } from 'node:fs/promises';

/**
 * Valid log levels
 */
const VALID_LOG_LEVELS = ['error', 'warn', 'info', 'debug'];

/**
 * Minimum recommended key length for TERMINAL_KEY (in characters)
 */
const MIN_TERMINAL_KEY_LENGTH = 12;

/**
 * Expected ENCRYPTION_KEY length for AES-256-GCM (base64 encoded 32 bytes = 44 characters)
 */
const EXPECTED_ENCRYPTION_KEY_LENGTH = 44;

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<string>} errors - Critical errors that prevent startup
 * @property {Array<string>} warnings - Non-critical warnings about configuration
 */

/**
 * Validate that a port number is valid
 * @param {string|number} port - Port to validate
 * @returns {boolean} True if valid
 */
function isValidPort(port) {
	const portNum = parseInt(port, 10);
	return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * Validate that a path exists and is accessible
 * @param {string} path - Path to validate
 * @returns {Promise<boolean>} True if path exists and is readable
 */
async function isPathAccessible(path) {
	try {
		await access(resolve(path), constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate TERMINAL_KEY strength
 * @param {string} key - Terminal key to validate
 * @returns {Object} Validation result with errors and warnings arrays
 */
function validateTerminalKey(key) {
	const errors = [];
	const warnings = [];

	if (!key || key.length === 0) {
		errors.push('TERMINAL_KEY is required in production for authentication');
		return { valid: false, errors, warnings };
	}

	if (key.length < MIN_TERMINAL_KEY_LENGTH) {
		warnings.push(
			`TERMINAL_KEY is too short (${key.length} chars). ` +
				`Recommend at least ${MIN_TERMINAL_KEY_LENGTH} characters for security`
		);
	}

	// Check for common weak keys
	const weakKeys = ['testkey', 'password', '12345', 'change-me', 'test'];
	const lowerKey = key.toLowerCase();
	for (const weak of weakKeys) {
		if (lowerKey.includes(weak)) {
			warnings.push(
				`TERMINAL_KEY appears to contain weak pattern "${weak}". ` +
					`Use a strong, randomly generated key in production`
			);
			break;
		}
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate ENCRYPTION_KEY format
 * @param {string} key - Encryption key to validate
 * @returns {Object} Validation result with errors and warnings arrays
 */
function validateEncryptionKey(key) {
	const errors = [];
	const warnings = [];

	if (!key || key.length === 0) {
		errors.push(
			'ENCRYPTION_KEY is required in production for OAuth secret encryption. ' +
				'Generate with: openssl rand -base64 32'
		);
		return { valid: false, errors, warnings };
	}

	// Check for base64 format (allows both standard and URL-safe base64)
	const base64Regex = /^[A-Za-z0-9+/=_-]+$/;
	if (!base64Regex.test(key)) {
		warnings.push('ENCRYPTION_KEY must be a valid base64-encoded string');
	}

	// Warn if length doesn't match expected AES-256 key size
	if (key.length !== EXPECTED_ENCRYPTION_KEY_LENGTH && key.length !== 43) {
		// 43 for URL-safe base64 without padding
		warnings.push(
			`ENCRYPTION_KEY length is ${key.length} chars. ` +
				`Expected ${EXPECTED_ENCRYPTION_KEY_LENGTH} chars for AES-256-GCM. ` +
				`Generate with: openssl rand -base64 32`
		);
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate PUBLIC_BASE_URL format
 * @param {string} url - Base URL to validate
 * @returns {Object} Validation result with errors and warnings arrays
 */
function validateBaseUrl(url) {
	const errors = [];
	const warnings = [];

	if (!url || url.length === 0) {
		errors.push(
			'PUBLIC_BASE_URL is required in production for OAuth redirects. ' +
				'Example: PUBLIC_BASE_URL=https://dispatch.example.com'
		);
		return { valid: false, errors, warnings };
	}

	try {
		const parsed = new URL(url);

		// Must be HTTPS in production (unless explicitly localhost for testing)
		if (
			parsed.protocol !== 'https:' &&
			!parsed.hostname.includes('localhost') &&
			!parsed.hostname.includes('127.0.0.1')
		) {
			warnings.push(
				`PUBLIC_BASE_URL must use HTTPS in production (got ${parsed.protocol}). ` +
					`OAuth providers require secure callbacks.`
			);
		}

		// Warn about trailing slash
		if (url.endsWith('/')) {
			warnings.push('PUBLIC_BASE_URL should not have a trailing slash');
		}
	} catch (error) {
		errors.push(`PUBLIC_BASE_URL is not a valid URL: ${error.message}`);
		return { valid: false, errors, warnings };
	}

	return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate environment variables
 * @param {Object} [env=process.env] - Environment object to validate (defaults to process.env)
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validateEnvironment(env = process.env) {
	const errors = [];
	const warnings = [];
	const isProduction = env.NODE_ENV === 'production';

	logger.info(
		'EnvValidation',
		`Validating environment (NODE_ENV=${env.NODE_ENV || 'development'})`
	);

	// Production-required variables
	if (isProduction) {
		// TERMINAL_KEY validation
		const terminalKeyResult = validateTerminalKey(env.TERMINAL_KEY);
		errors.push(...terminalKeyResult.errors);
		warnings.push(...terminalKeyResult.warnings);

		// ENCRYPTION_KEY validation
		const encryptionKeyResult = validateEncryptionKey(env.ENCRYPTION_KEY);
		errors.push(...encryptionKeyResult.errors);
		warnings.push(...encryptionKeyResult.warnings);

		// PUBLIC_BASE_URL validation
		const baseUrlResult = validateBaseUrl(env.PUBLIC_BASE_URL);
		errors.push(...baseUrlResult.errors);
		warnings.push(...baseUrlResult.warnings);
	} else {
		// Development warnings for missing production-required variables
		if (!env.TERMINAL_KEY || env.TERMINAL_KEY.length < MIN_TERMINAL_KEY_LENGTH) {
			warnings.push(
				'TERMINAL_KEY is not set or weak. This is OK for development but required for production'
			);
		}
		if (!env.ENCRYPTION_KEY) {
			warnings.push(
				'ENCRYPTION_KEY is not set. OAuth secrets will be stored in PLAINTEXT. ' +
					'Set ENCRYPTION_KEY for production use.'
			);
		}
	}

	// PORT validation (all environments)
	if (env.PORT && !isValidPort(env.PORT)) {
		errors.push(`PORT must be a number between 1-65535 (got: ${env.PORT})`);
	}

	// LOG_LEVEL validation (all environments)
	const logLevel = env.DISPATCH_LOG_LEVEL || env.LOG_LEVEL;
	if (logLevel && !VALID_LOG_LEVELS.includes(logLevel)) {
		warnings.push(
			`LOG_LEVEL "${logLevel}" is not recognized. Valid values: ${VALID_LOG_LEVELS.join(', ')}`
		);
	}

	// WORKSPACES_ROOT validation (all environments)
	if (env.WORKSPACES_ROOT) {
		const workspacesAccessible = await isPathAccessible(env.WORKSPACES_ROOT);
		if (!workspacesAccessible) {
			warnings.push(
				`WORKSPACES_ROOT path "${env.WORKSPACES_ROOT}" does not exist or is not accessible. ` +
					`It will be created on first use.`
			);
		}
	} else {
		warnings.push('WORKSPACES_ROOT is not set. Using default: ~/workspaces');
	}

	// DB_PATH validation (all environments)
	if (env.DB_PATH) {
		const dbDirPath = resolve(env.DB_PATH, '..');
		const dbDirAccessible = await isPathAccessible(dbDirPath);
		if (!dbDirAccessible) {
			warnings.push(
				`DB_PATH directory "${dbDirPath}" does not exist or is not accessible. ` +
					`It will be created on first use.`
			);
		}
	}

	// LocalTunnel validation
	if (env.ENABLE_TUNNEL === 'true' && !env.PORT) {
		warnings.push('ENABLE_TUNNEL is true but PORT is not set. LocalTunnel may not work correctly.');
	}

	// Log results
	const valid = errors.length === 0;

	if (errors.length > 0) {
		logger.error('EnvValidation', 'Environment validation failed with errors:');
		errors.forEach((error) => logger.error('EnvValidation', `  - ${error}`));
	}

	if (warnings.length > 0) {
		logger.warn('EnvValidation', 'Environment validation warnings:');
		warnings.forEach((warning) => logger.warn('EnvValidation', `  - ${warning}`));
	}

	if (valid && warnings.length === 0) {
		logger.info('EnvValidation', 'Environment validation passed ✓');
	} else if (valid) {
		logger.info(
			'EnvValidation',
			`Environment validation passed with ${warnings.length} warning(s)`
		);
	}

	return {
		valid,
		errors,
		warnings
	};
}

/**
 * Validate environment and throw if critical errors are found
 * @param {Object} [env=process.env] - Environment object to validate
 * @returns {Promise<void>}
 * @throws {Error} If validation fails with critical errors
 */
export async function validateEnvironmentOrThrow(env = process.env) {
	const result = await validateEnvironment(env);

	if (!result.valid) {
		const errorMessage =
			'Environment validation failed. Please fix the following issues:\n' +
			result.errors.map((e) => `  - ${e}`).join('\n');

		throw new Error(errorMessage);
	}
}
