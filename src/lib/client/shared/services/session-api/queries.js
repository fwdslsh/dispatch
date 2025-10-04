/**
 * Query operations for session API
 * Read-only operations that retrieve data without modifications
 */

import { SESSION_TYPE, getHeaders, handleResponse } from './types.js';

/**
 * List all sessions with optional filtering
 * @param {Object} config - API configuration
 * @param {Object} [options] - List options
 * @param {string} [options.workspace] - Filter by workspace path
 * @param {boolean} [options.includeAll=false] - Include sessions not in layout
 * @returns {Promise<{sessions: Array}>}
 */
export async function listSessions(config, { workspace, includeAll = false } = {}) {
	try {
		const params = new URLSearchParams();
		if (workspace) params.append('workspace', workspace);
		if (includeAll) params.append('include', 'all');

		const url = `${config.apiBaseUrl || ''}/api/sessions${params.toString() ? '?' + params : ''}`;
		console.log('[SessionApiClient] Fetching URL:', url);

		const response = await fetch(url, {
			headers: getHeaders(config)
		});

		const data = await handleResponse(response);
		const raw = data.sessions || [];
		console.log('[SessionApiClient] Raw API data:', data);
		console.log('[SessionApiClient] Raw sessions array:', raw);

		const sessions = raw
			.map((s) => {
				if (!s) return null;
				const id = s.id || s.runId || s.run_id || s.sessionId || s.session_id;
				const type = s.type || s.kind || s.sessionType || s.kind_name || SESSION_TYPE.PTY;
				const workspacePath = s.workspacePath || s.cwd || (s.meta && s.meta.cwd) || '';
				const isActive =
					s.isActive === true ||
					s.isLive === true ||
					s.status === 'running' ||
					s.status === 'active';
				const tileIdValue = s.tile_id || s.tileId || (s.inLayout ? s.tileId : undefined);
				const inLayout = s.inLayout === true || !!tileIdValue || s.in_layout === true;
				const title = s.title || s.name || `${type} Session`;
				const createdAt = s.createdAt || s.created_at || s.created || null;
				const lastActivity =
					s.lastActivity || s.last_activity || s.updatedAt || s.updated_at || null;

				const normalized = {
					id,
					type,
					workspacePath,
					isActive,
					inLayout,
					tileId: tileIdValue,
					title,
					createdAt,
					lastActivity,
					_raw: s
				};

				if (!id) {
					console.log('[SessionApiClient] Session missing ID, filtering out:', s);
					return null;
				}

				return normalized;
			})
			.filter(Boolean);

		console.log('[SessionApiClient] Normalized sessions count:', sessions.length);
		console.log('[SessionApiClient] First normalized session:', sessions[0]);

		return { sessions };
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to list sessions:', error);
		}
		throw error;
	}
}

/**
 * Get session history/events
 * @param {Object} config - API configuration
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>}
 */
export async function getSessionHistory(config, sessionId) {
	try {
		const response = await fetch(`${config.apiBaseUrl || ''}/api/sessions/${sessionId}/history`, {
			headers: getHeaders(config)
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to get session history:', error);
		}
		throw error;
	}
}

/**
 * Get workspace sessions layout
 * @param {Object} config - API configuration
 * @returns {Promise<Object>}
 */
export async function getWorkspaceLayout(config) {
	try {
		const response = await fetch(`${config.apiBaseUrl || ''}/api/workspaces/layout`, {
			headers: getHeaders(config)
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to get workspace layout:', error);
		}
		throw error;
	}
}

/**
 * Get Claude sessions for a project
 * @param {Object} config - API configuration
 * @param {string} project - Project path
 * @returns {Promise<Object>}
 */
export async function getClaudeSessions(config, project) {
	try {
		const response = await fetch(
			`${config.apiBaseUrl || ''}/api/claude/sessions?project=${encodeURIComponent(project)}`,
			{
				headers: getHeaders(config)
			}
		);

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to get Claude sessions:', error);
		}
		throw error;
	}
}

/**
 * Check Claude authentication status
 * @param {Object} config - API configuration
 * @returns {Promise<Object>}
 */
export async function checkClaudeAuth(config) {
	try {
		const response = await fetch(`${config.apiBaseUrl || ''}/api/claude/auth/check`, {
			method: 'GET',
			headers: getHeaders(config)
		});

		return await handleResponse(response);
	} catch (error) {
		if (config.debug) {
			console.error('[SessionApiClient] Failed to check Claude auth:', error);
		}
		throw error;
	}
}
