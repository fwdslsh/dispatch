/**
 * SessionApiClient - API client for session operations
 *
 * Handles all session-related HTTP requests with proper error handling,
 * loading states, and reactive data management using Svelte 5 runes.
 */

export class SessionApiClient {
	#loading = $state(false);
	#error = $state(null);

	constructor() {
		console.log('[SessionApiClient] Initialized');
	}

	/**
	 * Loading state (reactive)
	 */
	get loading() {
		return this.#loading;
	}

	/**
	 * Error state (reactive)
	 */
	get error() {
		return this.#error;
	}

	/**
	 * Clear error state
	 */
	clearError() {
		this.#error = null;
	}

	/**
	 * List all sessions with optional filtering
	 * @param {Object} options - Query options
	 * @param {string} options.workspace - Filter by workspace path
	 * @param {boolean} options.includeAll - Include unpinned sessions
	 * @returns {Promise<Array>} Array of session objects
	 */
	async listSessions(workspace, includeAll = false ) {
		return this.#withErrorHandling(async () => {
			const url = new URL('/api/sessions', window.location.origin);

			if (workspace) {
				url.searchParams.set('workspace', workspace);
			}
			if (includeAll) {
				url.searchParams.set('include', 'all');
			}

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to load sessions: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			return data.sessions || [];
		});
	}

	/**
	 * Create a new session
	 * @param {Object} sessionConfig - Session configuration
	 * @param {string} sessionConfig.type - Session type ('pty' or 'claude')
	 * @param {string} sessionConfig.workspacePath - Workspace path
	 * @param {Object} sessionConfig.options - Session-specific options
	 * @returns {Promise<Object>} Created session data
	 */
	async createSession({ type, workspacePath, options = {} }) {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					type,
					workspacePath,
					options
				})
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				throw new Error(`Failed to create session: ${response.status} ${response.statusText} ${errorText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Update a session (rename, pin/unpin, etc.)
	 * @param {Object} updateConfig - Update configuration
	 * @param {string} updateConfig.action - Action to perform
	 * @param {string} updateConfig.sessionId - Session ID
	 * @param {string} updateConfig.workspacePath - Workspace path
	 * @param {Object} updateConfig.data - Additional update data
	 * @returns {Promise<Object>} Update result
	 */
	async updateSession({ action, sessionId, workspacePath, ...data }) {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/sessions', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action,
					sessionId,
					workspacePath,
					...data
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `Failed to update session: ${response.statusText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Pin a session to workspace
	 * @param {string} sessionId - Session ID
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Object>} Update result
	 */
	async pinSession(sessionId, workspacePath) {
		return this.updateSession({
			action: 'pin',
			sessionId,
			workspacePath
		});
	}

	/**
	 * Unpin a session from workspace
	 * @param {string} sessionId - Session ID
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Object>} Update result
	 */
	async unpinSession(sessionId, workspacePath) {
		return this.updateSession({
			action: 'unpin',
			sessionId,
			workspacePath
		});
	}

	/**
	 * Rename a session
	 * @param {string} sessionId - Session ID
	 * @param {string} workspacePath - Workspace path
	 * @param {string} newName - New session name
	 * @returns {Promise<Object>} Update result
	 */
	async renameSession(sessionId, workspacePath, newName) {
		return this.updateSession({
			action: 'rename',
			sessionId,
			workspacePath,
			name: newName
		});
	}

	/**
	 * Terminate a session
	 * @param {string} sessionId - Session ID
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<void>}
	 */
	async terminateSession(sessionId, workspacePath) {
		return this.#withErrorHandling(async () => {
			const url = new URL('/api/sessions', window.location.origin);
			url.searchParams.set('sessionId', sessionId);
			url.searchParams.set('workspacePath', workspacePath);

			const response = await fetch(url, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error(`Failed to terminate session: ${response.status} ${response.statusText}`);
			}
		});
	}

	/**
	 * Get session history
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<Array>} Session history entries
	 */
	async getSessionHistory(sessionId) {
		return this.#withErrorHandling(async () => {
			const response = await fetch(`/api/sessions/${sessionId}/history`);

			if (!response.ok) {
				throw new Error(`Failed to load session history: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			return data.history || [];
		});
	}

	/**
	 * Create a terminal session
	 * @param {string} workspacePath - Workspace path
	 * @param {Object} options - Terminal options
	 * @returns {Promise<Object>} Created session data
	 */
	async createTerminalSession(workspacePath, options = {}) {
		return this.createSession({
			type: 'pty',
			workspacePath,
			options: {
				resumeSession: false,
				...options
			}
		});
	}

	/**
	 * Resume a terminal session
	 * @param {string} workspacePath - Workspace path
	 * @param {string} terminalId - Terminal ID to resume
	 * @returns {Promise<Object>} Resumed session data
	 */
	async resumeTerminalSession(workspacePath, terminalId) {
		return this.createSession({
			type: 'pty',
			workspacePath,
			options: {
				resumeSession: true,
				terminalId
			}
		});
	}

	/**
	 * Create a Claude session
	 * @param {Object} claudeConfig - Claude session configuration
	 * @param {string} claudeConfig.workspacePath - Workspace path
	 * @param {string} claudeConfig.sessionId - Claude session ID (optional)
	 * @param {string} claudeConfig.projectName - Project name
	 * @param {boolean} claudeConfig.resumeSession - Whether to resume existing session
	 * @returns {Promise<Object>} Created session data
	 */
	async createClaudeSession({
		workspacePath,
		sessionId,
		projectName,
		resumeSession = false
	}) {
		return this.createSession({
			type: 'claude',
			workspacePath,
			options: {
				sessionId,
				projectName,
				resumeSession
			}
		});
	}

	/**
	 * Generic error handling wrapper
	 * @param {Function} operation - Async operation to execute
	 */
	async #withErrorHandling(operation) {
		try {
			this.#loading = true;
			this.#error = null;

			const result = await operation();
			return result;
		} catch (error) {
			console.error('[SessionApiClient] Operation failed:', error);
			this.#error = error.message || 'Unknown error occurred';
			throw error;
		} finally {
			this.#loading = false;
		}
	}

	/**
	 * Dispose of the client and cleanup resources
	 */
	dispose() {
		this.#loading = false;
		this.#error = null;
		console.log('[SessionApiClient] Disposed');
	}
}