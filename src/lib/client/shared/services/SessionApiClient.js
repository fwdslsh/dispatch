/**
 * SessionApiClient.js
 *
 * API client for session-related operations.
 * Encapsulates all HTTP requests for session management.
 */

import { SESSION_TYPE } from '../../../shared/session-types.js';

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
						tileId: tileIdValue, // Convert to camelCase for UI consistency
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
	 * @param {CreateSessionOptions} options
	 */
	async create({ type, workspacePath, options = {}, resume = false, sessionId = null }) {
		try {
			// Validate session type
			if (
				!type ||
				![SESSION_TYPE.PTY, SESSION_TYPE.CLAUDE, SESSION_TYPE.FILE_EDITOR].includes(type)
			) {
				throw new Error(`Invalid session type: ${type}`);
			}

			const body = {
				kind: type, // API expects 'kind' not 'type'
				cwd: workspacePath, // API expects 'cwd' not 'workspacePath'
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
				runId: sessionId // Server expects runId parameter
			};

			if (action === 'rename' && newTitle) {
				body.newTitle = newTitle;
			}

			if (action === 'setLayout') {
				body.tileId = tileId;
				body.position = position || 0;
				body.clientId = clientId; // Include required clientId parameter
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
				runId: sessionId // Server expects runId parameter
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
					runId: sessionId, // Server expects runId parameter
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
			const params = new URLSearchParams({ runId: sessionId }); // Server expects runId parameter
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

		if (![SESSION_TYPE.PTY, SESSION_TYPE.CLAUDE, SESSION_TYPE.FILE_EDITOR].includes(options.type)) {
			return false;
		}

		return true;
	}

	// ===== ONBOARDING API =====

	/**
	 * Get current onboarding status from settings system
	 * @returns {Promise<{currentStep: string, completedSteps: string[], isComplete: boolean, firstWorkspaceId: string|null}>}
	 */
	async getOnboardingStatus() {
		try {
			const response = await fetch(`${this.baseUrl}/api/settings/onboarding`, {
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);

			// Return onboarding state or defaults if not found
			return {
				currentStep: data?.currentStep || 'auth',
				completedSteps: data?.completedSteps || [],
				isComplete: data?.isComplete || false,
				firstWorkspaceId: data?.firstWorkspaceId || null
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get onboarding status:', error);
			}
			// Return defaults on error
			return {
				currentStep: 'auth',
				completedSteps: [],
				isComplete: false,
				firstWorkspaceId: null
			};
		}
	}

	/**
	 * Update onboarding progress via settings system
	 * @param {string} step - Step that was just completed
	 * @param {object} data - Step data
	 * @returns {Promise<{success: boolean, currentStep: string, completedSteps: string[], progressPercentage: number}>}
	 */
	async updateProgress(step, data = {}) {
		try {
			// Get current state first
			const currentState = await this.getOnboardingStatus();
			const completedSteps = [...(currentState.completedSteps || [])];

			// Add the completed step if not already there
			if (!completedSteps.includes(step)) {
				completedSteps.push(step);
			}

			// Determine next step
			const stepOrder = ['auth', 'workspace', 'settings', 'complete'];
			const currentIndex = stepOrder.indexOf(step);
			const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : 'complete';

			// Update settings via settings API
			const response = await fetch(`${this.baseUrl}/api/settings/onboarding`, {
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify({
					currentStep: nextStep,
					completedSteps: completedSteps,
					isComplete: currentState.isComplete,
					firstWorkspaceId: currentState.firstWorkspaceId,
					stepData: data
				})
			});

			await this.handleResponse(response);

			return {
				success: true,
				currentStep: nextStep,
				completedSteps: completedSteps,
				progressPercentage: Math.round((completedSteps.length / 4) * 100)
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to update onboarding progress:', error);
			}
			throw error;
		}
	}

	/**
	 * Complete onboarding process via settings system
	 * @param {string} workspaceId - Selected workspace ID
	 * @returns {Promise<{success: boolean, currentStep: string, isComplete: boolean, progressPercentage: number}>}
	 */
	async completeOnboarding(workspaceId) {
		try {
			const response = await fetch(`${this.baseUrl}/api/settings/onboarding`, {
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify({
					currentStep: 'complete',
					completedSteps: ['auth', 'workspace', 'settings', 'complete'],
					isComplete: true,
					firstWorkspaceId: workspaceId
				})
			});

			await this.handleResponse(response);

			return {
				success: true,
				currentStep: 'complete',
				isComplete: true,
				progressPercentage: 100
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to complete onboarding:', error);
			}
			throw error;
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
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);

			// Return retention policy data or defaults
			return {
				sessionRetentionDays: data.sessionRetentionDays || 30,
				logRetentionDays: data.logRetentionDays || 7,
				autoCleanupEnabled: data.autoCleanupEnabled ?? true,
				updatedAt: data.updatedAt || new Date().toISOString()
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
	 * @param {object} policy - Policy to preview
	 * @param {number} policy.sessionRetentionDays - Session retention period
	 * @param {number} policy.logRetentionDays - Log retention period
	 * @returns {Promise<{summary: string, sessionsToDelete: number, logsToDelete: number, sessionRetentionDays: number, logRetentionDays: number}>}
	 */
	async previewRetentionChanges(policy) {
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

			const response = await fetch(`${this.baseUrl}/api/preferences${params.toString() ? '?' + params : ''}`, {
				headers: this.getHeaders()
			});

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

	// ===== WORKSPACE MANAGEMENT API =====

	/**
	 * Get all workspaces
	 * @returns {Promise<Array>} - Array of workspace objects
	 */
	async getWorkspaces() {
		try {
			const response = await fetch(`${this.baseUrl}/api/workspaces`, {
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);
			return data.workspaces || data || [];
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to get workspaces:', error);
			}
			throw error;
		}
	}

	/**
	 * Create a new workspace
	 * @param {object} workspace - Workspace data
	 * @param {string} workspace.name - Workspace name
	 * @param {string} workspace.path - Workspace path
	 * @returns {Promise<object>} - Created workspace
	 */
	async createWorkspace(workspace) {
		try {
			const response = await fetch(`${this.baseUrl}/api/workspaces`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify(workspace)
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to create workspace:', error);
			}
			throw error;
		}
	}

	/**
	 * Update workspace metadata
	 * @param {string} workspaceId - Workspace ID (path)
	 * @param {object} updates - Updates to apply
	 * @returns {Promise<object>} - Updated workspace
	 */
	async updateWorkspace(workspaceId, updates) {
		try {
			const response = await fetch(
				`${this.baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`,
				{
					method: 'PUT',
					headers: this.getHeaders(),
					body: JSON.stringify(updates)
				}
			);

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to update workspace:', error);
			}
			throw error;
		}
	}

	/**
	 * Delete a workspace
	 * @param {string} workspaceId - Workspace ID (path)
	 * @returns {Promise<{success: boolean}>}
	 */
	async deleteWorkspace(workspaceId) {
		try {
			const response = await fetch(
				`${this.baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`,
				{
					method: 'DELETE',
					headers: this.getHeaders()
				}
			);

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[SessionApiClient] Failed to delete workspace:', error);
			}
			throw error;
		}
	}

	// ===== HELPER METHODS =====

	/**
	 * Get authentication key from localStorage or environment
	 * @returns {string|null} - Auth key
	 */
	getAuthKey() {
		if (typeof localStorage !== 'undefined') {
			return (
				localStorage.getItem(this.config.authTokenKey) || localStorage.getItem('dispatch-auth-key')
			);
		}
		return null;
	}

	/**
	 * Dispose of resources (for cleanup)
	 */
	dispose() {
		// No resources to clean up in this implementation
		// But keeping the method for interface consistency
	}
}
