<script>
	import IconButton from './IconButton.svelte';
	import Button from './Button.svelte';
	import Input from './Input.svelte';
	import IconGitBranch from './Icons/IconGitBranch.svelte';
	import IconGitCommit from './Icons/IconGitCommit.svelte';
	import IconGitPull from './Icons/IconGitPull.svelte';
	import IconGitMerge from './Icons/IconGitMerge.svelte';
	import IconGitFork from './Icons/IconGitFork.svelte';
	import IconArrowDown from './Icons/IconArrowDown.svelte';
	import IconArrowUp from './Icons/IconArrowUp.svelte';
	import IconEye from './Icons/IconEye.svelte';
	import IconCheck from './Icons/IconCheck.svelte';
	import IconX from './Icons/IconX.svelte';
	import IconPlus from './Icons/IconPlus.svelte';
	import IconMinus from './Icons/IconMinus.svelte';

	// Svelte 5 Git Operations Component
	let {
		currentPath,
		onRefresh = null, // callback to refresh directory listing
		onError = null // callback to handle errors
	} = $props();

	// Git status state
	let gitStatus = $state(null);
	let currentBranch = $state('');
	let branches = $state([]);
	let isGitRepo = $state(false);
	let loading = $state(false);
	let error = $state('');

	// UI state
	let showStatus = $state(false);
	let showBranches = $state(false);
	let showCommitForm = $state(false);
	let showLog = $state(false);
	let showDiff = $state(null); // file path to show diff for

	// Form state
	let commitMessage = $state('');
	let selectedFiles = $state(new Set());
	let newBranchName = $state('');
	let targetBranch = $state('');

	// Check if current directory is a git repository
	async function checkGitRepo() {
		if (!currentPath) return;

		loading = true;
		error = '';

		try {
			const res = await fetch(`/api/git/status?path=${encodeURIComponent(currentPath)}`);
			const data = await res.json();

			if (res.ok) {
				isGitRepo = true;
				gitStatus = data.status;
				currentBranch = data.branch;
				await loadBranches();
			} else {
				isGitRepo = false;
				gitStatus = null;
				currentBranch = '';
				branches = [];
			}
		} catch (e) {
			isGitRepo = false;
			error = e.message || 'Failed to check git status';
		} finally {
			loading = false;
		}
	}

	// Load available branches
	async function loadBranches() {
		if (!isGitRepo) return;

		try {
			const res = await fetch(`/api/git/branches?path=${encodeURIComponent(currentPath)}`);
			if (res.ok) {
				const data = await res.json();
				branches = data.branches || [];
			}
		} catch (e) {
			console.error('Failed to load branches:', e);
		}
	}

	// Stage/unstage file
	async function toggleStageFile(filePath, isStaged) {
		loading = true;
		error = '';

		try {
			const action = isStaged ? 'unstage' : 'stage';
			const res = await fetch('/api/git/stage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: currentPath,
					files: [filePath],
					action
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || `Failed to ${action} file`);
			}

			await checkGitRepo();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Commit changes
	async function commitChanges() {
		if (!commitMessage.trim()) {
			error = 'Commit message is required';
			return;
		}

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/git/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: currentPath,
					message: commitMessage.trim()
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to commit changes');
			}

			commitMessage = '';
			showCommitForm = false;
			await checkGitRepo();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Checkout branch
	async function checkoutBranch(branchName) {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/git/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: currentPath,
					branch: branchName
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to checkout branch');
			}

			await checkGitRepo();
			showBranches = false;
			onRefresh?.();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Create new branch
	async function createBranch() {
		if (!newBranchName.trim()) {
			error = 'Branch name is required';
			return;
		}

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/git/branch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: currentPath,
					name: newBranchName.trim(),
					checkout: true
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to create branch');
			}

			newBranchName = '';
			await checkGitRepo();
			showBranches = false;
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Push changes
	async function pushChanges() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/git/push', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: currentPath
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to push changes');
			}

			await checkGitRepo();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Pull changes
	async function pullChanges() {
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/git/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: currentPath
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to pull changes');
			}

			await checkGitRepo();
			onRefresh?.();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Show file diff
	async function showFileDiff(filePath) {
		showDiff = filePath;
	}

	// Check git repo status when currentPath changes
	$effect(() => {
		if (currentPath) {
			checkGitRepo();
		}
	});
</script>

{#if isGitRepo}
	<div class="git-operations">
		<!-- Git toolbar -->
		<div class="git-toolbar">
			<div class="git-info">
				<IconGitBranch size={16} />
				<span class="branch-name">{currentBranch}</span>
				{#if gitStatus?.ahead > 0}
					<span class="ahead">+{gitStatus.ahead}</span>
				{/if}
				{#if gitStatus?.behind > 0}
					<span class="behind">-{gitStatus.behind}</span>
				{/if}
			</div>

			<div class="git-actions">
				<!-- Status toggle -->
				<IconButton
					onclick={() => (showStatus = !showStatus)}
					title="Show git status"
					variant="ghost"
					class="git-status-btn {showStatus ? 'active' : ''}"
				>
					<IconEye size={16} />
				</IconButton>

				<!-- Branches -->
				<IconButton
					onclick={() => (showBranches = !showBranches)}
					title="Switch branch"
					variant="ghost"
					class="git-branches-btn {showBranches ? 'active' : ''}"
				>
					<IconGitBranch size={16} />
				</IconButton>

				<!-- Commit -->
				<IconButton
					onclick={() => (showCommitForm = !showCommitForm)}
					title="Commit changes"
					variant="ghost"
					class="git-commit-btn {showCommitForm ? 'active' : ''}"
					disabled={!gitStatus?.staged?.length}
				>
					<IconGitCommit size={16} />
				</IconButton>

				<!-- Pull -->
				<IconButton onclick={pullChanges} title="Pull changes" variant="ghost" disabled={loading}>
					<IconArrowDown size={16} />
				</IconButton>

				<!-- Push -->
				<IconButton
					onclick={pushChanges}
					title="Push changes"
					variant="ghost"
					disabled={loading || gitStatus?.ahead === 0}
				>
					<IconArrowUp size={16} />
				</IconButton>
			</div>
		</div>

		<!-- Git status panel -->
		{#if showStatus && gitStatus}
			<div class="git-status-panel">
				<h4>Git Status</h4>

				{#if gitStatus.modified?.length}
					<div class="file-group">
						<h5>Modified Files</h5>
						{#each gitStatus.modified as file}
							<div class="file-item">
								<span class="file-name">{file}</span>
								<div class="file-actions">
									<IconButton
										onclick={() => showFileDiff(file)}
										title="View diff"
										variant="ghost"
										size="sm"
									>
										<IconEye size={12} />
									</IconButton>
									<IconButton
										onclick={() => toggleStageFile(file, false)}
										title="Stage file"
										variant="ghost"
										size="sm"
									>
										<IconPlus size={12} />
									</IconButton>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if gitStatus.staged?.length}
					<div class="file-group">
						<h5>Staged Files</h5>
						{#each gitStatus.staged as file}
							<div class="file-item">
								<span class="file-name">{file}</span>
								<div class="file-actions">
									<IconButton
										onclick={() => showFileDiff(file)}
										title="View diff"
										variant="ghost"
										size="sm"
									>
										<IconEye size={12} />
									</IconButton>
									<IconButton
										onclick={() => toggleStageFile(file, true)}
										title="Unstage file"
										variant="ghost"
										size="sm"
									>
										<IconMinus size={12} />
									</IconButton>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if gitStatus.untracked?.length}
					<div class="file-group">
						<h5>Untracked Files</h5>
						{#each gitStatus.untracked as file}
							<div class="file-item">
								<span class="file-name">{file}</span>
								<div class="file-actions">
									<IconButton
										onclick={() => toggleStageFile(file, false)}
										title="Stage file"
										variant="ghost"
										size="sm"
									>
										<IconPlus size={12} />
									</IconButton>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Branches panel -->
		{#if showBranches}
			<div class="git-branches-panel">
				<h4>Branches</h4>

				<div class="branch-actions">
					<Input
						bind:value={newBranchName}
						placeholder="New branch name..."
						type="text"
						class="new-branch-input"
					/>
					<Button onclick={createBranch} disabled={!newBranchName.trim() || loading} size="sm">
						Create
					</Button>
				</div>

				<div class="branch-list">
					{#each branches as branch}
						<div class="branch-item {branch === currentBranch ? 'current' : ''}">
							<span class="branch-name">{branch}</span>
							{#if branch !== currentBranch}
								<IconButton
									onclick={() => checkoutBranch(branch)}
									title="Checkout branch"
									variant="ghost"
									size="sm"
								>
									<IconCheck size={12} />
								</IconButton>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Commit form -->
		{#if showCommitForm}
			<div class="git-commit-panel">
				<h4>Commit Changes</h4>
				<Input
					bind:value={commitMessage}
					placeholder="Enter commit message..."
					type="text"
					class="commit-message-input"
					onkeydown={(e) => e.key === 'Enter' && commitChanges()}
				/>
				<div class="commit-actions">
					<Button onclick={commitChanges} disabled={!commitMessage.trim() || loading}>
						Commit
					</Button>
					<Button onclick={() => (showCommitForm = false)} variant="ghost">Cancel</Button>
				</div>
			</div>
		{/if}

		<!-- File diff modal -->
		{#if showDiff}
			<div class="git-diff-modal" onclick={() => (showDiff = null)}>
				<div class="diff-content" onclick={(e) => e.stopPropagation()}>
					<div class="diff-header">
						<h4>Diff: {showDiff}</h4>
						<IconButton onclick={() => (showDiff = null)} variant="ghost">
							<IconX size={16} />
						</IconButton>
					</div>
					<div class="diff-body">
						<!-- Diff content would be loaded here -->
						<p>File diff display would be implemented here</p>
					</div>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="git-error">
				{error}
			</div>
		{/if}
	</div>
{/if}

<style>
	.git-operations {
		border-top: 1px solid var(--border-color);
		padding-top: 8px;
	}

	.git-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.git-info {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.branch-name {
		font-weight: 500;
		color: var(--text-primary);
	}

	.ahead {
		background: var(--success-bg);
		color: var(--success-text);
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 0.75rem;
	}

	.behind {
		background: var(--warning-bg);
		color: var(--warning-text);
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 0.75rem;
	}

	.git-actions {
		display: flex;
		gap: 4px;
	}

	.git-status-panel,
	.git-branches-panel,
	.git-commit-panel {
		background: var(--surface-2);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 12px;
		margin-bottom: 8px;
	}

	.git-status-panel h4,
	.git-branches-panel h4,
	.git-commit-panel h4 {
		margin: 0 0 12px 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.file-group {
		margin-bottom: 12px;
	}

	.file-group:last-child {
		margin-bottom: 0;
	}

	.file-group h5 {
		margin: 0 0 6px 0;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.file-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		font-size: 0.875rem;
	}

	.file-name {
		color: var(--text-primary);
		font-family: var(--font-mono);
	}

	.file-actions {
		display: flex;
		gap: 2px;
	}

	.branch-actions {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.new-branch-input {
		flex: 1;
	}

	.branch-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.branch-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 0.875rem;
		transition: background-color 0.2s;
	}

	.branch-item:hover {
		background: var(--surface-3);
	}

	.branch-item.current {
		background: var(--primary-bg);
		color: var(--primary-text);
		font-weight: 500;
	}

	.commit-message-input {
		margin-bottom: 12px;
	}

	.commit-actions {
		display: flex;
		gap: 8px;
	}

	.git-diff-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.diff-content {
		background: var(--surface-1);
		border-radius: 8px;
		width: 90%;
		max-width: 800px;
		max-height: 80%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.diff-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid var(--border-color);
	}

	.diff-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.diff-body {
		padding: 16px;
		overflow: auto;
		flex: 1;
	}

	.git-error {
		background: var(--error-bg);
		color: var(--error-text);
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 0.875rem;
		margin-top: 8px;
	}

	:global(.git-status-btn.active),
	:global(.git-branches-btn.active),
	:global(.git-commit-btn.active) {
		background: var(--primary-bg);
		color: var(--primary-text);
	}
</style>
