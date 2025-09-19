/**
 * WorkspaceState.svelte.js
 *
 * Focused workspace state management using Svelte 5 runes.
 * Single responsibility: managing workspace data and selection.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('workspace-state');

export class WorkspaceState {
	constructor() {
		// Core workspace data
		this.workspaces = $state([]);
		this.selectedWorkspace = $state(null);
		this.loading = $state(false);
		this.error = $state(null);

		// Derived state
		this.hasWorkspaces = $derived(this.workspaces.length > 0);
		this.claudeProjects = $derived.by(() => this.workspaces.filter((w) => w.isClaudeProject));
	}

	// Workspace operations
	loadWorkspaces(workspaces) {
		this.workspaces = workspaces;
		this.loading = false;
		this.error = null;
		log.info('Workspaces loaded', { count: workspaces.length });
	}

	selectWorkspace(workspacePath) {
		this.selectedWorkspace = workspacePath;
		log.info('Workspace selected', workspacePath);
	}

	addWorkspace(workspace) {
		if (!this.workspaces.find((w) => w.path === workspace.path)) {
			this.workspaces.push(workspace);
		}
	}

	updateWorkspace(path, updates) {
		const index = this.workspaces.findIndex((w) => w.path === path);
		if (index >= 0) {
			this.workspaces[index] = { ...this.workspaces[index], ...updates };
		}
	}

	removeWorkspace(path) {
		this.workspaces = this.workspaces.filter((w) => w.path !== path);
		if (this.selectedWorkspace === path) {
			this.selectedWorkspace = null;
		}
	}

	// Query methods
	getWorkspace(path) {
		return this.workspaces.find((w) => w.path === path) || null;
	}

	// Loading and error state
	setLoading(loading) {
		this.loading = loading;
	}

	setError(error) {
		this.error = error;
	}

	clearError() {
		this.error = null;
	}
}
