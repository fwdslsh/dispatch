<script>
	import Button from './Button.svelte';
	import Input from './Input.svelte';
	import IconButton from './IconButton.svelte';
	import IconGitWorktree from './Icons/IconGitWorktree.svelte';
	import IconPlus from './Icons/IconPlus.svelte';
	import IconX from './Icons/IconX.svelte';
	import IconCheck from './Icons/IconCheck.svelte';
	import IconGitBranch from './Icons/IconGitBranch.svelte';
	import { getAuthHeaders } from '$lib/shared/api-helpers.js';

	// Svelte 5 Worktree Manager Component
	let { currentPath, branches = [], onError = null } = $props();

	// Worktree state
	let worktrees = $state([]);
	let loading = $state(false);
	let error = $state('');

	// UI state
	let showAddForm = $state(false);
	let showInitCommands = $state(false);

	// Form state
	let newWorktreePath = $state('');
	let selectedBranch = $state('');
	let newBranchName = $state('');
	let createNewBranch = $state(false);
	let runInitialization = $state(true);

	// Initialization state
	let detectedInit = $state(null);
	let initCommands = $state([]);
	let saveInitScript = $state(false);

	// Load worktrees
	async function loadWorktrees() {
		if (!currentPath) return;

		loading = true;
		error = '';

		try {
			const res = await fetch(`/api/git/worktree/list?path=${encodeURIComponent(currentPath)}`, {
				headers: getAuthHeaders()
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to load worktrees');
			}

			const data = await res.json();
			worktrees = data.worktrees || [];
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Detect initialization commands
	async function detectInitialization() {
		if (!currentPath) return;

		try {
			const res = await fetch(
				`/api/git/worktree/init-detect?path=${encodeURIComponent(currentPath)}`,
				{
					headers: getAuthHeaders()
				}
			);

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to detect initialization');
			}

			const data = await res.json();
			detectedInit = data;
			initCommands = [...data.suggestedCommands];
		} catch (e) {
			console.warn('Failed to detect initialization:', e.message);
			detectedInit = { detected: [], suggestedCommands: [] };
			initCommands = [];
		}
	}

	// Add new worktree
	async function addWorktree() {
		if (!newWorktreePath.trim()) {
			error = 'Worktree path is required';
			return;
		}

		if (!createNewBranch && !selectedBranch) {
			error = 'Please select a branch or create a new one';
			return;
		}

		loading = true;
		error = '';

		try {
			const payload = {
				path: currentPath,
				worktreePath: newWorktreePath.trim(),
				runInit: runInitialization,
				initCommands: runInitialization ? initCommands : []
			};

			if (createNewBranch) {
				payload.newBranch = newBranchName.trim();
			} else {
				payload.branch = selectedBranch;
			}

			const res = await fetch('/api/git/worktree/add', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to add worktree');
			}

			const data = await res.json();

			// Save initialization script if requested
			if (saveInitScript && initCommands.length > 0) {
				await saveInitializationScript();
			}

			// Reset form
			newWorktreePath = '';
			selectedBranch = '';
			newBranchName = '';
			createNewBranch = false;
			showAddForm = false;
			showInitCommands = false;

			// Reload worktrees
			await loadWorktrees();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Save initialization script
	async function saveInitializationScript() {
		try {
			const res = await fetch('/api/git/worktree/init-detect', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					path: currentPath,
					commands: initCommands
				})
			});

			if (!res.ok) {
				throw new Error('Failed to save .dispatchrc');
			}
		} catch (e) {
			console.warn('Failed to save .dispatchrc:', e.message);
		}
	}

	// Remove worktree
	async function removeWorktree(worktreePath) {
		if (!confirm(`Remove worktree at ${worktreePath}?`)) return;

		loading = true;
		error = '';

		try {
			const res = await fetch('/api/git/worktree/remove', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					path: currentPath,
					worktreePath
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to remove worktree');
			}

			await loadWorktrees();
		} catch (e) {
			error = e.message;
			onError?.(error);
		} finally {
			loading = false;
		}
	}

	// Show add form
	async function showAddWorktreeForm() {
		showAddForm = true;
		await detectInitialization();
	}

	// Add new command to init commands
	function addInitCommand() {
		initCommands = [...initCommands, ''];
	}

	// Remove command from init commands
	function removeInitCommand(index) {
		initCommands = initCommands.filter((_, i) => i !== index);
	}

	// Update command at index
	function updateInitCommand(index, value) {
		initCommands[index] = value;
	}

	// Load worktrees when currentPath changes
	$effect(() => {
		if (currentPath) {
			loadWorktrees();
		}
	});
</script>

<div class="worktree-manager">
	<div class="worktree-header">
		<div class="flex gap-2 items-center">
			<IconGitWorktree />
			<span class="font-medium">Worktrees ({worktrees.length})</span>
		</div>
		<IconButton
			type="button"
			title="Add Worktree"
			size="sm"
			variant="primary"
			onclick={showAddWorktreeForm}
			disabled={loading}
		>
			<IconPlus size={16} />
		</IconButton>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if worktrees.length > 0}
		<div class="worktree-list">
			{#each worktrees as worktree}
				<div class="worktree-item">
					<div class="worktree-info">
						<div class="worktree-path">{worktree.path}</div>
						<div class="worktree-branch">
							<IconGitBranch />
							{worktree.branch || 'detached HEAD'}
						</div>
					</div>
					<IconButton
						title="Remove Worktree"
						size="sm"
						variant="danger"
						onclick={() => removeWorktree(worktree.path)}
						disabled={loading}
					>
						<IconX size={16} />
					</IconButton>
				</div>
			{/each}
		</div>
	{:else if !loading}
		<div class="empty-state">No worktrees found</div>
	{/if}

	{#if showAddForm}
		<div class="add-form">
			<div class="form-section">
				<h4>Add New Worktree</h4>

				<div class="form-row">
					<label>Worktree Path:</label>
					<Input bind:value={newWorktreePath} placeholder="/path/to/new/worktree" fullWidth />
				</div>

				<div class="form-row">
					<label>
						<input type="checkbox" bind:checked={createNewBranch} />
						Create new branch
					</label>
				</div>

				{#if createNewBranch}
					<div class="form-row">
						<label>New Branch Name:</label>
						<Input bind:value={newBranchName} placeholder="feature-branch" fullWidth />
					</div>
				{:else if branches.length > 0}
					<div class="form-row">
						<label>Select Branch:</label>
						<select bind:value={selectedBranch} class="branch-select">
							<option value="">Choose a branch...</option>
							{#each branches as branch}
								<option value={branch}>{branch}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if detectedInit && (detectedInit.detected.length > 0 || detectedInit.hasDispatchrc)}
					<div class="form-row">
						<label>
							<input type="checkbox" bind:checked={runInitialization} />
							Run initialization commands
						</label>
						{#if runInitialization}
							<Button
								variant="secondary"
								size="sm"
								onclick={() => (showInitCommands = !showInitCommands)}
							>
								{showInitCommands ? 'Hide' : 'Show'} Commands ({initCommands.length})
							</Button>
						{/if}
					</div>

					{#if runInitialization && showInitCommands}
						<div class="init-commands">
							<h5>Initialization Commands</h5>

							{#if detectedInit.detected.length > 0}
								<div class="detected-info">
									<p>Detected:</p>
									<ul>
										{#each detectedInit.detected as pattern}
											<li>{pattern.description}</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if detectedInit.hasDispatchrc}
								<div class="existing-script">
									<p>Found existing script: {detectedInit.existingScript.path}</p>
								</div>
							{/if}

							<div class="command-list">
								{#each initCommands as command, index}
									<div class="command-row">
										<Input
											value={command}
											placeholder="Enter command..."
											fullWidth
											onchange={(e) => updateInitCommand(index, e.target.value)}
										/>
										<IconButton
											title="Remove Command"
											size="sm"
											variant="danger"
											onclick={() => removeInitCommand(index)}
										>
											<IconX size={16} />
										</IconButton>
									</div>
								{/each}
								<Button variant="secondary" size="sm" onclick={addInitCommand}>Add Command</Button>
							</div>

							<div class="form-row">
								<label>
									<input type="checkbox" bind:checked={saveInitScript} />
									Save as .dispatchrc initialization script
								</label>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<div class="form-actions">
				<Button
					variant="secondary"
					onclick={() => {
						showAddForm = false;
						showInitCommands = false;
					}}
				>
					Cancel
				</Button>
				<Button variant="primary" onclick={addWorktree} disabled={loading}>
					{loading ? 'Adding...' : 'Add Worktree'}
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	.worktree-manager {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 12px;
		margin-top: 8px;
	}

	.worktree-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.worktree-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.worktree-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: var(--surface-color);
		border-radius: var(--radius-xs);
		border: 1px solid var(--border-color);
	}

	.worktree-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.worktree-path {
		font-family: monospace;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.worktree-branch {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.875rem;
		padding: 20px;
	}

	.add-form {
		border-top: 1px solid var(--border-color);
		margin-top: 12px;
		padding-top: 12px;
	}

	.form-section h4 {
		margin: 0 0 12px 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.form-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 12px;
	}

	.form-row label {
		font-size: 0.875rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.branch-select {
		padding: 8px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-xs);
		background: var(--surface-color);
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.init-commands {
		background: var(--surface-color);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-xs);
		padding: 12px;
		margin-top: 8px;
	}

	.init-commands h5 {
		margin: 0 0 8px 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.detected-info,
	.existing-script {
		margin-bottom: 12px;
		font-size: 0.875rem;
	}

	.detected-info ul {
		margin: 4px 0 0 16px;
		color: var(--text-secondary);
	}

	.command-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.command-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
	}

	.error-msg {
		background: var(--error-bg);
		color: var(--error-text);
		padding: 8px 12px;
		border-radius: var(--radius-xs);
		font-size: 0.875rem;
		margin-bottom: 8px;
	}
</style>
