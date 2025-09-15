/**
 * workspace-state.svelte.js
 *
 * Shared workspace state using Svelte 5 runes.
 * Manages global workspace state across the application.
 */

// Reactive state using $state
export const workspaceState = $state({
	current: null,
	all: [],
	recent: [],
	claudeProjects: [],
	isLoading: false,
	error: null,
	hasLoadedInitial: false
});

// Computed value helpers - create these derived values in your components instead
// Example: const hasWorkspaces = $derived(workspaceState.all.length > 0);
// Available computations:
// - currentWorkspaceName: workspaceState.current?.name || workspaceState.current?.path?.split('/').pop() || 'No workspace'
// - currentWorkspacePath: workspaceState.current?.path || null
// - hasWorkspaces: workspaceState.all.length > 0
// - hasRecentWorkspaces: workspaceState.recent.length > 0
// - hasClaudeProjects: workspaceState.claudeProjects.length > 0
// - isWorkspaceSelected: workspaceState.current !== null
// - totalWorkspaceCount: workspaceState.all.length
// - availableWorkspaces: [...workspaceState.all, ...workspaceState.claudeProjects].filter((workspace, index, self) => index === self.findIndex(w => w.path === workspace.path))
// - workspaceSelectOptions: availableWorkspaces.map(workspace => ({ value: workspace.path, label: workspace.name || workspace.path.split('/').pop(), type: workspace.type || 'regular' }))

// State mutation functions
export function setCurrentWorkspace(workspace) {
	workspaceState.current = workspace;
}

export function setWorkspaces(workspaces) {
	workspaceState.all = workspaces;
}

export function setRecentWorkspaces(recent) {
	workspaceState.recent = recent;
}

export function setClaudeProjects(projects) {
	workspaceState.claudeProjects = projects;
}

export function addWorkspace(workspace) {
	if (!workspaceState.all.find(w => w.path === workspace.path)) {
		workspaceState.all.push(workspace);
	}
}

export function updateWorkspace(path, updates) {
	const workspace = workspaceState.all.find(w => w.path === path);
	if (workspace) {
		Object.assign(workspace, updates);
	}

	// Also update current workspace if it matches
	if (workspaceState.current?.path === path) {
		Object.assign(workspaceState.current, updates);
	}

	// Update in recent list if present
	const recentWorkspace = workspaceState.recent.find(w => w.path === path);
	if (recentWorkspace) {
		Object.assign(recentWorkspace, updates);
	}
}

export function removeWorkspace(path) {
	workspaceState.all = workspaceState.all.filter(w => w.path !== path);
	workspaceState.recent = workspaceState.recent.filter(w => w.path !== path);

	// Clear current workspace if it was removed
	if (workspaceState.current?.path === path) {
		workspaceState.current = null;
	}
}

export function addToRecentWorkspaces(workspace) {
	// Remove if already in recent list
	workspaceState.recent = workspaceState.recent.filter(w => w.path !== workspace.path);

	// Add to beginning
	workspaceState.recent.unshift({
		...workspace,
		lastAccessed: new Date().toISOString()
	});

	// Keep only last 10 recent workspaces
	workspaceState.recent = workspaceState.recent.slice(0, 10);
}

export function clearCurrentWorkspace() {
	workspaceState.current = null;
}

// Loading and error state
export function setWorkspacesLoading(loading) {
	workspaceState.isLoading = loading;
}

export function setWorkspacesError(error) {
	workspaceState.error = error;
}

export function clearWorkspacesError() {
	workspaceState.error = null;
}

export function setHasLoadedInitial(loaded) {
	workspaceState.hasLoadedInitial = loaded;
}

// Workspace operations
export function openWorkspace(path) {
	const workspace = availableWorkspaces.find(w => w.path === path);
	if (workspace) {
		setCurrentWorkspace(workspace);
		addToRecentWorkspaces(workspace);
		return workspace;
	}
	return null;
}

export function createWorkspace(path, name) {
	const workspace = {
		path,
		name: name || path.split('/').pop(),
		type: 'regular',
		createdAt: new Date().toISOString()
	};

	addWorkspace(workspace);
	setCurrentWorkspace(workspace);
	addToRecentWorkspaces(workspace);

	return workspace;
}

export function cloneWorkspace(fromPath, toPath, name) {
	const sourceWorkspace = availableWorkspaces.find(w => w.path === fromPath);
	if (!sourceWorkspace) {
		throw new Error(`Source workspace not found: ${fromPath}`);
	}

	const workspace = {
		path: toPath,
		name: name || toPath.split('/').pop(),
		type: 'regular',
		clonedFrom: fromPath,
		createdAt: new Date().toISOString()
	};

	addWorkspace(workspace);
	setCurrentWorkspace(workspace);
	addToRecentWorkspaces(workspace);

	return workspace;
}

// Utility functions
export function getWorkspaceByPath(path) {
	return availableWorkspaces.find(w => w.path === path);
}

export function isCurrentWorkspace(path) {
	return workspaceState.current?.path === path;
}

export function getWorkspaceType(path) {
	const workspace = getWorkspaceByPath(path);
	return workspace?.type || 'regular';
}

export function isClaudeProject(path) {
	return workspaceState.claudeProjects.some(p => p.path === path);
}

// Bulk operations
export function clearAllWorkspaces() {
	workspaceState.current = null;
	workspaceState.all = [];
	workspaceState.recent = [];
	workspaceState.claudeProjects = [];
}

export function refreshWorkspaces() {
	// This would trigger a reload of workspaces
	// Implementation depends on how the workspace API works
	setWorkspacesLoading(true);
	clearWorkspacesError();
}

// Sorting and filtering
export function sortWorkspacesByName() {
	workspaceState.all = workspaceState.all.sort((a, b) =>
		(a.name || a.path).localeCompare(b.name || b.path)
	);
}

export function sortWorkspacesByLastAccessed() {
	workspaceState.recent = workspaceState.recent.sort((a, b) =>
		new Date(b.lastAccessed || 0) - new Date(a.lastAccessed || 0)
	);
}

export function filterWorkspacesByType(type) {
	return workspaceState.all.filter(w => w.type === type);
}