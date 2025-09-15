/**
 * WorkspaceApiClient - API client for workspace operations
 *
 * Handles all workspace-related HTTP requests with proper error handling,
 * loading states, and reactive data management using Svelte 5 runes.
 */

export class WorkspaceApiClient {
	#loading = $state(false);
	#error = $state(null);

	constructor() {
		console.log('[WorkspaceApiClient] Initialized');
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
	 * List all available workspaces
	 * @returns {Promise<Array>} Array of workspace objects
	 */
	async listWorkspaces() {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/workspaces');
			if (!response.ok) {
				throw new Error(`Failed to load workspaces: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			return data.list || [];
		});
	}

	/**
	 * Open an existing workspace
	 * @param {string} path - Workspace path
	 * @returns {Promise<Object>} Workspace data
	 */
	async openWorkspace(path) {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'open',
					path
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `Failed to open workspace: ${response.statusText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Create a new workspace
	 * @param {string} path - Workspace path/name
	 * @param {boolean} isNewProject - Whether this is a new project
	 * @returns {Promise<Object>} Created workspace data
	 */
	async createWorkspace(path, isNewProject = false) {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'create',
					path,
					isNewProject
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `Failed to create workspace: ${response.statusText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Clone an existing workspace
	 * @param {string} fromPath - Source workspace path
	 * @param {string} toPath - Destination workspace path
	 * @returns {Promise<Object>} Cloned workspace data
	 */
	async cloneWorkspace(fromPath, toPath) {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'clone',
					fromPath,
					toPath
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `Failed to clone workspace: ${response.statusText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Ensure workspace exists (open if exists, create if not)
	 * @param {string} path - Workspace path
	 * @param {boolean} createWorkspace - Whether to create if it doesn't exist
	 * @returns {Promise<Object>} Workspace data
	 */
	async ensureWorkspace(path, createWorkspace = false) {
		return this.#withErrorHandling(async () => {
			const action = createWorkspace ? 'create' : 'open';
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action,
					path,
					isNewProject: createWorkspace
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `Failed to ensure workspace: ${response.statusText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Browse directory structure
	 * @param {string} path - Directory path to browse
	 * @returns {Promise<Object>} Directory contents
	 */
	async browseDirectory(path = '') {
		return this.#withErrorHandling(async () => {
			const url = new URL('/api/browse', window.location.origin);
			if (path) {
				url.searchParams.set('path', path);
			}

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to browse directory: ${response.status} ${response.statusText}`);
			}

			return await response.json();
		});
	}

	/**
	 * Create a new directory
	 * @param {string} path - Directory path to create
	 * @returns {Promise<Object>} Creation result
	 */
	async createDirectory(path) {
		return this.#withErrorHandling(async () => {
			const response = await fetch('/api/browse/create', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ path, type: 'directory' })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				throw new Error(errorData?.error || `Failed to create directory: ${response.statusText}`);
			}

			return await response.json();
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
			console.error('[WorkspaceApiClient] Operation failed:', error);
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
		console.log('[WorkspaceApiClient] Disposed');
	}
}