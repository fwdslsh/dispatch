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
				let data = null;
				try {
					data = await res.json();
				} catch (jsonError) {
					console.warn('Failed to parse git status response', jsonError);
				}

				if (res.ok) {
					isGitRepo = true;
					gitStatus = data?.status || null;
					currentBranch = data?.branch || '';
					await loadBranches();
				} else {
					const message = data?.error || 'Failed to load git status';
					isGitRepo = false;
					gitStatus = null;
					currentBranch = '';
					branches = [];
					error = message;
					onError?.(message);
				}
		} catch (e) {
			isGitRepo = false;
				error = e.message || 'Failed to check git status';
				onError?.(error);
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
				const list = Array.isArray(data?.branches) ? data.branches : [];
				console.log('loadBranches assigned', list);
				branches = [...list];
			}
		} catch (e) {
			console.error('Failed to load branches:', e);
		}
	}

	async function toggleBranchesPanel() {
		const nextState = !showBranches;
		showBranches = nextState;
		if (nextState) {
			await loadBranches();
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
		<div class="flex-between gap-2" style="margin-bottom: 8px;">
			<div class="git-info flex gap-2" style="font-size: 0.875rem;">
				<IconGitBranch size={16} />
				<span class="branch-name">{currentBranch}</span>
				{#if gitStatus?.ahead > 0}
					<span class="ahead">+{gitStatus.ahead}</span>
				{/if}
				{#if gitStatus?.behind > 0}
					<span class="behind">-{gitStatus.behind}</span>
				{/if}
			</div>

			<div class="flex gap-1">
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
					onclick={toggleBranchesPanel}
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
			<div class="git-panel p-3">
				<h4 class="panel-title">Git Status</h4>

				{#if gitStatus.modified?.length}
					<div class="file-group">
						<h5 class="file-group-title">Modified Files</h5>
						{#each gitStatus.modified as file}
							<div class="file-item flex-between">
								<span class="file-name">{file}</span>
								<div class="flex gap-1">
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
						<h5 class="file-group-title">Staged Files</h5>
						{#each gitStatus.staged as file}
							<div class="file-item flex-between">
								<span class="file-name">{file}</span>
								<div class="flex gap-1">
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
						<h5 class="file-group-title">Untracked Files</h5>
						{#each gitStatus.untracked as file}
							<div class="file-item flex-between">
								<span class="file-name">{file}</span>
								<div class="flex gap-1">
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
			<div class="git-panel p-3">
				<h4 class="panel-title">Branches</h4>

				<div class="flex gap-2" style="margin-bottom: 12px;">
					<Input
						bind:value={newBranchName}
						placeholder="New branch name..."
						type="text"
						style="flex: 1;"
					/>
					<Button onclick={createBranch} disabled={!newBranchName.trim() || loading} size="sm">
						Create
					</Button>
				</div>

				<div class="flex-col gap-1">
					{#each branches as branch}
						<div class="branch-item {branch === currentBranch ? 'current' : ''} flex-between">
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
			<div class="git-panel p-3">
				<h4 class="panel-title">Commit Changes</h4>
				<Input
					bind:value={commitMessage}
					placeholder="Enter commit message..."
					type="text"
					onkeydown={(e) => e.key === 'Enter' && commitChanges()}
					style="margin-bottom: 12px;"
				/>
				<div class="flex gap-2">
					<Button onclick={commitChanges} disabled={!commitMessage.trim() || loading}>
						Commit
					</Button>
					<Button onclick={() => (showCommitForm = false)} variant="ghost">Cancel</Button>
				</div>
			</div>
		{/if}

		<!-- File diff modal -->
		{#if showDiff}
			<div
				class="git-diff-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="diff-title"
				onclick={() => (showDiff = null)}
				onkeydown={(e) => e.key === 'Escape' && (showDiff = null)}
			>
				<div
					class="diff-content"
					role="document"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<div class="diff-header">
						<h4 id="diff-title">Diff: {showDiff}</h4>
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

	.git-info {
		color: var(--text-secondary);
		align-items: center;
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

	.git-panel {
		background: var(--surface-2);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		margin-bottom: 8px;
	}

	.panel-title {
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

	.file-group-title {
		margin: 0 0 6px 0;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.file-item {
		padding: 4px 0;
		font-size: 0.875rem;
		align-items: center;
	}

	.file-name {
		color: var(--text-primary);
		font-family: var(--font-mono);
	}

	.branch-item {
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 0.875rem;
		transition: background-color 0.2s;
		align-items: center;
	}

	.branch-item:hover {
		background: var(--surface-3);
	}

	.branch-item.current {
		background: var(--primary-bg);
		color: var(--primary-text);
		font-weight: 500;
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
