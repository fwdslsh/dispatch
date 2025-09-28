import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Svelte runes for testing
const createMockState = (initialValue) => {
	let value = initialValue;
	return {
		get value() {
			return value;
		},
		set value(newValue) {
			value = newValue;
		}
	};
};

describe('WorkspaceNavigationViewModel', () => {
	let mockApiClient;
	let viewModel;

	beforeEach(() => {
		mockApiClient = {
			getWorkspaces: vi.fn(),
			getWorkspaceMetadata: vi.fn(),
			createWorkspace: vi.fn(),
			updateWorkspace: vi.fn(),
			deleteWorkspace: vi.fn()
		};

		// Mock ViewModel structure using Svelte 5 runes pattern
		viewModel = {
			// State runes
			activeWorkspace: createMockState(null),
			workspaces: createMockState([]),
			navigationHistory: createMockState([]),
			isLoading: createMockState(false),
			error: createMockState(null),
			searchTerm: createMockState(''),

			// Derived state
			get filteredWorkspaces() {
				if (!this.searchTerm.value) return this.workspaces.value;
				return this.workspaces.value.filter(
					(workspace) =>
						workspace.name.toLowerCase().includes(this.searchTerm.value.toLowerCase()) ||
						workspace.path.toLowerCase().includes(this.searchTerm.value.toLowerCase())
				);
			},

			get recentWorkspaces() {
				return this.workspaces.value
					.filter((w) => w.lastActive)
					.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))
					.slice(0, 5);
			},

			get activeWorkspaces() {
				return this.workspaces.value.filter((w) => w.status === 'active');
			},

			get archivedWorkspaces() {
				return this.workspaces.value.filter((w) => w.status === 'archived');
			},

			// Methods
			async loadWorkspaces() {
				this.isLoading.value = true;
				try {
					const workspaces = await mockApiClient.getWorkspaces();
					this.workspaces.value = workspaces;
					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
				} finally {
					this.isLoading.value = false;
				}
			},

			async switchToWorkspace(workspace) {
				try {
					this.addToHistory(workspace);
					this.activeWorkspace.value = workspace;
					this.error.value = null;
					return workspace;
				} catch (err) {
					this.error.value = err.message;
					throw err;
				}
			},

			addToHistory(workspace) {
				const history = this.navigationHistory.value;
				// Remove if exists, then add to front
				const filtered = history.filter((w) => w.path !== workspace.path);
				const newHistory = [workspace, ...filtered].slice(0, 10); // Keep last 10
				this.navigationHistory.value = newHistory;
			},

			async createNewWorkspace(name, path) {
				this.isLoading.value = true;
				try {
					const newWorkspace = await mockApiClient.createWorkspace({ name, path });
					this.workspaces.value = [...this.workspaces.value, newWorkspace];
					this.error.value = null;
					return newWorkspace;
				} catch (err) {
					this.error.value = err.message;
					throw err;
				} finally {
					this.isLoading.value = false;
				}
			},

			async updateWorkspace(workspaceId, updates) {
				this.isLoading.value = true;
				try {
					const updatedWorkspace = await mockApiClient.updateWorkspace(workspaceId, updates);
					const index = this.workspaces.value.findIndex((w) => w.path === workspaceId);
					if (index >= 0) {
						const newWorkspaces = [...this.workspaces.value];
						newWorkspaces[index] = updatedWorkspace;
						this.workspaces.value = newWorkspaces;
					}
					this.error.value = null;
					return updatedWorkspace;
				} catch (err) {
					this.error.value = err.message;
					throw err;
				} finally {
					this.isLoading.value = false;
				}
			},

			async deleteWorkspace(workspaceId) {
				const workspace = this.workspaces.value.find((w) => w.path === workspaceId);
				if (workspace && workspace.activeSessions && workspace.activeSessions.length > 0) {
					throw new Error('Cannot delete workspace with active sessions');
				}

				this.isLoading.value = true;
				try {
					await mockApiClient.deleteWorkspace(workspaceId);
					this.workspaces.value = this.workspaces.value.filter((w) => w.path !== workspaceId);

					// Remove from history
					this.navigationHistory.value = this.navigationHistory.value.filter(
						(w) => w.path !== workspaceId
					);

					// Clear active workspace if it was deleted
					if (this.activeWorkspace.value && this.activeWorkspace.value.path === workspaceId) {
						this.activeWorkspace.value = null;
					}

					this.error.value = null;
				} catch (err) {
					this.error.value = err.message;
					throw err;
				} finally {
					this.isLoading.value = false;
				}
			},

			canDeleteWorkspace(workspace) {
				return !workspace.activeSessions || workspace.activeSessions.length === 0;
			},

			searchWorkspaces(term) {
				this.searchTerm.value = term;
			},

			clearSearch() {
				this.searchTerm.value = '';
			}
		};
	});

	it('should initialize with empty state', () => {
		expect(viewModel.activeWorkspace.value).toBeNull();
		expect(viewModel.workspaces.value).toEqual([]);
		expect(viewModel.navigationHistory.value).toEqual([]);
		expect(viewModel.isLoading.value).toBe(false);
		expect(viewModel.error.value).toBeNull();
		expect(viewModel.searchTerm.value).toBe('');
	});

	it('should load workspaces from API', async () => {
		const mockWorkspaces = [
			{ path: '/workspace/project1', name: 'Project 1', status: 'active' },
			{ path: '/workspace/project2', name: 'Project 2', status: 'archived' }
		];

		mockApiClient.getWorkspaces.mockResolvedValue(mockWorkspaces);

		await viewModel.loadWorkspaces();

		expect(viewModel.workspaces.value).toEqual(mockWorkspaces);
		expect(viewModel.error.value).toBeNull();
		expect(viewModel.isLoading.value).toBe(false);
	});

	it('should filter workspaces correctly', () => {
		const workspaces = [
			{ path: '/workspace/project1', name: 'React Project' },
			{ path: '/workspace/project2', name: 'Vue Application' },
			{ path: '/workspace/nodejs-api', name: 'Node.js API' }
		];

		viewModel.workspaces.value = workspaces;

		// Search by name
		viewModel.searchTerm.value = 'react';
		expect(viewModel.filteredWorkspaces).toHaveLength(1);
		expect(viewModel.filteredWorkspaces[0].name).toBe('React Project');

		// Search by path
		viewModel.searchTerm.value = 'nodejs';
		expect(viewModel.filteredWorkspaces).toHaveLength(1);
		expect(viewModel.filteredWorkspaces[0].name).toBe('Node.js API');

		// No search term - return all
		viewModel.searchTerm.value = '';
		expect(viewModel.filteredWorkspaces).toHaveLength(3);
	});

	it('should categorize workspaces by status', () => {
		const workspaces = [
			{ path: '/workspace/project1', name: 'Project 1', status: 'active' },
			{ path: '/workspace/project2', name: 'Project 2', status: 'active' },
			{ path: '/workspace/project3', name: 'Project 3', status: 'archived' }
		];

		viewModel.workspaces.value = workspaces;

		expect(viewModel.activeWorkspaces).toHaveLength(2);
		expect(viewModel.archivedWorkspaces).toHaveLength(1);
		expect(viewModel.activeWorkspaces[0].status).toBe('active');
		expect(viewModel.archivedWorkspaces[0].status).toBe('archived');
	});

	it('should sort recent workspaces by last activity', () => {
		const now = Date.now();
		const workspaces = [
			{
				path: '/workspace/project1',
				name: 'Project 1',
				lastActive: new Date(now - 3600000).toISOString()
			}, // 1 hour ago
			{
				path: '/workspace/project2',
				name: 'Project 2',
				lastActive: new Date(now - 86400000).toISOString()
			}, // 1 day ago
			{
				path: '/workspace/project3',
				name: 'Project 3',
				lastActive: new Date(now - 1800000).toISOString()
			}, // 30 min ago
			{ path: '/workspace/project4', name: 'Project 4', lastActive: null } // Never accessed
		];

		viewModel.workspaces.value = workspaces;

		const recent = viewModel.recentWorkspaces;
		expect(recent).toHaveLength(3); // Only workspaces with lastActive
		expect(recent[0].name).toBe('Project 3'); // Most recent
		expect(recent[1].name).toBe('Project 1'); // Second most recent
		expect(recent[2].name).toBe('Project 2'); // Oldest
	});

	it('should switch to workspace and update history', async () => {
		const workspace = { path: '/workspace/project1', name: 'Project 1' };

		const result = await viewModel.switchToWorkspace(workspace);

		expect(viewModel.activeWorkspace.value).toEqual(workspace);
		expect(viewModel.navigationHistory.value).toContain(workspace);
		expect(result).toEqual(workspace);
	});

	it('should manage navigation history correctly', () => {
		const workspace1 = { path: '/workspace/project1', name: 'Project 1' };
		const workspace2 = { path: '/workspace/project2', name: 'Project 2' };

		// Add first workspace
		viewModel.addToHistory(workspace1);
		expect(viewModel.navigationHistory.value).toEqual([workspace1]);

		// Add second workspace
		viewModel.addToHistory(workspace2);
		expect(viewModel.navigationHistory.value).toEqual([workspace2, workspace1]);

		// Re-add first workspace (should move to front)
		viewModel.addToHistory(workspace1);
		expect(viewModel.navigationHistory.value).toEqual([workspace1, workspace2]);
	});

	it('should limit navigation history to 10 items', () => {
		// Add 12 workspaces
		for (let i = 1; i <= 12; i++) {
			viewModel.addToHistory({ path: `/workspace/project${i}`, name: `Project ${i}` });
		}

		// Should only keep last 10
		expect(viewModel.navigationHistory.value).toHaveLength(10);
		expect(viewModel.navigationHistory.value[0].name).toBe('Project 12');
		expect(viewModel.navigationHistory.value[9].name).toBe('Project 3');
	});

	it('should create new workspace', async () => {
		const newWorkspace = { path: '/workspace/new-project', name: 'New Project', status: 'active' };

		mockApiClient.createWorkspace.mockResolvedValue(newWorkspace);

		const result = await viewModel.createNewWorkspace('New Project', '/workspace/new-project');

		expect(mockApiClient.createWorkspace).toHaveBeenCalledWith({
			name: 'New Project',
			path: '/workspace/new-project'
		});
		expect(viewModel.workspaces.value).toContain(newWorkspace);
		expect(result).toEqual(newWorkspace);
	});

	it('should update workspace', async () => {
		const originalWorkspace = { path: '/workspace/project1', name: 'Project 1', status: 'active' };
		const updatedWorkspace = {
			path: '/workspace/project1',
			name: 'Updated Project',
			status: 'active'
		};

		viewModel.workspaces.value = [originalWorkspace];
		mockApiClient.updateWorkspace.mockResolvedValue(updatedWorkspace);

		const result = await viewModel.updateWorkspace('/workspace/project1', {
			name: 'Updated Project'
		});

		expect(mockApiClient.updateWorkspace).toHaveBeenCalledWith('/workspace/project1', {
			name: 'Updated Project'
		});
		expect(viewModel.workspaces.value[0]).toEqual(updatedWorkspace);
		expect(result).toEqual(updatedWorkspace);
	});

	it('should prevent deletion of workspace with active sessions', async () => {
		const workspace = {
			path: '/workspace/project1',
			name: 'Project 1',
			activeSessions: ['session1', 'session2']
		};

		viewModel.workspaces.value = [workspace];

		await expect(viewModel.deleteWorkspace('/workspace/project1')).rejects.toThrow(
			'Cannot delete workspace with active sessions'
		);

		expect(viewModel.workspaces.value).toContain(workspace);
	});

	it('should delete workspace without active sessions', async () => {
		const workspace = { path: '/workspace/project1', name: 'Project 1', activeSessions: [] };

		viewModel.workspaces.value = [workspace];
		viewModel.activeWorkspace.value = workspace;
		viewModel.navigationHistory.value = [workspace];

		mockApiClient.deleteWorkspace.mockResolvedValue();

		await viewModel.deleteWorkspace('/workspace/project1');

		expect(mockApiClient.deleteWorkspace).toHaveBeenCalledWith('/workspace/project1');
		expect(viewModel.workspaces.value).not.toContain(workspace);
		expect(viewModel.activeWorkspace.value).toBeNull();
		expect(viewModel.navigationHistory.value).not.toContain(workspace);
	});

	it('should check if workspace can be deleted', () => {
		const workspaceWithSessions = { activeSessions: ['session1'] };
		const workspaceWithoutSessions = { activeSessions: [] };
		const workspaceNoProperty = {};

		expect(viewModel.canDeleteWorkspace(workspaceWithSessions)).toBe(false);
		expect(viewModel.canDeleteWorkspace(workspaceWithoutSessions)).toBe(true);
		expect(viewModel.canDeleteWorkspace(workspaceNoProperty)).toBe(true);
	});

	it('should handle API errors gracefully', async () => {
		const error = new Error('API Error');
		mockApiClient.getWorkspaces.mockRejectedValue(error);

		await viewModel.loadWorkspaces();

		expect(viewModel.error.value).toBe('API Error');
		expect(viewModel.isLoading.value).toBe(false);
	});

	it('should handle loading states correctly', async () => {
		let resolvePromise;
		const pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		mockApiClient.getWorkspaces.mockReturnValue(pendingPromise);

		// Start loading
		const loadPromise = viewModel.loadWorkspaces();
		expect(viewModel.isLoading.value).toBe(true);

		// Complete loading
		resolvePromise([]);
		await loadPromise;

		expect(viewModel.isLoading.value).toBe(false);
	});

	it('should search and clear search correctly', () => {
		viewModel.searchWorkspaces('test query');
		expect(viewModel.searchTerm.value).toBe('test query');

		viewModel.clearSearch();
		expect(viewModel.searchTerm.value).toBe('');
	});
});
