/**
 * SessionApiClient.js
 *
 * API client for session-related operations.
 * Encapsulates all HTTP requests for session management.
 * Maintains backward compatibility with existing API contracts.
 */

/**
 * @typedef {Object} Session
 * @property {string} id - Unified session ID
 * @property {string} type - Session kind/type (e.g. 'pty' or 'claude')
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
 * @property {'pty'|'claude'} type - Session type
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

export class SessionApiClient {
	/**
	 * @param {SessionConfig} config
	 */
	constructor(config) {
		this.config = config;
		this.baseUrl = config.apiBaseUrl || '';
	}

	/**
	 * Get authorization header if auth token exists
	 * @returns {Object} Headers object
	 */
	getHeaders() {
		const headers = {
			'content-type': 'application/json'
		};

		if (typeof localStorage !== 'undefined') {
			const token = localStorage.getItem(this.config.authTokenKey);
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
		}

		return headers;
	}

	/**
	 * Handle API response and error cases
	 * @param {Response} response
	 * @returns {Promise<any>}
	 */
	async handleResponse(response) {
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

	/**
	 * List sessions with optional filtering
	 * @param {Object} [options] - List options
	 * @param {string} [options.workspace] - Filter by workspace path
	 * @param {boolean} [options.includeAll=false] - Include sessions not in layout
	 * @returns {Promise<{sessions: Session[]}>}
	 */
	async list({ workspace, includeAll = false } = {}) {
		try {
			const params = new URLSearchParams();
			if (workspace) params.append('workspace', workspace);
			if (includeAll) params.append('include', 'all');

			const url = `${this.baseUrl}/api/sessions${params.toString() ? '?' + params : ''}`;
			console.log('[SessionApiClient] Fetching URL:', url);

			const response = await fetch(url, {
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);
			// Normalize session objects to the shape UI expects. Server may return
			// fields like `kind`, `cwd`, `tileId`, `created_at`, `last_activity`.
			const raw = data.sessions || [];
			console.log('[SessionApiClient] Raw API data:', data);
			console.log('[SessionApiClient] Raw sessions array:', raw);
			const sessions = raw.map((s) => {
				if (!s) return null;
				// Accept multiple possible field names for compatibility
				const id = s.id || s.runId || s.run_id || s.sessionId || s.session_id;
				const type = s.type || s.kind || s.sessionType || s.kind_name || 'pty';
				const workspacePath = s.workspacePath || s.cwd || (s.meta && s.meta.cwd) || '';
				const isActive = s.isActive === true || s.isLive === true || s.status === 'running' || s.status === 'active';
				const tileIdValue = s.tile_id || s.tileId || (s.inLayout ? s.tileId : undefined);
				const inLayout = s.inLayout === true || !!tileIdValue || s.in_layout === true;
				const title = s.title || s.name || `${type} Session`;
				const createdAt = s.createdAt || s.created_at || s.created || null;
				const lastActivity = s.lastActivity || s.last_activity || s.updatedAt || s.updated_at || null;

				const normalized = {
					id,
					type,
					workspacePath,
					isActive,
					inLayout,
					tileId: tileIdValue,  // Convert to camelCase for UI consistency
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
			}).filter(Boolean);

			console.log('[SessionApiClient] Normalized sessions count:', sessions.length);
			console.log('[SessionApiClient] First normalized session:', sessions[0]);

			return { sessions };
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to list sessions:', error);
			}
			throw error;
		}
	}

	/**
	 * Create a new session
	 * @param {CreateSessionOptions} options
	 * @returns {Promise<{id: string, typeSpecificId: string|null, resumed?: boolean}>}
	 */
	async create({ type, workspacePath, options = {}, resume = false, sessionId = null }) {
		try {
			const body = {
				kind: type,  // API expects 'kind' not 'type'
				cwd: workspacePath,  // API expects 'cwd' not 'workspacePath'
				options
			};

			if (resume && sessionId) {
				body.resume = true;
				body.sessionId = sessionId;
			}

			const response = await fetch(`${this.baseUrl}/api/sessions`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify(body)
			});

			const raw = await this.handleResponse(response);
			const id =
				raw?.id ||
				raw?.runId ||
				raw?.run_id ||
				raw?.sessionId ||
				raw?.session_id ||
				sessionId ||
				null;

			if (!id && this.config.debug) {
				console.warn('[SessionApiClient] Session create response missing id field', raw);
			}

			return {
				id,
				typeSpecificId: raw?.typeSpecificId ?? raw?.type_specific_id ?? null,
				// Preserve kind so downstream callers can normalize properly
				type,
				sessionType: type,
				workspacePath,
				isActive: true,
				inLayout: false,
				resumed: raw?.resumed ?? (resume && !!sessionId) ?? false,
				title:
					raw?.title ||
					(type === 'claude' ? 'Claude session' : type === 'pty' ? 'Terminal session' : `${type} session`),
				createdAt: raw?.createdAt || new Date().toISOString(),
				lastActivity: raw?.lastActivity || new Date().toISOString(),
				activityState: raw?.activityState || 'launching',
				_raw: raw
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to create session:', error);
			}
			throw error;
		}
	}

	/**
	 * Update a session (rename, setLayout, removeLayout)
	 * @param {Object} options
	 * @param {'rename'|'setLayout'|'removeLayout'} options.action - Update action
	 * @param {string} options.sessionId - Session ID
	 * @param {string} [options.newTitle] - New title (for rename)
	 * @param {string} [options.tileId] - Tile ID (for layout actions)
	 * @param {number} [options.position] - Position (for layout actions)
	 * @param {string} [options.clientId] - Client ID (for layout actions)
	 * @returns {Promise<{success: boolean}>}
	 */
	async update({ action, sessionId, newTitle, tileId, position, clientId }) {
		try {
			const body = {
				action,
				runId: sessionId  // Server expects runId parameter
			};

			if (action === 'rename' && newTitle) {
				body.newTitle = newTitle;
			}

			if (action === 'setLayout') {
				body.tileId = tileId;
				body.position = position || 0;
				body.clientId = clientId;  // Include required clientId parameter
			}

			const response = await fetch(`${this.baseUrl}/api/sessions`, {
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify(body)
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to update session:', error);
			}
			throw error;
		}
	}

	/**
	 * Delete/terminate a session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<{success: boolean}>}
	 */
	async delete(sessionId) {
		try {
			const params = new URLSearchParams({
				runId: sessionId  // Server expects runId parameter
			});

			const response = await fetch(`${this.baseUrl}/api/sessions?${params}`, {
				method: 'DELETE',
				headers: this.getHeaders()
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to delete session:', error);
			}
			throw error;
		}
	}

	/**
	 * Rename a session (convenience method)
	 * @param {string} sessionId
	 * @param {string} newTitle
	 * @returns {Promise<{success: boolean}>}
	 */
	async rename(sessionId, newTitle) {
		return this.update({
			action: 'rename',
			sessionId,
			newTitle
		});
	}

	/**
	 * Add session to layout (convenience method)
	 * @param {string} sessionId
	 * @param {string} tileId
	 * @param {number} position
	 * @param {string} clientId
	 * @returns {Promise<{success: boolean}>}
	 */
	async setLayout(sessionId, tileId, position = 0, clientId) {
		return this.update({
			action: 'setLayout',
			sessionId,
			tileId,
			position,
			clientId
		});
	}

	/**
	 * Remove session from layout (convenience method)
	 * @param {string} sessionId
	 * @returns {Promise<{success: boolean}>}
	 */
	async removeLayout(sessionId) {
		return this.update({
			action: 'removeLayout',
			sessionId
		});
	}

	// ===== LAYOUT MANAGEMENT =====

	/**
	 * Get current layout (all tile assignments)
	 * @returns {Promise<{layout: Array}>}
	 */
	async getLayout() {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions/layout`, {
				method: 'GET',
				headers: this.getHeaders()
			});
			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get layout:', error);
			}
			throw error;
		}
	}

	/**
	 * Set session layout via dedicated endpoint
	 * @param {string} sessionId
	 * @param {string} tileId
	 * @param {number} position
	 * @param {string} clientId
	 * @returns {Promise<{success: boolean}>}
	 */
	async setSessionLayout(sessionId, tileId, position = 0, clientId) {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions/layout`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					runId: sessionId,  // Server expects runId parameter
					tileId,
					position,
					clientId
				})
			});
			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to set layout:', error);
			}
			throw error;
		}
	}

	/**
	 * Remove session from layout via dedicated endpoint
	 * @param {string} sessionId
	 * @returns {Promise<{success: boolean}>}
	 */
	async removeSessionLayout(sessionId) {
		try {
			const params = new URLSearchParams({ runId: sessionId });  // Server expects runId parameter
			const response = await fetch(`${this.baseUrl}/api/sessions/layout?${params}`, {
				method: 'DELETE',
				headers: this.getHeaders()
			});
			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to remove layout:', error);
			}
			throw error;
		}
	}

	/**
	 * Get session history
	 * @param {string} sessionId
	 * @returns {Promise<Array>}
	 */
	async getHistory(sessionId) {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/history`, {
				headers: this.getHeaders()
			});

			if (response.status === 404) {
				return [];
			}

			const data = await this.handleResponse(response);
			return data.history || [];
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get session history:', error);
			}
			throw error;
		}
	}

	/**
	 * Get Claude sessions for a project
	 * @param {string} project - Project name
	 * @returns {Promise<Array>}
	 */
	async getClaudeSessions(project) {
		try {
			const response = await fetch(`${this.baseUrl}/api/claude/sessions/${project}`, {
				headers: this.getHeaders()
			});

			if (response.status === 404) {
				return [];
			}

			const data = await this.handleResponse(response);
			return data.sessions || [];
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get Claude sessions:', error);
			}
			return [];
		}
	}

	/**
	 * Check Claude authentication status
	 * @returns {Promise<{authenticated: boolean}>}
	 */
	async checkClaudeAuth() {
		try {
			const response = await fetch(`${this.baseUrl}/api/claude/auth`, {
				method: 'POST',
				headers: this.getHeaders()
			});

			if (response.status === 401) {
				return { authenticated: false };
			}

			const data = await this.handleResponse(response);
			return { authenticated: data.authenticated || false };
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to check Claude auth:', error);
			}
			return { authenticated: false };
		}
	}

	/**
	 * Validate session options
	 * @param {CreateSessionOptions} options
	 * @returns {boolean}
	 */
	validateSessionOptions(options) {
		if (!options.type || !options.workspacePath) {
			return false;
		}

		if (!['pty', 'claude'].includes(options.type)) {
			return false;
		}

		return true;
	}

	/**
	 * Dispose of resources (for cleanup)
	 */
	dispose() {
		// No resources to clean up in this implementation
		// But keeping the method for interface consistency
	}
}
