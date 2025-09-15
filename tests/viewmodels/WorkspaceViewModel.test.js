/**
 * WorkspaceViewModel Unit Tests
 * Tests Svelte 5 MVVM patterns with $state, $derived, and $derived.by
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceViewModel } from '../../src/lib/client/shared/viewmodels/WorkspaceViewModel.svelte.js';

describe('WorkspaceViewModel', () => {
	let mockWorkspaceApi;
	let mockPersistence;
	let mockClaudeApi;
	let viewModel;

	beforeEach(() => {
		// Mock WorkspaceApiClient
		mockWorkspaceApi = {
			list: vi.fn().mockResolvedValue([]),
			create: vi.fn().mockResolvedValue({ path: '/test/workspace', name: 'test' }),
			open: vi.fn().mockResolvedValue({ path: '/test/existing', name: 'existing' }),
			clone: vi.fn().mockResolvedValue({ path: '/test/cloned', name: 'cloned' }),
			exists: vi.fn().mockResolvedValue(true)
		};

		// Mock PersistenceService
		mockPersistence = {
			get: vi.fn().mockReturnValue(null),
			set: vi.fn(),
			remove: vi.fn(),
			getJSON: vi.fn().mockReturnValue([]),
			setJSON: vi.fn()
		};

		// Mock ClaudeApiClient
		mockClaudeApi = {
			getProjects: vi.fn().mockResolvedValue([])
		};

		// Create ViewModel instance
		viewModel = new WorkspaceViewModel(mockWorkspaceApi, mockPersistence);
	});

	afterEach(() => {
		if (viewModel) {
			// Clean up any effects or subscriptions
			viewModel = null;
		}
	});

	describe('Svelte 5 Runes - Initial State', () => {
		it('should initialize with correct $state values', () => {
			expect(viewModel.workspaces).toEqual([]);
			expect(viewModel.recentWorkspaces).toEqual([]);
			expect(viewModel.claudeProjects).toEqual([]);
			expect(viewModel.selectedWorkspace).toBe(null);
			expect(viewModel.loading).toBe(false);
			expect(viewModel.error).toBe(null);
			expect(viewModel.searchQuery).toBe('');
		});

		it('should initialize $derived computed values correctly', () => {
			// Initially no workspaces, so these should be falsy/empty
			expect(viewModel.hasWorkspaces).toBe(false);
			expect(viewModel.isWorkspaceSelected).toBe(false);
			expect(viewModel.workspaceCount).toBe(0);
		});

		it('should initialize $derived.by filtered workspaces', () => {
			// Initially empty, should return empty array
			expect(viewModel.filteredWorkspaces).toEqual([]);
		});
	});

	describe('Svelte 5 Runes - $derived.by Filtering Logic', () => {
		beforeEach(async () => {
			// Set up test workspaces
			const testWorkspaces = [
				{ path: '/home/user/project1', name: 'Project One' },
				{ path: '/home/user/project2', name: 'Project Two' },
				{ path: '/home/user/backend', name: 'Backend API' }
			];

			mockWorkspaceApi.list.mockResolvedValue(testWorkspaces);
			await viewModel.loadWorkspaces();
		});

		it('should return all workspaces when no search query', () => {
			expect(viewModel.searchQuery).toBe('');
			expect(viewModel.filteredWorkspaces).toHaveLength(3);
			expect(viewModel.filteredWorkspaces[0].name).toBe('Project One');
		});

		it('should filter by workspace name (case insensitive)', () => {
			viewModel.searchQuery = 'project';

			// $derived.by should reactively filter
			expect(viewModel.filteredWorkspaces).toHaveLength(2);
			expect(
				viewModel.filteredWorkspaces.every((w) => w.name.toLowerCase().includes('project'))
			).toBe(true);
		});

		it('should filter by workspace path', () => {
			viewModel.searchQuery = 'backend';

			expect(viewModel.filteredWorkspaces).toHaveLength(1);
			expect(viewModel.filteredWorkspaces[0].name).toBe('Backend API');
		});

		it('should handle empty search results', () => {
			viewModel.searchQuery = 'nonexistent';

			expect(viewModel.filteredWorkspaces).toHaveLength(0);
		});
	});

	describe('Svelte 5 Runes - $derived Computed Values', () => {
		it('should update hasWorkspaces when workspaces change', async () => {
			expect(viewModel.hasWorkspaces).toBe(false);

			mockWorkspaceApi.list.mockResolvedValue([{ path: '/test', name: 'test' }]);
			await viewModel.loadWorkspaces();

			expect(viewModel.hasWorkspaces).toBe(true);
		});

		it('should update isWorkspaceSelected when workspace is selected', () => {
			expect(viewModel.isWorkspaceSelected).toBe(false);

			viewModel.selectWorkspace('/test/workspace');

			expect(viewModel.isWorkspaceSelected).toBe(true);
		});

		it('should update workspaceCount reactively', async () => {
			expect(viewModel.workspaceCount).toBe(0);

			mockWorkspaceApi.list.mockResolvedValue([
				{ path: '/test1', name: 'test1' },
				{ path: '/test2', name: 'test2' }
			]);
			await viewModel.loadWorkspaces();

			expect(viewModel.workspaceCount).toBe(2);
		});
	});

	describe('Workspace Operations', () => {
		it('should load workspaces and update reactive state', async () => {
			const mockWorkspaces = [
				{ path: '/workspace1', name: 'Workspace 1' },
				{ path: '/workspace2', name: 'Workspace 2' }
			];
			mockWorkspaceApi.list.mockResolvedValue(mockWorkspaces);

			await viewModel.loadWorkspaces();

			expect(viewModel.workspaces).toEqual(mockWorkspaces);
			expect(viewModel.hasWorkspaces).toBe(true);
			expect(viewModel.workspaceCount).toBe(2);
			expect(viewModel.loading).toBe(false);
			expect(viewModel.error).toBe(null);
		});

		it('should handle loading errors', async () => {
			const error = new Error('Failed to load workspaces');
			mockWorkspaceApi.list.mockRejectedValue(error);

			await viewModel.loadWorkspaces();

			expect(viewModel.error).toBe('Failed to load workspaces');
			expect(viewModel.loading).toBe(false);
			expect(viewModel.workspaces).toEqual([]);
		});

		it('should create new workspace', async () => {
			const newWorkspace = { path: '/new/workspace', name: 'New Workspace' };
			mockWorkspaceApi.create.mockResolvedValue(newWorkspace);
			mockWorkspaceApi.list.mockResolvedValue([newWorkspace]);

			const result = await viewModel.createWorkspace('/new/workspace');

			expect(mockWorkspaceApi.create).toHaveBeenCalledWith('/new/workspace');
			expect(viewModel.selectedWorkspace).toBe('/new/workspace');
			expect(mockPersistence.set).toHaveBeenCalledWith('dispatch-last-workspace', '/new/workspace');
			expect(result).toEqual(newWorkspace);
		});

		it('should clone existing workspace', async () => {
			const clonedWorkspace = { path: '/cloned/workspace', name: 'Cloned' };
			mockWorkspaceApi.clone.mockResolvedValue(clonedWorkspace);
			mockWorkspaceApi.list.mockResolvedValue([clonedWorkspace]);

			const result = await viewModel.cloneWorkspace('/source', '/cloned/workspace');

			expect(mockWorkspaceApi.clone).toHaveBeenCalledWith('/source', '/cloned/workspace');
			expect(viewModel.selectedWorkspace).toBe('/cloned/workspace');
			expect(result).toEqual(clonedWorkspace);
		});
	});

	describe('Recent Workspaces Management', () => {
		it('should load recent workspaces from persistence', () => {
			const recentWorkspaces = ['/recent1', '/recent2'];
			mockPersistence.getJSON.mockReturnValue(recentWorkspaces);

			viewModel.loadRecentWorkspaces();

			expect(viewModel.recentWorkspaces).toEqual(recentWorkspaces);
		});

		it('should add workspace to recent list', () => {
			const initialRecent = ['/old1', '/old2'];
			mockPersistence.getJSON.mockReturnValue(initialRecent);
			viewModel.loadRecentWorkspaces();

			viewModel.addToRecent('/new/workspace');

			expect(viewModel.recentWorkspaces).toContain('/new/workspace');
			expect(mockPersistence.setJSON).toHaveBeenCalledWith(
				'dispatch-recent-workspaces',
				expect.arrayContaining(['/new/workspace'])
			);
		});

		it('should limit recent workspaces to 5 items', () => {
			const manyRecent = ['/1', '/2', '/3', '/4', '/5'];
			mockPersistence.getJSON.mockReturnValue(manyRecent);
			viewModel.loadRecentWorkspaces();

			viewModel.addToRecent('/new');

			expect(viewModel.recentWorkspaces).toHaveLength(5);
			expect(viewModel.recentWorkspaces[0]).toBe('/new');
			expect(viewModel.recentWorkspaces).not.toContain('/5');
		});
	});

	describe('Claude Projects Integration', () => {
		it('should load Claude projects', async () => {
			const mockProjects = [
				{ name: 'claude-project-1', path: '/claude/p1' },
				{ name: 'claude-project-2', path: '/claude/p2' }
			];
			mockClaudeApi.getProjects.mockResolvedValue(mockProjects);

			await viewModel.loadClaudeProjects();

			expect(viewModel.claudeProjects).toEqual(mockProjects);
			expect(mockClaudeApi.getProjects).toHaveBeenCalled();
		});

		it('should handle Claude projects loading error', async () => {
			mockClaudeApi.getProjects.mockRejectedValue(new Error('Claude API error'));

			await viewModel.loadClaudeProjects();

			expect(viewModel.claudeProjects).toEqual([]);
			// Should not throw, just log error internally
		});
	});

	describe('Search and Selection State', () => {
		it('should update search query and trigger filtering', () => {
			expect(viewModel.searchQuery).toBe('');

			viewModel.searchQuery = 'test query';

			expect(viewModel.searchQuery).toBe('test query');
			// The $derived.by should automatically recompute filteredWorkspaces
		});

		it('should select and persist workspace', () => {
			viewModel.selectWorkspace('/selected/workspace');

			expect(viewModel.selectedWorkspace).toBe('/selected/workspace');
			expect(viewModel.isWorkspaceSelected).toBe(true);
			expect(mockPersistence.set).toHaveBeenCalledWith(
				'dispatch-last-workspace',
				'/selected/workspace'
			);
		});

		it('should check if workspace exists', async () => {
			mockWorkspaceApi.exists.mockResolvedValue(true);

			const exists = await viewModel.workspaceExists('/test/path');

			expect(exists).toBe(true);
			expect(mockWorkspaceApi.exists).toHaveBeenCalledWith('/test/path');
		});
	});

	describe('Error Handling', () => {
		it('should handle create workspace errors', async () => {
			mockWorkspaceApi.create.mockRejectedValue(new Error('Creation failed'));

			await expect(viewModel.createWorkspace('/fail')).rejects.toThrow('Creation failed');
			expect(viewModel.error).toBe('Creation failed');
			expect(viewModel.loading).toBe(false);
		});

		it('should handle clone workspace errors', async () => {
			mockWorkspaceApi.clone.mockRejectedValue(new Error('Clone failed'));

			await expect(viewModel.cloneWorkspace('/src', '/dest')).rejects.toThrow('Clone failed');
			expect(viewModel.error).toBe('Clone failed');
			expect(viewModel.loading).toBe(false);
		});

		it('should clear previous errors on successful operations', async () => {
			// Set initial error
			viewModel.error = 'Previous error';

			mockWorkspaceApi.list.mockResolvedValue([]);
			await viewModel.loadWorkspaces();

			expect(viewModel.error).toBe(null);
		});
	});

	describe('Reactive State Integration', () => {
		it('should maintain reactivity across multiple operations', async () => {
			// Test that all reactive properties work together
			expect(viewModel.hasWorkspaces).toBe(false);
			expect(viewModel.isWorkspaceSelected).toBe(false);

			// Load workspaces
			mockWorkspaceApi.list.mockResolvedValue([{ path: '/ws1', name: 'Workspace 1' }]);
			await viewModel.loadWorkspaces();

			expect(viewModel.hasWorkspaces).toBe(true);
			expect(viewModel.workspaceCount).toBe(1);

			// Select workspace
			viewModel.selectWorkspace('/ws1');
			expect(viewModel.isWorkspaceSelected).toBe(true);

			// Filter workspaces
			viewModel.searchQuery = 'workspace';
			expect(viewModel.filteredWorkspaces).toHaveLength(1);

			// Clear search
			viewModel.searchQuery = '';
			expect(viewModel.filteredWorkspaces).toHaveLength(1);
		});
	});
});
