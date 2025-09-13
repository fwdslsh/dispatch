<script>
	import { Modal, Button } from '$lib/shared/components';
	import ClaudeProjectPicker from './ClaudeProjectPicker.svelte';
	import DirectoryBrowser from './DirectoryBrowser.svelte';

	let { open = $bindable(false), onSessionCreate, initialType = 'claude' } = $props();

	// Form state
	let sessionType = $state('claude'); // 'claude' | 'terminal'
	let projectName = $state('');
	let selectedDirectory = $state(null);
	let selectedClaudeProject = $state(null);
	let creating = $state(false);
	let state = $state('idle'); // idle | creating | error | success
	let errorMessage = $state('');
	let workspaceCreated = $state(false);
	let sessionCreated = $state(false);
	let mode = $state('new'); // 'new' | 'existing'

	async function handleCreate() {
		creating = true;
		state = 'creating';
		errorMessage = '';
		workspaceCreated = false;
		sessionCreated = false;
		try {
			if (sessionType === 'claude') {
				if (mode === 'new') {
					// New Claude project
					if (!projectName.trim()) return;
					await onSessionCreate?.({
						type: 'claude',
						workspacePath: projectName.trim(),
						sessionId: null,
						projectName: projectName.trim(),
						resumeSession: false,
						createWorkspace: true
					});
					workspaceCreated = true; // backend handles create+open
					sessionCreated = true;
				} else {
					// Existing Claude project or directory
					if (selectedClaudeProject) {
						await onSessionCreate?.({
							type: 'claude',
							workspacePath: selectedClaudeProject.path,
							sessionId: null,
							projectName: selectedClaudeProject.name,
							resumeSession: false,
							createWorkspace: false
						});
						workspaceCreated = true;
						sessionCreated = true;
					} else if (selectedDirectory) {
						const dirName = selectedDirectory.split('/').pop() || 'project';
						await onSessionCreate?.({
							type: 'claude',
							workspacePath: selectedDirectory,
							sessionId: null,
							projectName: dirName,
							resumeSession: false,
							createWorkspace: false
						});
						workspaceCreated = true;
						sessionCreated = true;
					}
				}
			} else {
				// Terminal session
				if (!selectedDirectory) return;
				await onSessionCreate?.({
					type: 'terminal',
					workspacePath: selectedDirectory
				});
				workspaceCreated = true;
				sessionCreated = true;
			}
			state = 'success';
			handleClose();
		} catch (error) {
			console.error('Failed to create session:', error);
			state = 'error';
			errorMessage = error?.message || String(error);
		} finally {
			creating = false;
		}
	}

	function handleClose() {
		// Reset form
		sessionType = 'claude';
		projectName = '';
		selectedDirectory = null;
		selectedClaudeProject = null;
		mode = 'new';
		state = 'idle';
		errorMessage = '';
		workspaceCreated = false;
		sessionCreated = false;
		open = false;
	}

	// Allow parent to seed initial session type when opening
	$effect(() => {
		if (open) {
			sessionType = initialType === 'terminal' ? 'terminal' : 'claude';
			// when terminal selected, ensure mode is 'existing'
			if (sessionType === 'terminal') {
				mode = 'existing';
				projectName = '';
				selectedClaudeProject = null;
			}
		}
	});

	const canCreate = $derived(
		sessionType === 'terminal'
			? selectedDirectory !== null
			: mode === 'new'
				? projectName.trim().length > 0
				: selectedClaudeProject !== null || selectedDirectory !== null
	);

	const createButtonText = $derived(creating ? 'Creating...' : 'Create Session');
</script>

<Modal bind:open title="Create New Session" onclose={handleClose} size="large" augmented="tl-clip tr-clip bl-clip br-clip both">
	{#snippet children()}
		<div class="session-form" data-testid="session-form">
			{#if state === 'error'}
				<div class="error-banner" role="alert">{errorMessage}</div>
			{/if}
			{#if state === 'creating'}
				<div class="creating-indicator">
					<div class="step-list">
						<div class={workspaceCreated ? 'done' : 'active'}>Creating/opening workspace...</div>
						<div class={sessionCreated ? 'done' : workspaceCreated ? 'active' : ''}>
							Starting session...
						</div>
					</div>
				</div>
			{/if}
			<!-- Session Type Selector -->
			<div class="type-selector">
				<button
					type="button"
					class="type-btn {sessionType === 'claude' ? 'active' : ''}"
					onclick={() => {
						sessionType = 'claude';
						selectedDirectory = null;
					}}
				>
					<span class="icon">🤖</span>
					<span class="label">Claude Session</span>
				</button>
				<button
					type="button"
					class="type-btn {sessionType === 'terminal' ? 'active' : ''}"
					onclick={() => {
						sessionType = 'terminal';
						mode = 'existing';
						projectName = '';
						selectedClaudeProject = null;
					}}
				>
					<span class="icon">💻</span>
					<span class="label">Terminal Session</span>
				</button>
			</div>

			<div class="form-content">
				{#if sessionType === 'claude'}
					<!-- Claude Session Options -->
					<div class="mode-tabs">
						<button
							type="button"
							class="mode-tab {mode === 'new' ? 'active' : ''}"
							onclick={() => {
								mode = 'new';
								selectedClaudeProject = null;
								selectedDirectory = null;
							}}
						>
							New Project
						</button>
						<button
							type="button"
							class="mode-tab {mode === 'existing' ? 'active' : ''}"
							onclick={() => {
								mode = 'existing';
								projectName = '';
							}}
						>
							Existing Project
						</button>
					</div>

					{#if mode === 'new'}
						<div class="form-group">
							<label for="project-name">Project Name</label>
							<input
								id="project-name"
								type="text"
								bind:value={projectName}
								placeholder="my-awesome-project"
								disabled={creating}
								class="input"
							/>
							<div class="hint">Create a new Claude project workspace</div>
						</div>
					{:else}
						<div class="form-group">
							<label>Choose Project Source</label>
							<div class="source-options">
								<div class="source-option">
									<label class="sub-label">Claude Projects</label>
									<ClaudeProjectPicker
										bind:selected={selectedClaudeProject}
										onSelect={() => (selectedDirectory = null)}
										api="/api/claude/projects"
									/>
								</div>
								<div class="divider">OR</div>
								<div class="source-option">
									<label class="sub-label">Browse Directory</label>
									<DirectoryBrowser
										bind:selected={selectedDirectory}
										onSelect={() => (selectedClaudeProject = null)}
										api="/api/browse"
										startPath=""
										placeholder="Select a directory from workspaces..."
									/>
								</div>
							</div>
						</div>
					{/if}
				{:else}
					<!-- Terminal Session Options -->
					<div class="form-group">
						<label>Select Working Directory</label>
						<DirectoryBrowser
							bind:selected={selectedDirectory}
							api="/api/browse"
							startPath=""
							placeholder="Navigate to your working directory..."
						/>
						<div class="hint">Choose the directory where the terminal will start</div>
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet footer()}
		<Button
			variant="ghost"
			augmented="none"
			onclick={handleClose}
			disabled={creating}
		>
			Cancel
		</Button>
		<Button
			variant="primary"
			augmented="tl-clip br-clip both"
			onclick={handleCreate}
			disabled={!canCreate || creating}
		>
			{createButtonText}
		</Button>
	{/snippet}
</Modal>

<style>
	.session-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		font-family: var(--font-sans);
	}

	.error-banner {
		background: rgba(255, 65, 65, 0.1);
		border: 1px solid rgba(255, 65, 65, 0.3);
		color: #ff6565;
		padding: var(--space-3);
		border-radius: 6px;
	}

	.creating-indicator {
		background: var(--bg-dark);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		padding: var(--space-3);
	}

	.step-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.step-list .active {
		color: var(--text);
	}

	.step-list .done {
		color: var(--primary);
	}

	.type-selector {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-dark);
		border-radius: 8px;
		border: 1px solid var(--primary-dim);
	}

	.type-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-3);
		background: var(--surface);
		border: 2px solid var(--surface-border);
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.type-btn:hover {
		background: var(--surface-hover);
		border-color: var(--primary-dim);
		color: var(--text);
	}

	.type-btn.active {
		background: var(--primary);
		border-color: var(--primary);
		color: var(--bg);
		box-shadow: 0 0 12px rgba(46, 230, 107, 0.3);
	}

	.type-btn .icon {
		font-size: 2rem;
	}

	.type-btn .label {
		font-weight: 600;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.form-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.mode-tabs {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-1);
		background: var(--bg-dark);
		border-radius: 6px;
		border: 1px solid var(--surface-border);
	}

	.mode-tab {
		flex: 1;
		padding: var(--space-3) var(--space-4);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.mode-tab:hover {
		background: var(--surface);
		color: var(--text);
	}

	.mode-tab.active {
		background: var(--surface);
		border-color: var(--primary-dim);
		color: var(--primary);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	label {
		font-weight: 600;
		color: var(--text);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sub-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--space-2);
		display: block;
	}

	.input {
		padding: var(--space-3) var(--space-4);
		background: var(--bg-dark);
		border: 1px solid var(--surface-border);
		border-radius: 6px;
		color: var(--text);
		font-size: 0.9rem;
		font-family: var(--font-mono);
		transition: border-color 0.2s ease;
	}

	.input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}

	.input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.source-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--bg-dark);
		border-radius: 6px;
		border: 1px solid var(--surface-border);
	}

	.source-option {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.divider {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		position: relative;
		margin: var(--space-2) 0;
	}

	.divider::before,
	.divider::after {
		content: '';
		position: absolute;
		top: 50%;
		width: calc(50% - 2rem);
		height: 1px;
		background: var(--surface-border);
	}

	.divider::before {
		left: 0;
	}

	.divider::after {
		right: 0;
	}


	/* Responsive adjustments */
	@media (max-width: 768px) {
		.type-selector {
			grid-template-columns: 1fr;
		}

		.type-btn {
			flex-direction: row;
			justify-content: center;
		}
	}
</style>
