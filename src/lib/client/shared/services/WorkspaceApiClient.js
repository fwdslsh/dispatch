/**
 * WorkspaceApiClient.js
 *
 * API client for workspace-related operations.
 * Encapsulates all HTTP requests for workspace management.
 * Maintains backward compatibility with existing API contracts.
 */

/**
 * @typedef {Object} Workspace
 * @property {string} path - Absolute path to workspace directory
 * @property {string} name - Workspace name
 * @property {string} lastAccessed - ISO string of last access time
 */

/**
 * @typedef {Object} WorkspaceConfig
 * @property {string} apiBaseUrl - Base URL for API requests
 * @property {string} authTokenKey - Key for auth token in localStorage
 * @property {boolean} debug - Enable debug logging
 */

export class WorkspaceApiClient {
	/**
	 * @param {WorkspaceConfig} config
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

			const error = /** @type {Error & {status?: number, statusText?: string}} */ (
				new Error(errorMessage)
			);
			error.status = response.status;
			error.statusText = response.statusText;
			throw error;
		}

		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			return response.json();
		}

		return response.text();
	}

	/**
	 * List all workspaces
	 * @returns {Promise<Workspace[]>}
	 */
	async list() {
		try {
			const response = await fetch(`${this.baseUrl}/api/workspaces`, {
				headers: this.getHeaders()
			});

			const data = await this.handleResponse(response);
			return data.list || [];
		} catch (error) {
			if (this.config.debug) {
				console.error('[WorkspaceApiClient] Failed to list workspaces:', error);
			}
			throw error;
		}
	}

	/**
	 * Open an existing workspace
	 * @param {string} path - Workspace path (absolute or relative)
	 * @returns {Promise<{path: string}>}
	 */
	async open(path) {
		try {
			const response = await fetch(`${this.baseUrl}/api/workspaces`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					action: 'open',
					path
				})
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[WorkspaceApiClient] Failed to open workspace:', error);
			}
			throw error;
		}
	}

	/**
	 * Create a new workspace
	 * @param {string} path - Workspace path (absolute or relative)
	 * @param {boolean} isNewProject - Whether this is a new project
	 * @returns {Promise<{path: string}>}
	 */
	async create(path, isNewProject = false) {
		try {
			const response = await fetch(`${this.baseUrl}/api/workspaces`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					action: 'create',
					path,
					isNewProject
				})
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[WorkspaceApiClient] Failed to create workspace:', error);
			}
			throw error;
		}
	}

	/**
	 * Clone an existing workspace
	 * @param {string} from - Source workspace path
	 * @param {string} to - Destination workspace path
	 * @returns {Promise<{path: string}>}
	 */
	async clone(from, to) {
		try {
			const response = await fetch(`${this.baseUrl}/api/workspaces`, {
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					action: 'clone',
					from,
					to
				})
			});

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[WorkspaceApiClient] Failed to clone workspace:', error);
			}
			throw error;
		}
	}

	/**
	 * Open or create a workspace (convenience method)
	 * @param {string} path - Workspace path
	 * @returns {Promise<{path: string}>}
	 */
	async openOrCreate(path) {
		try {
			// Try to open first
			return await this.open(path);
		} catch (error) {
			if (error.status === 404) {
				// Workspace doesn't exist, create it
				return await this.create(path);
			}
			throw error;
		}
	}

	/**
	 * Validate a workspace path
	 * @param {string} path - Path to validate
	 * @returns {boolean}
	 */
	validatePath(path) {
		if (!path || typeof path !== 'string') {
			return false;
		}

		// Check for path traversal attempts
		if (path.includes('..')) {
			return false;
		}

		// Check for valid characters (basic validation)
		const validPathRegex = /^[a-zA-Z0-9\-_/.]+$/;
		return validPathRegex.test(path);
	}

	/**
	 * Get Claude projects (if available)
	 * @returns {Promise<Array>}
	 */
	async getClaudeProjects() {
		try {
			const response = await fetch(`${this.baseUrl}/api/claude/projects`, {
				headers: this.getHeaders()
			});

			if (response.status === 404) {
				// Claude projects endpoint might not exist
				return [];
			}

			const data = await this.handleResponse(response);
			return data.projects || [];
		} catch (error) {
			if (this.config.debug) {
				console.error('[WorkspaceApiClient] Failed to get Claude projects:', error);
			}
			// Don't throw for Claude projects, just return empty
			return [];
		}
	}

	/**
	 * Dispose of resources (for cleanup)
	 */
	dispose() {
		// No resources to clean up in this implementation
		// But keeping the method for interface consistency
	}
}
