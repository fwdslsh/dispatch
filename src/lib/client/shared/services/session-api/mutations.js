/**
 * Mutation operations for session API
 * Write operations that create, update, or delete data
 */

import { SESSION_TYPE, getHeaders, handleResponse } from './types.js';

/**
 * Create a new session
 * @param {Object} config - API configuration
 * @param {Object} options - Creation options
 * @param {string} options.type - Session type
 * @param {string} options.workspacePath - Workspace path
 * @param {Object} [options.options] - Type-specific options
 * @param {boolean} [options.resume] - Resume existing session
 * @param {string} [options.sessionId] - Session ID when resuming
 * @returns {Promise<Object>}
 */
export async function createSession(
	config,
	{ type, workspacePath, options = {}, resume = false, sessionId = null }
) {
	try {
		// Validate session type
		if (
			!type ||
			![
				SESSION_TYPE.PTY,
				SESSION_TYPE.CLAUDE,
				SESSION_TYPE.FILE_EDITOR,
				SESSION_TYPE.OPENCODE,
				SESSION_TYPE.OPENCODE_TUI
			].includes(type)
		) {
			throw new Error(`Invalid session type: ${type}`);
		}

		const body = {
			kind: type,
			cwd: workspacePath,
			options
		};

		if (resume && sessionId) {
			body.resume = true;
			body.sessionId = sessionId;
		}

		const response = await fetch(`${config.apiBaseUrl || ''}/api/sessions`, {
			method: 'POST',
			headers: getHeaders(config),
			body: JSON.stringify(body)
		});

		const raw = await handleResponse(response);
		const id =
			raw?.id ||
			raw?.runId ||
			raw?.run_id ||
			raw?.sessionId ||
			raw?.session_id ||
			sessionId ||
			null;

		if (!id && config.debug) {
			console.warn('[SessionApiClient] Session create response missing id field', raw);
		}

		const getSessionTitle = (sessionType) => {
			switch (sessionType) {
				case SESSION_TYPE.CLAUDE:
					return 'Claude session';
				case SESSION_TYPE.PTY:
					return 'Terminal session';
				case SESSION_TYPE.FILE_EDITOR:
					return 'File Editor';
				case SESSION_TYPE.OPENCODE:
					return 'OpenCode session';
				case SESSION_TYPE.OPENCODE_TUI:
					return 'OpenCode TUI session';
				default:
					return `${sessionType} session`;
			}
		};

		return {
			id,
			type,
			sessionType: type,
			workspacePath,
			isActive: true,
			inLayout: false,
			resumed: raw?.resumed ?? (resume && !!sessionId) ?? false,
			title: raw?.title || getSessionTitle(type),
			createdAt: raw?.createdAt || new Date().toISOString(),
			lastActivity: raw?.lastActivity || new Date().toISOString(),
			activityState: raw?.activityState || 'launching',
			_raw: raw
		};
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to create session:', error);
		}
		throw error;
	}
}

/**
 * Update a session
 * @param {Object} config - API configuration
 * @param {Object} options - Update options
 * @returns {Promise<Object>}
 */
export async function updateSession(
	config,
	{ action, sessionId, newTitle, tileId, position, clientId }
) {
	try {
		const body = {
			action,
			runId: sessionId
		};

		if (action === 'rename' && newTitle) {
			body.newTitle = newTitle;
		}

		if (action === 'setLayout') {
			body.tileId = tileId;
			body.position = position || 0;
			body.clientId = clientId;
		}

		const response = await fetch(`${config.apiBaseUrl || ''}/api/sessions`, {
			method: 'PUT',
			headers: getHeaders(config),
			body: JSON.stringify(body)
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to update session:', error);
		}
		throw error;
	}
}

/**
 * Delete a session
 * @param {Object} config - API configuration
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>}
 */
export async function deleteSession(config, sessionId) {
	try {
		const response = await fetch(`${config.apiBaseUrl || ''}/api/sessions/${sessionId}`, {
			method: 'DELETE',
			headers: getHeaders(config)
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to delete session:', error);
		}
		throw error;
	}
}

/**
 * Send input to a session
 * @param {Object} config - API configuration
 * @param {string} sessionId - Session ID
 * @param {string} input - Input data
 * @returns {Promise<Object>}
 */
export async function sendSessionInput(config, sessionId, input) {
	try {
		const response = await fetch(`${config.apiBaseUrl || ''}/api/sessions/${sessionId}/input`, {
			method: 'POST',
			headers: getHeaders(config),
			body: JSON.stringify({ input })
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to send input:', error);
		}
		throw error;
	}
}

/**
 * Close a session
 * @param {Object} config - API configuration
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>}
 */
export async function closeSession(config, sessionId) {
	try {
		const response = await fetch(`${config.apiBaseUrl || ''}/api/sessions/${sessionId}/close`, {
			method: 'POST',
			headers: getHeaders(config)
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to close session:', error);
		}
		throw error;
	}
}
