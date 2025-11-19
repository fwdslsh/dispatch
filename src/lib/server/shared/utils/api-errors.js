/**
 * api-errors.js
 *
 * Standardized error handling utilities for API routes.
 * Provides consistent error response formats, status codes, and logging.
 *
 * USAGE:
 * - Throw ApiError subclasses in API route logic
 * - Wrap route handlers with handleApiError in catch blocks
 * - Ensures consistent error responses across all API endpoints
 */

import { error } from '@sveltejs/kit';
import { createLogger } from './logger.js';

const log = createLogger('api:errors');

/**
 * Base API error class
 * Extends Error with HTTP status code and error code
 */
export class ApiError extends Error {
	/**
	 * @param {string} message - Error message
	 * @param {number} status - HTTP status code (default: 500)
	 * @param {string} code - Error code for client handling (default: 'INTERNAL_ERROR')
	 */
	constructor(message, status = 500, code = 'INTERNAL_ERROR') {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		Error.captureStackTrace?.(this, this.constructor);
	}
}

/**
 * 400 Bad Request
 * Client sent invalid or malformed request
 */
export class BadRequestError extends ApiError {
	/**
	 * @param {string} message - Error message
	 * @param {string} code - Error code (default: 'BAD_REQUEST')
	 */
	constructor(message, code = 'BAD_REQUEST') {
		super(message, 400, code);
		this.name = 'BadRequestError';
	}
}

/**
 * 401 Unauthorized
 * Authentication is required and has failed or not been provided
 */
export class UnauthorizedError extends ApiError {
	/**
	 * @param {string} message - Error message (default: 'Authentication required')
	 * @param {string} code - Error code (default: 'UNAUTHORIZED')
	 */
	constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
		super(message, 401, code);
		this.name = 'UnauthorizedError';
	}
}

/**
 * 403 Forbidden
 * Client is authenticated but doesn't have permission
 */
export class ForbiddenError extends ApiError {
	/**
	 * @param {string} message - Error message (default: 'Access forbidden')
	 * @param {string} code - Error code (default: 'FORBIDDEN')
	 */
	constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
		super(message, 403, code);
		this.name = 'ForbiddenError';
	}
}

/**
 * 404 Not Found
 * Requested resource does not exist
 */
export class NotFoundError extends ApiError {
	/**
	 * @param {string} message - Error message (default: 'Resource not found')
	 * @param {string} code - Error code (default: 'NOT_FOUND')
	 */
	constructor(message = 'Resource not found', code = 'NOT_FOUND') {
		super(message, 404, code);
		this.name = 'NotFoundError';
	}
}

/**
 * 409 Conflict
 * Request conflicts with current state (e.g., duplicate resource)
 */
export class ConflictError extends ApiError {
	/**
	 * @param {string} message - Error message
	 * @param {string} code - Error code (default: 'CONFLICT')
	 */
	constructor(message, code = 'CONFLICT') {
		super(message, 409, code);
		this.name = 'ConflictError';
	}
}

/**
 * 422 Unprocessable Entity
 * Request is well-formed but semantically invalid
 */
export class ValidationError extends ApiError {
	/**
	 * @param {string} message - Error message
	 * @param {Object} fields - Field-specific validation errors
	 * @param {string} code - Error code (default: 'VALIDATION_ERROR')
	 */
	constructor(message, fields = {}, code = 'VALIDATION_ERROR') {
		super(message, 422, code);
		this.name = 'ValidationError';
		this.fields = fields;
	}
}

/**
 * 500 Internal Server Error
 * Unexpected server error occurred
 */
export class InternalServerError extends ApiError {
	/**
	 * @param {string} message - Error message (default: 'An unexpected error occurred')
	 * @param {string} code - Error code (default: 'INTERNAL_ERROR')
	 */
	constructor(message = 'An unexpected error occurred', code = 'INTERNAL_ERROR') {
		super(message, 500, code);
		this.name = 'InternalServerError';
	}
}

/**
 * 503 Service Unavailable
 * Service is temporarily unavailable (maintenance, overload, etc.)
 */
export class ServiceUnavailableError extends ApiError {
	/**
	 * @param {string} message - Error message (default: 'Service temporarily unavailable')
	 * @param {string} code - Error code (default: 'SERVICE_UNAVAILABLE')
	 */
	constructor(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
		super(message, 503, code);
		this.name = 'ServiceUnavailableError';
	}
}

/**
 * Handle API errors consistently across all routes
 * Logs errors and throws SvelteKit error with standardized format
 *
 * @param {Error} err - The error to handle
 * @param {string} context - Context string for logging (e.g., 'POST /api/sessions')
 * @throws {import('@sveltejs/kit').HttpError} SvelteKit HTTP error
 */
export function handleApiError(err, context = '') {
	// If already a SvelteKit error (has status and body), re-throw as-is
	if (err?.status && err?.body) {
		throw err;
	}

	// Handle our ApiError subclasses
	if (err instanceof ApiError) {
		// Log the error with appropriate level based on status code
		const logMessage = context ? `[${context}] ${err.message}` : err.message;
		const logMeta = {
			code: err.code,
			status: err.status,
			name: err.name
		};

		// Add validation fields if present
		if (err instanceof ValidationError && err.fields) {
			logMeta.fields = err.fields;
		}

		// 4xx errors are client errors (warn), 5xx are server errors (error)
		if (err.status >= 500) {
			log.error(logMessage, logMeta, err.stack);
		} else {
			log.warn(logMessage, logMeta);
		}

		// Throw SvelteKit error with consistent format
		const errorBody = {
			message: err.message,
			code: err.code
		};

		// Include validation fields in response if present
		if (err instanceof ValidationError && err.fields) {
			errorBody.fields = err.fields;
		}

		throw error(err.status, errorBody);
	}

	// Handle unknown errors
	const logMessage = context ? `[${context}] Unexpected error` : 'Unexpected error';
	log.error(logMessage, {
		errorName: err?.name,
		errorMessage: err?.message,
		stack: err?.stack
	});

	// Return generic 500 error for unknown errors (don't leak internal details)
	throw error(500, {
		message: 'An unexpected error occurred',
		code: 'INTERNAL_ERROR'
	});
}

/**
 * Validate request body fields
 * Throws ValidationError if any required fields are missing
 *
 * @param {Object} body - Request body to validate
 * @param {string[]} requiredFields - Array of required field names
 * @throws {ValidationError} If validation fails
 */
export function validateRequiredFields(body, requiredFields) {
	const missing = [];
	const fields = {};

	for (const field of requiredFields) {
		if (body[field] === undefined || body[field] === null || body[field] === '') {
			missing.push(field);
			fields[field] = 'This field is required';
		}
	}

	if (missing.length > 0) {
		throw new ValidationError(
			`Missing required fields: ${missing.join(', ')}`,
			fields,
			'MISSING_REQUIRED_FIELDS'
		);
	}
}

/**
 * Validate that a value is one of the allowed options
 *
 * @param {string} fieldName - Field name for error messages
 * @param {*} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @throws {ValidationError} If validation fails
 */
export function validateEnum(fieldName, value, allowedValues) {
	if (!allowedValues.includes(value)) {
		throw new ValidationError(
			`Invalid ${fieldName}: must be one of ${allowedValues.join(', ')}`,
			{ [fieldName]: `Must be one of: ${allowedValues.join(', ')}` },
			'INVALID_ENUM_VALUE'
		);
	}
}
