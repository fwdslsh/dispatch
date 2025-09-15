/**
 * WorkspaceViewModel.svelte.js
 *
 * ViewModel for workspace management using Svelte 5 runes.
 * Handles all workspace-related state and business logic.
 */

/**
 * @typedef {Object} Workspace
 * @property {string} path
 * @property {string} name
 * @property {string} lastAccessed
 */

export class WorkspaceViewModel {
	/**
	 * @param {import('../services/WorkspaceApiClient.js').WorkspaceApiClient} workspaceApi
	 * @param {import('../services/PersistenceService.js').PersistenceService} persistence
	 */
	constructor(workspaceApi, persistence) {
		this.workspaceApi = workspaceApi;
		this.persistence = persistence;

		// Observable state using Svelte 5 runes
		this.workspaces = $state([]);
		this.selectedWorkspace = $state(null);
		this.loading = $state(false);
		this.error = $state(null);

		// Workspace history
		this.recentWorkspaces = $state([]);

		// Claude projects
		this.claudeProjects = $state([]);

		// Derived state
		this.hasWorkspaces = $derived(this.workspaces.length > 0);
		this.isWorkspaceSelected = $derived(this.selectedWorkspace !== null);
		this.workspaceCount = $derived(this.workspaces.length);

		// Search/filter state
		this.searchQuery = $state('');
		this.filteredWorkspaces = $derived.by(() => {
			if (!this.searchQuery) {
				return this.workspaces;
			}

			const query = this.searchQuery.toLowerCase();
			return this.workspaces.filter(w => {
				const name = (w.name || '').toLowerCase();
				const path = (w.path || '').toLowerCase();
				return name.includes(query) || path.includes(query);
			});
		});

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize the view model
	 */
	async initialize() {
		await this.loadWorkspaces();
		this.loadRecentWorkspaces();
		await this.loadClaudeProjects();

		// Restore selected workspace from persistence
		const lastWorkspace = this.persistence.get('dispatch-last-workspace');
		if (lastWorkspace) {
			this.selectWorkspace(lastWorkspace);
		}
	}

	/**
	 * Load all workspaces
	 */
	async loadWorkspaces() {
		this.loading = true;
		this.error = null;

		try {
			this.workspaces = await this.workspaceApi.list();
			this.sortWorkspaces();
		} catch (error) {
			this.error = error.message || 'Failed to load workspaces';
			console.error('[WorkspaceViewModel] Load error:', error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load Claude projects
	 */
	async loadClaudeProjects() {
		try {
			this.claudeProjects = await this.workspaceApi.getClaudeProjects();
		} catch (error) {
			// Don't show error for Claude projects as they're optional
			console.debug('[WorkspaceViewModel] Claude projects not available:', error);
		}
	}

	/**
	 * Load recent workspaces from persistence
	 */
	loadRecentWorkspaces() {
		const recent = this.persistence.get('dispatch-workspace-history', []);
		this.recentWorkspaces = recent.slice(0, 10); // Keep only last 10
	}

	/**
	 * Save recent workspaces to persistence
	 */
	saveRecentWorkspaces() {
		this.persistence.set('dispatch-workspace-history', this.recentWorkspaces);
	}

	/**
	 * Open an existing workspace
	 * @param {string} path
	 */
	async openWorkspace(path) {
		this.loading = true;
		this.error = null;

		try {
			const result = await this.workspaceApi.open(path);

			// Select the opened workspace
			this.selectWorkspace(result.path);

			// Add to recent workspaces
			this.addToRecent(result.path);

			// Reload workspace list
			await this.loadWorkspaces();

			return result;
		} catch (error) {
			this.error = error.message || 'Failed to open workspace';
			throw error;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Create a new workspace
	 * @param {string} path
	 * @param {boolean} isNewProject
	 */
	async createWorkspace(path, isNewProject = false) {
		this.loading = true;
		this.error = null;

		try {
			const result = await this.workspaceApi.create(path, isNewProject);

			// Select the created workspace
			this.selectWorkspace(result.path);

			// Add to recent workspaces
			this.addToRecent(result.path);

			// Reload workspace list
			await this.loadWorkspaces();

			return result;
		} catch (error) {
			this.error = error.message || 'Failed to create workspace';
			throw error;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Clone an existing workspace
	 * @param {string} from
	 * @param {string} to
	 */
	async cloneWorkspace(from, to) {
		this.loading = true;
		this.error = null;

		try {
			const result = await this.workspaceApi.clone(from, to);

			// Select the cloned workspace
			this.selectWorkspace(result.path);

			// Add to recent workspaces
			this.addToRecent(result.path);

			// Reload workspace list
			await this.loadWorkspaces();

			return result;
		} catch (error) {
			this.error = error.message || 'Failed to clone workspace';
			throw error;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Select a workspace
	 * @param {string} path
	 */
	selectWorkspace(path) {
		const workspace = this.workspaces.find(w => w.path === path);

		if (workspace) {
			this.selectedWorkspace = workspace;
			this.persistence.set('dispatch-last-workspace', path);
			this.addToRecent(path);
		} else {
			// If not in list, try to open it
			this.openWorkspace(path);
		}
	}

	/**
	 * Clear workspace selection
	 */
	clearSelection() {
		this.selectedWorkspace = null;
		this.persistence.remove('dispatch-last-workspace');
	}

	/**
	 * Add workspace to recent list
	 * @param {string} path
	 */
	addToRecent(path) {
		// Remove if already exists
		this.recentWorkspaces = this.recentWorkspaces.filter(w => w !== path);

		// Add to beginning
		this.recentWorkspaces.unshift(path);

		// Keep only last 10
		if (this.recentWorkspaces.length > 10) {
			this.recentWorkspaces = this.recentWorkspaces.slice(0, 10);
		}

		this.saveRecentWorkspaces();
	}

	/**
	 * Remove from recent workspaces
	 * @param {string} path
	 */
	removeFromRecent(path) {
		this.recentWorkspaces = this.recentWorkspaces.filter(w => w !== path);
		this.saveRecentWorkspaces();
	}

	/**
	 * Clear recent workspaces
	 */
	clearRecent() {
		this.recentWorkspaces = [];
		this.saveRecentWorkspaces();
	}

	/**
	 * Sort workspaces by last accessed
	 */
	sortWorkspaces() {
		this.workspaces.sort((a, b) => {
			const dateA = new Date(a.lastAccessed || 0);
			const dateB = new Date(b.lastAccessed || 0);
			return dateB - dateA;
		});
	}


	/**
	 * Check if a workspace exists
	 * @param {string} path
	 * @returns {boolean}
	 */
	hasWorkspace(path) {
		return this.workspaces.some(w => w.path === path);
	}

	/**
	 * Get workspace by path
	 * @param {string} path
	 * @returns {Workspace|null}
	 */
	getWorkspace(path) {
		return this.workspaces.find(w => w.path === path) || null;
	}

	/**
	 * Validate workspace path
	 * @param {string} path
	 * @returns {boolean}
	 */
	validatePath(path) {
		return this.workspaceApi.validatePath(path);
	}

	/**
	 * Refresh workspace list
	 */
	async refresh() {
		await this.loadWorkspaces();
		await this.loadClaudeProjects();
	}

	/**
	 * Reset all state
	 */
	reset() {
		this.workspaces = [];
		this.selectedWorkspace = null;
		this.loading = false;
		this.error = null;
		this.searchQuery = '';
		this.claudeProjects = [];
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			workspaces: this.workspaces.length,
			selected: this.selectedWorkspace?.path,
			loading: this.loading,
			error: this.error,
			recent: this.recentWorkspaces.length,
			claudeProjects: this.claudeProjects.length
		};
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.reset();
	}
}