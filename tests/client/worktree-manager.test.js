import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import WorktreeManager from '../../src/lib/client/shared/components/WorktreeManager.svelte';

// Mock fetch
// @ts-ignore - Test mock doesn't need full fetch signature
global.fetch = vi.fn();

// Helper to access fetch as a vitest mock (for type safety)
// @ts-ignore - Test helper for mock access
const mockFetch = /** @type {import('vitest').Mock} */ (fetch);

// Mock component props
const defaultProps = {
	currentPath: '/test/repo',
	branches: ['main', 'develop', 'feature-branch'],
	onError: vi.fn()
};

describe('WorktreeManager Component', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockFetch.mockClear();
	});

	it('should render worktree manager with empty state', async () => {
		// Mock empty worktree list
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: [] })
		});

		const { getByText, queryByText } = render(WorktreeManager, {
			props: defaultProps
		});

		await waitFor(() => {
			expect(getByText('Worktrees (0)')).toBeInTheDocument();
			expect(getByText('No worktrees found')).toBeInTheDocument();
		});
	});

	it('should display existing worktrees', async () => {
		// Mock worktree list with data
		const mockWorktrees = [
			{ path: '/test/repo', branch: 'main', head: 'abc123' },
			{ path: '/test/repo-feature', branch: 'feature-branch', head: 'def456' }
		];

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: mockWorktrees })
		});

		const { getByText } = render(WorktreeManager, {
			props: defaultProps
		});

		await waitFor(() => {
			expect(getByText('Worktrees (2)')).toBeInTheDocument();
			expect(getByText('/test/repo')).toBeInTheDocument();
			expect(getByText('/test/repo-feature')).toBeInTheDocument();
			expect(getByText('main')).toBeInTheDocument();
			expect(getByText('feature-branch')).toBeInTheDocument();
		});
	});

	it('should show add worktree form when add button is clicked', async () => {
		// Mock empty worktree list
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: [] })
		});

		// Mock init detection
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					detected: [{ description: 'Node.js project detected', commands: ['npm install'] }],
					suggestedCommands: ['npm install'],
					hasInitScript: false
				})
		});

		const { getByTitle, getByText, queryByText } = render(WorktreeManager, {
			props: defaultProps
		});

		await waitFor(() => {
			expect(queryByText('Add New Worktree')).not.toBeInTheDocument();
		});

		// Click add button
		const addButton = getByTitle('Add Worktree');
		await fireEvent.click(addButton);

		await waitFor(() => {
			expect(getByText('Add New Worktree')).toBeInTheDocument();
			expect(getByText('Worktree Path:')).toBeInTheDocument();
			expect(getByText('Create new branch')).toBeInTheDocument();
		});
	});

	it('should detect initialization commands', async () => {
		// Mock empty worktree list
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: [] })
		});

		// Mock init detection with Node.js project
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					detected: [
						{
							description: 'Node.js project detected',
							commands: ['npm install'],
							matched: ['package.json']
						}
					],
					suggestedCommands: ['npm install'],
					hasInitScript: false
				})
		});

		const { getByTitle, getByText } = render(WorktreeManager, {
			props: defaultProps
		});

		// Click add button to trigger initialization detection
		const addButton = getByTitle('Add Worktree');
		await fireEvent.click(addButton);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith('/api/git/worktree/init-detect?path=%2Ftest%2Frepo');
			expect(getByText('Run initialization commands')).toBeInTheDocument();
		});
	});

	it('should handle worktree creation with initialization', async () => {
		// Mock empty worktree list
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: [] })
		});

		// Mock init detection
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					detected: [],
					suggestedCommands: ['npm install'],
					hasInitScript: false
				})
		});

		// Mock successful worktree creation
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					success: true,
					worktreePath: '/test/repo-feature',
					branch: 'feature-branch',
					initResults: []
				})
		});

		// Mock worktree list reload
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: [] })
		});

		const { getByTitle, getByPlaceholderText, getByText } = render(WorktreeManager, {
			props: defaultProps
		});

		// Open add form
		const addButton = getByTitle('Add Worktree');
		await fireEvent.click(addButton);

		await waitFor(() => {
			expect(getByText('Add New Worktree')).toBeInTheDocument();
		});

		// Fill form
		const pathInput = getByPlaceholderText('/path/to/new/worktree');
		await fireEvent.input(pathInput, { target: { value: '/test/repo-feature' } });

		const newBranchCheckbox = getByText('Create new branch').previousElementSibling;
		await fireEvent.click(newBranchCheckbox);

		await waitFor(() => {
			const branchInput = getByPlaceholderText('feature-branch');
			fireEvent.input(branchInput, { target: { value: 'feature-branch' } });
		});

		// Submit form
		const submitButton = getByText('Add Worktree');
		await fireEvent.click(submitButton);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				'/api/git/worktree/add',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						path: '/test/repo',
						worktreePath: '/test/repo-feature',
						newBranch: 'feature-branch',
						runInit: true,
						initCommands: ['npm install']
					})
				})
			);
		});
	});

	it('should handle worktree removal', async () => {
		const mockWorktrees = [
			{ path: '/test/repo-feature', branch: 'feature-branch', head: 'def456' }
		];

		// Mock worktree list
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: mockWorktrees })
		});

		// Mock successful removal
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ success: true })
		});

		// Mock worktree list reload
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ worktrees: [] })
		});

		// Mock window.confirm
		window.confirm = vi.fn(() => true);

		const { getByTitle } = render(WorktreeManager, {
			props: defaultProps
		});

		await waitFor(() => {
			const removeButton = getByTitle('Remove Worktree');
			expect(removeButton).toBeInTheDocument();
		});

		const removeButton = getByTitle('Remove Worktree');
		await fireEvent.click(removeButton);

		await waitFor(() => {
			expect(window.confirm).toHaveBeenCalledWith('Remove worktree at /test/repo-feature?');
			expect(fetch).toHaveBeenCalledWith(
				'/api/git/worktree/remove',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						path: '/test/repo',
						worktreePath: '/test/repo-feature'
					})
				})
			);
		});
	});

	it('should handle API errors gracefully', async () => {
		// Mock failed worktree list
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const mockOnError = vi.fn();

		render(WorktreeManager, {
			props: {
				...defaultProps,
				onError: mockOnError
			}
		});

		await waitFor(() => {
			expect(mockOnError).toHaveBeenCalledWith('Network error');
		});
	});
});
