/**
 * SessionApiClient.js
 *
 * API client for session-related operations.
 * Encapsulates all HTTP requests for session management.
 */

import { SESSION_TYPE } from '../../../shared/session-types.js';
import { SvelteDate } from 'svelte/reactivity';

/**
 * @typedef {Object} Session
 * @property {string} id - Unified session ID
 * @property {string} type - Session kind/type (e.g. 'pty', 'claude', or 'file-editor')
 * @property {boolean} isActive - Whether session is currently active
 * @property {string} title - Session title
 * @property {string|number|Date} createdAt - Creation timestamp
 * @property {string|number|Date} lastActivity - Last activity timestamp
 * Note: Sessions are self-contained. Working directory is managed internally by adapters.
 */

/**
 * @typedef {Object} CreateSessionOptions
 * @property {string} type - Session type (pty, claude, or file-editor)
 * @property {Object} [options] - Type-specific options (may include cwd for adapters)
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
	 * Get standard headers for API requests
	 * Authentication is handled via session cookies (credentials: 'include')
	 * @returns {Object} Headers object
	 */
	getHeaders() {
		return {
			'content-type': 'application/json'
		};
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
	 * List all sessions
	 * Sessions are self-contained - no workspace filtering needed
	 * @returns {Promise<{sessions: Session[]}>}
	 */
	async list() {
		try {
			const url = `${this.baseUrl}/api/sessions`;
			console.log('[SessionApiClient] Fetching URL:', url);

			const response = await fetch(url, {
				headers: this.getHeaders(),
				credentials: 'include' // Send session cookie
			});

			const data = await this.handleResponse(response);
			// Normalize session objects to the shape UI expects
			const raw = data.sessions || [];
			console.log('[SessionApiClient] Raw API data:', data);
			console.log('[SessionApiClient] Raw sessions array:', raw);
			const sessions = raw
				.map((s) => {
					if (!s) return null;
					const id = s.id || s.runId || s.run_id || s.sessionId || s.session_id;
					const type = s.type || s.kind || s.sessionType || s.kind_name || SESSION_TYPE.PTY;
					const isActive =
						s.isActive === true ||
						s.isLive === true ||
						s.status === 'running' ||
						s.status === 'active';
					const title = s.title || s.name || `${type} Session`;
					const createdAt = s.createdAt || s.created_at || s.created || null;
					const lastActivity =
						s.lastActivity || s.last_activity || s.updatedAt || s.updated_at || null;

					const normalized = {
						id,
						type,
						isActive,
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
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to list sessions:', error);
			}
			throw error;
		}
	}

	/**
	 * Create a new session
	 * Sessions are self-contained - adapter manages working directory internally
	 * @param {CreateSessionOptions} options
	 */
	async create({ type, options = {}, resume = false, sessionId = null }) {
		try {
			// Validate session type
			if (
				!type ||
				![SESSION_TYPE.PTY, SESSION_TYPE.CLAUDE, SESSION_TYPE.FILE_EDITOR].includes(type)
			) {
				throw new Error(`Invalid session type: ${type}`);
			}

			const body = {
				kind: type,
				options
			};

			if (resume && sessionId) {
				body.resume = true;
				body.sessionId = sessionId;
			}

			const response = await fetch(`${this.baseUrl}/api/sessions`, {
				method: 'POST',
				headers: this.getHeaders(),
				credentials: 'include', // Send session cookie
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

			// Get title based on session type
			const getSessionTitle = (sessionType) => {
				switch (sessionType) {
					case SESSION_TYPE.CLAUDE:
						return 'Claude session';
					case SESSION_TYPE.PTY:
						return 'Terminal session';
					case SESSION_TYPE.FILE_EDITOR:
						return 'File Editor';
					default:
						return `${sessionType} session`;
				}
			};

			return {
				id,
				// Use validated type consistently
				type,
				sessionType: type,
				isActive: true,
				resumed: raw?.resumed ?? (resume && !!sessionId) ?? false,
				title: raw?.title || getSessionTitle(type),
				createdAt: raw?.createdAt || new SvelteDate().toISOString(),
				lastActivity: raw?.lastActivity || new SvelteDate().toISOString(),
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
	 * Delete/terminate a session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<{success: boolean}>}
	 */
	async delete(sessionId) {
		try {
			const params = new URLSearchParams({
				runId: sessionId // Server expects runId parameter
			});

			const response = await fetch(`${this.baseUrl}/api/sessions?${params}`, {
				method: 'DELETE',
				headers: this.getHeaders(),
				credentials: 'include' // Send session cookie
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
	 * Get session history
	 * @param {string} sessionId
	 * @returns {Promise<Array>}
	 */
	async getHistory(sessionId) {
		try {
			const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/history`, {
				headers: this.getHeaders(),
				credentials: 'include' // Send session cookie
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
				headers: this.getHeaders(),
				credentials: 'include' // Send session cookie
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
				headers: this.getHeaders(),
				credentials: 'include' // Send session cookie
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

	// ===== ONBOARDING API =====

	/**
	 * Get system status including onboarding completion
	 * @returns {Promise<{onboarding: {isComplete: boolean, completedAt: string|null, firstWorkspaceId: string|null}, authentication: {configured: boolean}, server: {version: string, uptime: number}}>}
	 */
	async getSystemStatus() {
		try {
			const response = await fetch(`${this.baseUrl}/api/status`, {
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const data = await this.handleResponse(response);

			return {
				onboarding: data.onboarding || {
					isComplete: false,
					completedAt: null,
					firstWorkspaceId: null
				},
				authentication: data.authentication || { configured: false },
				server: data.server || { version: '1.0.0', uptime: 0 }
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get system status:', error);
			}
			// Return defaults on error
			return {
				onboarding: {
					isComplete: false,
					completedAt: null,
					firstWorkspaceId: null
				},
				authentication: { configured: false },
				server: { version: '1.0.0', uptime: 0 }
			};
		}
	}

	// ===== RETENTION POLICY API (via Preferences) =====

	/**
	 * Get current retention policy from maintenance preferences
	 * @returns {Promise<{sessionRetentionDays: number, logRetentionDays: number, autoCleanupEnabled: boolean, updatedAt: string}>}
	 */
	async getRetentionPolicy() {
		try {
			const params = new URLSearchParams();
			params.append('category', 'maintenance');

			const response = await fetch(`${this.baseUrl}/api/preferences?${params}`, {
				headers: this.getHeaders(),
				credentials: 'include' // Send session cookie
			});

			const data = await this.handleResponse(response);

			// Return retention policy data or defaults
			return {
				sessionRetentionDays: data.sessionRetentionDays || 30,
				logRetentionDays: data.logRetentionDays || 7,
				autoCleanupEnabled: data.autoCleanupEnabled ?? true,
				updatedAt: data.updatedAt || new SvelteDate().toISOString()
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get retention policy:', error);
			}
			throw error;
		}
	}

	/**
	 * Update retention policy via maintenance preferences
	 * @param {object} policy - Policy updates
	 * @param {number} [policy.sessionRetentionDays] - Session retention period
	 * @param {number} [policy.logRetentionDays] - Log retention period
	 * @param {boolean} [policy.autoCleanupEnabled] - Auto cleanup enabled
	 * @returns {Promise<{sessionRetentionDays: number, logRetentionDays: number, autoCleanupEnabled: boolean, updatedAt: string}>}
	 */
	async updateRetentionPolicy(policy) {
		try {
			const response = await fetch(`${this.baseUrl}/api/preferences`, {
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify({
					category: 'maintenance',
					preferences: policy
				})
			});

			const data = await this.handleResponse(response);
			return data.preferences || data;
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to update retention policy:', error);
			}
			throw error;
		}
	}

	/**
	 * Preview retention policy changes via maintenance API
	 * @param {object} _policy - Policy to preview (unused, API infers from current settings)
	 * @param {number} _policy.sessionRetentionDays - Session retention period
	 * @param {number} _policy.logRetentionDays - Log retention period
	 * @returns {Promise<{summary: string, sessionsToDelete: number, logsToDelete: number, sessionRetentionDays: number, logRetentionDays: number}>}
	 */
	async previewRetentionChanges(_policy) {
		try {
			const response = await fetch(`${this.baseUrl}/api/maintenance`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					action: 'preview'
				})
			});

			const data = await this.handleResponse(response);
			return data.preview || data;
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to preview retention changes:', error);
			}
			throw error;
		}
	}

	/**
	 * Execute cleanup operation via maintenance API
	 * @returns {Promise<{sessionsDeleted: number, logsDeleted: number, summary: string}>}
	 */
	async executeCleanup() {
		try {
			const response = await fetch(`${this.baseUrl}/api/maintenance`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					action: 'cleanup'
				})
			});

			const data = await this.handleResponse(response);
			return data.cleanup || data;
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to execute cleanup:', error);
			}
			throw error;
		}
	}

	// ===== USER PREFERENCES API =====

	/**
	 * Get user preferences
	 * @param {string} [category] - Specific category to get
	 * @returns {Promise<object>} - Preferences object
	 */
	async getUserPreferences(category = null) {
		try {
			const params = new URLSearchParams();
			if (category) params.append('category', category);

			const response = await fetch(
				`${this.baseUrl}/api/preferences${params.toString() ? '?' + params : ''}`,
				{
					headers: this.getHeaders()
				}
			);

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get user preferences:', error);
			}
			throw error;
		}
	}

	/**
	 * Update user preferences
	 * @param {string} category - Preference category
	 * @param {object} preferences - Preferences to update
	 * @returns {Promise<{success: boolean, category: string, preferences: object}>}
	 */
	async updateUserPreferences(category, preferences) {
		try {
			const response = await fetch(`${this.baseUrl}/api/preferences`, {
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify({
					category,
					preferences
				})
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to update user preferences:', error);
			}
			throw error;
		}
	}

	/**
	 * Reset preferences to defaults
	 * @param {string} category - Category to reset
	 * @returns {Promise<{success: boolean, category: string, preferences: object}>}
	 */
	async resetPreferences(category) {
		try {
			const response = await fetch(`${this.baseUrl}/api/preferences`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					action: 'reset',
					category
				})
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to reset preferences:', error);
			}
			throw error;
		}
	}

	// ===== HELPER METHODS =====

	/**
	 * Dispose of resources (for cleanup)
	 */
	dispose() {
		// No resources to clean up in this implementation
		// But keeping the method for interface consistency
	}
}
