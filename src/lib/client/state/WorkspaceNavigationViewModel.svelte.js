/**
 * WorkspaceNavigationViewModel - Manages workspace navigation and management
 * Uses Svelte 5 runes for reactive state management
 * Integrates with existing workspace API and session management
 */

export class WorkspaceNavigationViewModel {
	// State runes for reactive data
	activeWorkspace = $state(null);
	workspaces = $state([]);
	navigationHistory = $state([]);
	isLoading = $state(false);
	error = $state(null);
	searchTerm = $state('');

	// Injected dependencies
	#apiClient;

	constructor(apiClient) {
		this.#apiClient = apiClient;
	}

	// Derived state - computed properties
	get filteredWorkspaces() {
		if (!this.searchTerm) return this.workspaces;
		return this.workspaces.filter(
			(workspace) =>
				workspace.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
				workspace.path.toLowerCase().includes(this.searchTerm.toLowerCase())
		);
	}

	get recentWorkspaces() {
		return this.workspaces
			.filter((w) => w.lastActive)
			.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))
			.slice(0, 5);
	}

	get activeWorkspaces() {
		return this.workspaces.filter((w) => w.status === 'active');
	}

	get archivedWorkspaces() {
		return this.workspaces.filter((w) => w.status === 'archived');
	}

	// Methods for workspace management

	/**
	 * Load all workspaces from server
	 */
	async loadWorkspaces() {
		this.isLoading = true;
		try {
			const workspaces = await this.#apiClient.getWorkspaces();
			this.workspaces = workspaces;
			this.error = null;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Switch to a specific workspace
	 * @param {object} workspace - Workspace to switch to
	 * @returns {object} The workspace that was switched to
	 */
	async switchToWorkspace(workspace) {
		try {
			this.addToHistory(workspace);
			this.activeWorkspace = workspace;
			this.error = null;
			return workspace;
		} catch (err) {
			this.error = err.message;
			throw err;
		}
	}

	/**
	 * Add workspace to navigation history
	 * @param {object} workspace - Workspace to add
	 */
	addToHistory(workspace) {
		const history = this.navigationHistory;
		// Remove if exists, then add to front
		const filtered = history.filter((w) => w.path !== workspace.path);
		const newHistory = [workspace, ...filtered].slice(0, 10); // Keep last 10
		this.navigationHistory = newHistory;
	}

	/**
	 * Create a new workspace
	 * @param {string} name - Workspace name
	 * @param {string} path - Workspace path
	 * @returns {object} Created workspace
	 */
	async createNewWorkspace(name, path) {
		this.isLoading = true;
		try {
			const newWorkspace = await this.#apiClient.createWorkspace({ name, path });
			this.workspaces = [...this.workspaces, newWorkspace];
			this.error = null;
			return newWorkspace;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Update workspace metadata
	 * @param {string} workspaceId - Workspace ID (path)
	 * @param {object} updates - Updates to apply
	 * @returns {object} Updated workspace
	 */
	async updateWorkspace(workspaceId, updates) {
		this.isLoading = true;
		try {
			const updatedWorkspace = await this.#apiClient.updateWorkspace(workspaceId, updates);
			const index = this.workspaces.findIndex((w) => w.path === workspaceId);
			if (index >= 0) {
				const newWorkspaces = [...this.workspaces];
				newWorkspaces[index] = updatedWorkspace;
				this.workspaces = newWorkspaces;
			}
			this.error = null;
			return updatedWorkspace;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Delete a workspace
	 * @param {string} workspaceId - Workspace ID (path)
	 */
	async deleteWorkspace(workspaceId) {
		const workspace = this.workspaces.find((w) => w.path === workspaceId);
		if (workspace && workspace.activeSessions && workspace.activeSessions.length > 0) {
			throw new Error('Cannot delete workspace with active sessions');
		}

		this.isLoading = true;
		try {
			await this.#apiClient.deleteWorkspace(workspaceId);
			this.workspaces = this.workspaces.filter((w) => w.path !== workspaceId);

			// Remove from history
			this.navigationHistory = this.navigationHistory.filter((w) => w.path !== workspaceId);

			// Clear active workspace if it was deleted
			if (this.activeWorkspace && this.activeWorkspace.path === workspaceId) {
				this.activeWorkspace = null;
			}

			this.error = null;
		} catch (err) {
			this.error = err.message;
			throw err;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Check if workspace can be deleted
	 * @param {object} workspace - Workspace to check
	 * @returns {boolean} Whether workspace can be deleted
	 */
	canDeleteWorkspace(workspace) {
		return !workspace.activeSessions || workspace.activeSessions.length === 0;
	}

	/**
	 * Search workspaces by term
	 * @param {string} term - Search term
	 */
	searchWorkspaces(term) {
		this.searchTerm = term;
	}

	/**
	 * Clear search filter
	 */
	clearSearch() {
		this.searchTerm = '';
	}
}
