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
 * @property {string} typeSpecificId - Type-specific ID (terminal/Claude)
 * @property {string} workspacePath - Associated workspace path
 * @property {'pty'|'claude'} sessionType - Session type
 * @property {boolean} isActive - Whether session is currently active
 * @property {boolean} pinned - Whether session is pinned
 * @property {string} title - Session title
 * @property {string} createdAt - ISO string creation time
 * @property {string} lastActivity - ISO string last activity time
 */

/**
 * @typedef {Object} CreateSessionOptions
 * @property {'pty'|'claude'} type - Session type
 * @property {string} workspacePath - Workspace for the session
 * @property {Object} options - Type-specific options
 * @property {boolean} resume - Whether to resume existing session
 * @property {string} sessionId - Session ID when resuming
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

			const error = new Error(errorMessage);
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
	 * @param {Object} options
	 * @param {string} options.workspace - Filter by workspace path
	 * @param {boolean} options.includeAll - Include unpinned sessions
	 * @returns {Promise<{sessions: Session[]}>}
	 */
	async list({ workspace, includeAll = false } = {}) {
		try {
			const params = new URLSearchParams();
			if (workspace) params.append('workspace', workspace);
			if (includeAll) params.append('include', 'all');

			const url = `${this.baseUrl}/api/sessions${params.toString() ? '?' + params : ''}`;

			const response = await fetch(url, {
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);
			return { sessions: data.sessions || [] };
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
				type,
				workspacePath,
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

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to create session:', error);
			}
			throw error;
		}
	}

	/**
	 * Update a session (rename, pin/unpin)
	 * @param {Object} options
	 * @param {'rename'|'pin'|'unpin'} options.action - Update action
	 * @param {string} options.sessionId - Session ID
	 * @param {string} options.workspacePath - Workspace path
	 * @param {string} options.newTitle - New title (for rename)
	 * @returns {Promise<{success: boolean}>}
	 */
	async update({ action, sessionId, workspacePath, newTitle }) {
		try {
			const body = {
				action,
				sessionId,
				workspacePath
			};

			if (action === 'rename' && newTitle) {
				body.newTitle = newTitle;
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
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<{success: boolean}>}
	 */
	async delete(sessionId, workspacePath) {
		try {
			const params = new URLSearchParams({
				sessionId,
				workspacePath
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
	 * @param {string} workspacePath
	 * @param {string} newTitle
	 * @returns {Promise<{success: boolean}>}
	 */
	async rename(sessionId, workspacePath, newTitle) {
		return this.update({
			action: 'rename',
			sessionId,
			workspacePath,
			newTitle
		});
	}

	/**
	 * Pin a session (convenience method)
	 * @param {string} sessionId
	 * @param {string} workspacePath
	 * @returns {Promise<{success: boolean}>}
	 */
	async pin(sessionId, workspacePath) {
		return this.update({
			action: 'pin',
			sessionId,
			workspacePath
		});
	}

	/**
	 * Unpin a session (convenience method)
	 * @param {string} sessionId
	 * @param {string} workspacePath
	 * @returns {Promise<{success: boolean}>}
	 */
	async unpin(sessionId, workspacePath) {
		return this.update({
			action: 'unpin',
			sessionId,
			workspacePath
		});
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
