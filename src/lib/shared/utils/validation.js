/**
 * Input validation utilities for Dispatch
 * Provides comprehensive validation for security and stability
 */

import { TERMINAL_CONFIG, VALIDATION_CONFIG, ERROR_CODES } from './constants.js';
import { createErrorResponse } from './error-handling.js';

/**
 * Validation error class
 */
export class ValidationError extends Error {
	constructor(message, code = ERROR_CODES.VALIDATION_FAILED) {
		super(message);
		this.name = 'ValidationError';
		this.code = code;
	}
}

/**
 * Core validation utilities
 */
export const validators = {
	/**
	 * Validate terminal input data
	 * @param {string} data - Input data to validate
	 * @returns {string} Sanitized input data
	 * @throws {ValidationError} If validation fails
	 */
	input: (data) => {
		if (typeof data !== 'string') {
			throw new ValidationError('Input must be a string', ERROR_CODES.INVALID_INPUT);
		}

		if (data.length > TERMINAL_CONFIG.MAX_INPUT_LENGTH) {
			// Truncate instead of rejecting to maintain usability
			console.warn(
				`Input truncated from ${data.length} to ${TERMINAL_CONFIG.MAX_INPUT_LENGTH} characters`
			);
			return data.slice(0, TERMINAL_CONFIG.MAX_INPUT_LENGTH);
		}

		return data;
	},

	/**
	 * Validate terminal dimensions
	 * @param {object} dims - Dimensions object with cols and rows
	 * @returns {object} Validated dimensions
	 * @throws {ValidationError} If validation fails
	 */
	dimensions: (dims) => {
		if (!dims || typeof dims !== 'object') {
			throw new ValidationError('Dimensions must be an object', ERROR_CODES.INVALID_DIMENSIONS);
		}

		const { cols, rows } = dims;

		if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
			throw new ValidationError('Dimensions must be integers', ERROR_CODES.INVALID_DIMENSIONS);
		}

		if (cols < TERMINAL_CONFIG.MIN_COLS || cols > TERMINAL_CONFIG.MAX_COLS) {
			throw new ValidationError(
				`Columns must be between ${TERMINAL_CONFIG.MIN_COLS} and ${TERMINAL_CONFIG.MAX_COLS}`,
				ERROR_CODES.INVALID_DIMENSIONS
			);
		}

		if (rows < TERMINAL_CONFIG.MIN_ROWS || rows > TERMINAL_CONFIG.MAX_ROWS) {
			throw new ValidationError(
				`Rows must be between ${TERMINAL_CONFIG.MIN_ROWS} and ${TERMINAL_CONFIG.MAX_ROWS}`,
				ERROR_CODES.INVALID_DIMENSIONS
			);
		}

		return { cols: Math.floor(cols), rows: Math.floor(rows) };
	},

	/**
	 * Validate session name
	 * @param {string} name - Session name to validate
	 * @returns {string} Sanitized session name
	 * @throws {ValidationError} If validation fails
	 */
	sessionName: (name) => {
		if (typeof name !== 'string') {
			throw new ValidationError('Session name must be a string');
		}

		const trimmed = name.trim();

		if (trimmed.length === 0) {
			throw new ValidationError('Session name cannot be empty');
		}

		if (trimmed.length > VALIDATION_CONFIG.MAX_USERNAME_LENGTH) {
			throw new ValidationError(
				`Session name cannot exceed ${VALIDATION_CONFIG.MAX_USERNAME_LENGTH} characters`
			);
		}

		if (!VALIDATION_CONFIG.SESSION_NAME_PATTERN.test(trimmed)) {
			throw new ValidationError('Session name contains invalid characters');
		}

		return trimmed;
	},

	/**
	 * Validate session ID
	 * @param {string} sessionId - Session ID to validate
	 * @returns {string} Validated session ID
	 * @throws {ValidationError} If validation fails
	 */
	sessionId: (sessionId) => {
		if (typeof sessionId !== 'string') {
			throw new ValidationError('Session ID must be a string');
		}

		if (!VALIDATION_CONFIG.SESSION_ID_PATTERN.test(sessionId)) {
			throw new ValidationError('Invalid session ID format');
		}

		return sessionId;
	},

	/**
	 * Validate terminal mode
	 * @param {string} mode - Terminal mode to validate
	 * @returns {string} Validated mode
	 * @throws {ValidationError} If validation fails
	 */
	mode: (mode) => {
		if (typeof mode !== 'string') {
			throw new ValidationError('Mode must be a string');
		}

		if (!VALIDATION_CONFIG.ALLOWED_MODES.includes(mode)) {
			throw new ValidationError(
				`Mode must be one of: ${VALIDATION_CONFIG.ALLOWED_MODES.join(', ')}`
			);
		}

		return mode;
	},

	/**
	 * Validate session creation options
	 * @param {object} opts - Session options
	 * @returns {object} Validated options
	 * @throws {ValidationError} If validation fails
	 */
	sessionOptions: (opts) => {
		if (!opts || typeof opts !== 'object') {
			throw new ValidationError('Session options must be an object');
		}

		const validated = {};

		// Validate dimensions if provided
		if (opts.cols !== undefined || opts.rows !== undefined) {
			const dims = validators.dimensions({
				cols: opts.cols || TERMINAL_CONFIG.DEFAULT_DIMENSIONS.cols,
				rows: opts.rows || TERMINAL_CONFIG.DEFAULT_DIMENSIONS.rows
			});
			validated.cols = dims.cols;
			validated.rows = dims.rows;
		}

		// Validate mode if provided
		if (opts.mode !== undefined) {
			validated.mode = validators.mode(opts.mode);
		}

		// Validate session name if provided
		if (opts.name !== undefined) {
			validated.name = validators.sessionName(opts.name);
		}

		return validated;
	}
};

/**
 * Validation middleware for socket handlers
 */
export class ValidationMiddleware {
	/**
	 * Validate input data before processing
	 * @param {string} data - Input data
	 * @returns {object} Validation result
	 */
	static validateInput(data) {
		try {
			const validatedData = validators.input(data);
			return { success: true, data: validatedData };
		} catch (error) {
			return createErrorResponse(error.message, error.code);
		}
	}

	/**
	 * Validate dimensions before processing
	 * @param {object} dims - Dimensions object
	 * @returns {object} Validation result
	 */
	static validateDimensions(dims) {
		try {
			const validatedDims = validators.dimensions(dims);
			return { success: true, data: validatedDims };
		} catch (error) {
			return createErrorResponse(error.message, error.code);
		}
	}

	/**
	 * Validate session options before processing
	 * @param {object} opts - Session options
	 * @returns {object} Validation result
	 */
	static validateSessionOptions(opts) {
		try {
			const validatedOpts = validators.sessionOptions(opts);
			return { success: true, data: validatedOpts };
		} catch (error) {
			return createErrorResponse(error.message, error.code);
		}
	}

	/**
	 * Validate session rename request
	 * @param {string} sessionId - Session ID
	 * @param {string} newName - New session name
	 * @returns {object} Validation result
	 */
	static validateSessionRename(sessionId, newName) {
		try {
			const validatedSessionId = validators.sessionId(sessionId);
			const validatedName = validators.sessionName(newName);
			return {
				success: true,
				data: {
					sessionId: validatedSessionId,
					name: validatedName
				}
			};
		} catch (error) {
			return createErrorResponse(error.message, error.code);
		}
	}
}

/**
 * Sanitize data for safe output
 */
export const sanitizers = {
	/**
	 * Sanitize terminal output for safe display
	 * @param {string} data - Terminal output data
	 * @returns {string} Sanitized data
	 */
	terminalOutput: (data) => {
		if (typeof data !== 'string') {
			return '';
		}

		// Remove null bytes and other problematic characters
		return data.replace(/\0/g, '');
	},

	/**
	 * Sanitize session metadata for safe storage
	 * @param {object} metadata - Session metadata
	 * @returns {object} Sanitized metadata
	 */
	sessionMetadata: (metadata) => {
		if (!metadata || typeof metadata !== 'object') {
			return {};
		}

		const sanitized = {};
		const allowedKeys = ['name', 'mode', 'created', 'lastAccessed', 'cols', 'rows'];

		for (const key of allowedKeys) {
			if (metadata.hasOwnProperty(key)) {
				const value = metadata[key];

				// Sanitize based on key type
				switch (key) {
					case 'name':
						if (typeof value === 'string') {
							sanitized[key] = value.slice(0, VALIDATION_CONFIG.MAX_USERNAME_LENGTH);
						}
						break;
					case 'mode':
						if (typeof value === 'string' && VALIDATION_CONFIG.ALLOWED_MODES.includes(value)) {
							sanitized[key] = value;
						}
						break;
					case 'created':
					case 'lastAccessed':
						if (typeof value === 'number' && value > 0) {
							sanitized[key] = value;
						}
						break;
					case 'cols':
					case 'rows':
						if (Number.isInteger(value) && value > 0) {
							sanitized[key] = value;
						}
						break;
					default:
						sanitized[key] = value;
				}
			}
		}

		return sanitized;
	}
};

/**
 * Validate project name
 * @param {string} name - Project name to validate
 * @returns {object} Validation result with valid flag and errors array
 */
export function validateProjectName(name) {
	const errors = [];

	if (!name || typeof name !== 'string') {
		errors.push('Project name is required and must be a string');
		return { valid: false, errors };
	}

	const trimmedName = name.trim();

	if (trimmedName.length === 0) {
		errors.push('Project name cannot be empty');
	}

	if (trimmedName.length > 100) {
		errors.push('Project name must be 100 characters or less');
	}

	if (trimmedName.length < 2) {
		errors.push('Project name must be at least 2 characters');
	}

	// Check for invalid characters
	const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
	if (invalidChars.test(trimmedName)) {
		errors.push('Project name contains invalid characters');
	}

	// Check for reserved names
	const reservedNames = [
		'con',
		'prn',
		'aux',
		'nul',
		'com1',
		'com2',
		'com3',
		'com4',
		'com5',
		'com6',
		'com7',
		'com8',
		'com9',
		'lpt1',
		'lpt2',
		'lpt3',
		'lpt4',
		'lpt5',
		'lpt6',
		'lpt7',
		'lpt8',
		'lpt9'
	];
	if (reservedNames.includes(trimmedName.toLowerCase())) {
		errors.push('Project name is reserved and cannot be used');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
	constructor(windowMs = 60000, maxRequests = 100) {
		this.windowMs = windowMs;
		this.maxRequests = maxRequests;
		this.requests = new Map();
	}

	/**
	 * Check if request is allowed
	 * @param {string} identifier - Client identifier (e.g., socket ID)
	 * @returns {boolean} Whether request is allowed
	 */
	isAllowed(identifier) {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		// Clean up old entries
		if (!this.requests.has(identifier)) {
			this.requests.set(identifier, []);
		}

		const userRequests = this.requests.get(identifier);

		// Remove requests outside the window
		const recentRequests = userRequests.filter((timestamp) => timestamp > windowStart);
		this.requests.set(identifier, recentRequests);

		// Check if under limit
		if (recentRequests.length < this.maxRequests) {
			recentRequests.push(now);
			return true;
		}

		return false;
	}

	/**
	 * Get remaining requests in current window
	 * @param {string} identifier - Client identifier
	 * @returns {number} Remaining requests
	 */
	getRemainingRequests(identifier) {
		if (!this.requests.has(identifier)) {
			return this.maxRequests;
		}

		const now = Date.now();
		const windowStart = now - this.windowMs;
		const userRequests = this.requests.get(identifier);
		const recentRequests = userRequests.filter((timestamp) => timestamp > windowStart);

		return Math.max(0, this.maxRequests - recentRequests.length);
	}
}
