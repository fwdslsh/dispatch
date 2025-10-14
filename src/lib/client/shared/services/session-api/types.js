/**
 * Shared types and utilities for session-api modules
 */

import { SESSION_TYPE } from '../../../../shared/session-types.js';

/**
 * @typedef {Object} Session
 * @property {string} id - Unified session ID
 * @property {string} type - Session kind/type (e.g. 'pty', 'claude', or 'file-editor')
 * @property {string} workspacePath - Associated workspace path (cwd)
 * @property {boolean} isActive - Whether session is currently active
 * @property {boolean} inLayout - Whether session is displayed in layout
 * @property {string} tileId - Optional tile id when placed in layout
 * @property {string} title - Session title
 * @property {string|number|Date} createdAt - Creation timestamp
 * @property {string|number|Date} lastActivity - Last activity timestamp
 */

/**
 * @typedef {Object} CreateSessionOptions
 * @property {string} type - Session type (pty, claude, or file-editor)
 * @property {string} workspacePath - Workspace for the session
 * @property {Object} [options] - Type-specific options
 * @property {boolean} [resume] - Whether to resume existing session
 * @property {string} [sessionId] - Session ID when resuming
 */

/**
 * @typedef {Object} SessionConfig
 * @property {string} apiBaseUrl - Base URL for API requests
 * @property {string} authTokenKey - Key for auth token in localStorage
 * @property {boolean} debug - Enable debug logging
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} success - Whether validation passed
 * @property {any} [data] - Validated data if successful
 * @property {string} [error] - Error message if validation failed
 */

export { SESSION_TYPE };

/**
 * Get headers for API requests
 * @param {SessionConfig} _config
 * @returns {Object} Headers object
 */
export function getHeaders(_config) {
	return {
		'content-type': 'application/json'
	};
}

/**
 * Handle API response and error cases
 * @param {Response} response
 * @returns {Promise<any>}
 */
export async function handleResponse(response) {
	if (!response.ok) {
		const errorBody = await response.text();
		let errorMessage;

		try {
			const errorData = JSON.parse(errorBody);
			errorMessage = errorData.error || errorData.message || response.statusText;
		} catch {
			errorMessage = errorBody || response.statusText;
		}

		const error = /** @type {Error & {status?: number, statusText?: string, code?: string}} */ (
			new Error(errorMessage)
		);
		error.status = response.status;
		error.statusText = response.statusText;

		// Add specific error codes for common issues
		if (errorMessage.includes('node-pty failed to load')) {
			error.code = 'TERMINAL_UNAVAILABLE';
		} else if (errorMessage.includes('Vite module runner')) {
			error.code = 'SERVER_RESTARTING';
		}

		throw error;
	}

	const contentType = response.headers.get('content-type');
	if (contentType && contentType.includes('application/json')) {
		return response.json();
	}

	return response.text();
}
