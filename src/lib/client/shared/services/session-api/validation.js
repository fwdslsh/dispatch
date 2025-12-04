/**
 * Validation utilities for session API
 * Pure validation functions that return ValidationResult objects
 */

import { SESSION_TYPE } from './types.js';

/**
 * Validate session type
 * @param {any} type - Type to validate
 * @returns {{success: boolean, data?: string, error?: string}}
 */
export function validateSessionType(type) {
	if (!type) {
		return { success: false, error: 'Session type is required' };
	}

	if (![SESSION_TYPE.PTY, SESSION_TYPE.CLAUDE, SESSION_TYPE.FILE_EDITOR, SESSION_TYPE.OPENCODE, SESSION_TYPE.OPENCODE_TUI].includes(type)) {
		return { success: false, error: `Invalid session type: ${type}` };
	}

	return { success: true, data: type };
}

/**
 * Validate session ID
 * @param {any} sessionId - Session ID to validate
 * @returns {{success: boolean, data?: string, error?: string}}
 */
export function validateSessionId(sessionId) {
	if (!sessionId) {
		return { success: false, error: 'Session ID is required' };
	}

	if (typeof sessionId !== 'string') {
		return { success: false, error: 'Session ID must be a string' };
	}

	if (sessionId.trim().length === 0) {
		return { success: false, error: 'Session ID cannot be empty' };
	}

	return { success: true, data: sessionId };
}

/**
 * Validate workspace path
 * @param {any} workspacePath - Workspace path to validate
 * @returns {{success: boolean, data?: string, error?: string}}
 */
export function validateWorkspacePath(workspacePath) {
	if (!workspacePath) {
		return { success: false, error: 'Workspace path is required' };
	}

	if (typeof workspacePath !== 'string') {
		return { success: false, error: 'Workspace path must be a string' };
	}

	if (workspacePath.trim().length === 0) {
		return { success: false, error: 'Workspace path cannot be empty' };
	}

	// Basic path validation - should start with /
	if (!workspacePath.startsWith('/')) {
		return { success: false, error: 'Workspace path must be absolute (start with /)' };
	}

	return { success: true, data: workspacePath };
}

/**
 * Validate session creation data
 * @param {any} data - Data to validate
 * @returns {{success: boolean, data?: Object, error?: string}}
 */
export function validateSessionData(data) {
	if (!data || typeof data !== 'object') {
		return { success: false, error: 'Session data must be an object' };
	}

	const typeValidation = validateSessionType(data.type);
	if (!typeValidation.success) {
		return typeValidation;
	}

	const pathValidation = validateWorkspacePath(data.workspacePath);
	if (!pathValidation.success) {
		return pathValidation;
	}

	return {
		success: true,
		data: {
			type: typeValidation.data,
			workspacePath: pathValidation.data,
			options: data.options || {},
			resume: Boolean(data.resume),
			sessionId: data.sessionId || null
		}
	};
}

/**
 * Sanitize input string to prevent injection attacks
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
	if (typeof input !== 'string') {
		return '';
	}

	// Basic sanitization - remove control characters except newlines and tabs
	// eslint-disable-next-line no-control-regex -- Control characters intentionally removed for security
	return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
