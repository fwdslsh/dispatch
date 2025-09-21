import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import GitOperations from '$lib/client/shared/components/GitOperations.svelte';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('GitOperations Component', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should render nothing when not in a git repository', async () => {
		// Mock API call to return non-git repo error
		fetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: async () => ({ error: 'Not a git repository' })
		});

		const { container } = render(GitOperations, {
			props: {
				currentPath: '/some/path'
			}
		});

		await waitFor(() => {
			expect(container.firstChild).toBe(null);
		});
	});

	it('should render git operations when in a git repository', async () => {
		// Mock successful git status API call
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: ['file1.js'],
					staged: ['file2.js'],
					untracked: ['file3.js'],
					ahead: 2,
					behind: 0
				},
				isGitRepo: true
			})
		});

		// Mock branches API call
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branches: ['main', 'develop', 'feature/test']
			})
		});

		const { getByText, getByTitle } = render(GitOperations, {
			props: {
				currentPath: '/git/repo/path'
			}
		});

		await waitFor(() => {
			expect(getByText('main')).toBeTruthy();
			expect(getByText('+2')).toBeTruthy(); // ahead count
			expect(getByTitle('Show git status')).toBeTruthy();
			expect(getByTitle('Switch branch')).toBeTruthy();
			expect(getByTitle('Commit changes')).toBeTruthy();
		});
	});

	it('should show git status panel when status button is clicked', async () => {
		// Setup mocks
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: ['file1.js'],
					staged: ['file2.js'],
					untracked: ['file3.js'],
					ahead: 0,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ branches: ['main'] })
		});

		const { getByTitle, getByText } = render(GitOperations, {
			props: {
				currentPath: '/git/repo/path'
			}
		});

		await waitFor(() => {
			expect(getByTitle('Show git status')).toBeTruthy();
		});

		// Click the status button
		const statusButton = getByTitle('Show git status');
		await fireEvent.click(statusButton);

		await waitFor(() => {
			expect(getByText('Git Status')).toBeTruthy();
			expect(getByText('Modified Files')).toBeTruthy();
			expect(getByText('Staged Files')).toBeTruthy();
			expect(getByText('Untracked Files')).toBeTruthy();
			expect(getByText('file1.js')).toBeTruthy();
			expect(getByText('file2.js')).toBeTruthy();
			expect(getByText('file3.js')).toBeTruthy();
		});
	});

	it('should allow staging files', async () => {
		// Setup initial mocks
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: ['file1.js'],
					staged: [],
					untracked: [],
					ahead: 0,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ branches: ['main'] })
		});

		const { getByTitle, getByText } = render(GitOperations, {
			props: {
				currentPath: '/git/repo/path'
			}
		});

		await waitFor(() => {
			expect(getByTitle('Show git status')).toBeTruthy();
		});

		// Show status panel
		const statusButton = getByTitle('Show git status');
		await fireEvent.click(statusButton);

		await waitFor(() => {
			expect(getByText('file1.js')).toBeTruthy();
		});

		// Mock stage API call
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true, action: 'stage', files: ['file1.js'] })
		});

		// Mock updated status after staging
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: [],
					staged: ['file1.js'],
					untracked: [],
					ahead: 0,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ branches: ['main'] })
		});

		// Find and click stage button for file1.js
		const stageButtons = getByTitle('Stage file');
		await fireEvent.click(stageButtons);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith('/api/git/stage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: '/git/repo/path',
					files: ['file1.js'],
					action: 'stage'
				})
			});
		});
	});

	it('should allow committing changes', async () => {
		// Setup mocks
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: [],
					staged: ['file1.js'],
					untracked: [],
					ahead: 0,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ branches: ['main'] })
		});

		const { getByTitle, getByText, getByPlaceholderText } = render(GitOperations, {
			props: {
				currentPath: '/git/repo/path'
			}
		});

		await waitFor(() => {
			expect(getByTitle('Commit changes')).toBeTruthy();
		});

		// Click commit button
		const commitButton = getByTitle('Commit changes');
		await fireEvent.click(commitButton);

		await waitFor(() => {
			expect(getByText('Commit Changes')).toBeTruthy();
			expect(getByPlaceholderText('Enter commit message...')).toBeTruthy();
		});

		// Enter commit message
		const messageInput = getByPlaceholderText('Enter commit message...');
		await fireEvent.input(messageInput, { target: { value: 'Test commit message' } });

		// Mock commit API call
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true, message: 'Commit successful' })
		});

		// Mock updated status after commit
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: [],
					staged: [],
					untracked: [],
					ahead: 1,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ branches: ['main'] })
		});

		// Click commit button
		const confirmCommitButton = getByText('Commit');
		await fireEvent.click(confirmCommitButton);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith('/api/git/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: '/git/repo/path',
					message: 'Test commit message'
				})
			});
		});
	});

	it('should allow switching branches', async () => {
		// Setup mocks
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'main',
				status: {
					modified: [],
					staged: [],
					untracked: [],
					ahead: 0,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branches: ['main', 'develop', 'feature/test']
			})
		});

		const { getByTitle, getByText } = render(GitOperations, {
			props: {
				currentPath: '/git/repo/path'
			}
		});

		await waitFor(() => {
			expect(getByTitle('Switch branch')).toBeTruthy();
		});

		// Click branches button
		const branchesButton = getByTitle('Switch branch');
		await fireEvent.click(branchesButton);

		await waitFor(() => {
			expect(getByText('Branches')).toBeTruthy();
			expect(getByText('main')).toBeTruthy();
			expect(getByText('develop')).toBeTruthy();
			expect(getByText('feature/test')).toBeTruthy();
		});

		// Mock checkout API call
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true, branch: 'develop' })
		});

		// Mock updated status after checkout
		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branch: 'develop',
				status: {
					modified: [],
					staged: [],
					untracked: [],
					ahead: 0,
					behind: 0
				},
				isGitRepo: true
			})
		});

		fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				branches: ['main', 'develop', 'feature/test']
			})
		});

		// Find checkout button for develop branch and click it
		const developCheckoutButton = getByTitle('Checkout branch');
		await fireEvent.click(developCheckoutButton);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith('/api/git/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: '/git/repo/path',
					branch: 'develop'
				})
			});
		});
	});

	it('should handle API errors gracefully', async () => {
		// Mock failed API call
		fetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({ error: 'Git command failed' })
		});

		const mockOnError = vi.fn();

		const { container } = render(GitOperations, {
			props: {
				currentPath: '/git/repo/path',
				onError: mockOnError
			}
		});

		await waitFor(() => {
			expect(mockOnError).toHaveBeenCalledWith('Git command failed');
		});
	});
});
