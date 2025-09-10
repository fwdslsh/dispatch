<script>
	import { Modal } from '$lib/shared/components';
	import ClaudeProjectPicker from './ClaudeProjectPicker.svelte';
	import ClaudeSessionPicker from './ClaudeSessionPicker.svelte';

	let { open = $bindable(false), onSessionCreate } = $props();

	let mode = $state('new');
	let projectName = $state('');
	let selectedProject = $state(null);
	let selectedSession = $state(null);
	let creating = $state(false);

	async function handleCreate() {
		creating = true;
		try {
			if (mode === 'new') {
				if (!projectName.trim()) return;
				await onSessionCreate?.({
					workspacePath: projectName.trim(),
					sessionId: null,
					projectName: projectName.trim(),
					resumeSession: false,
					createWorkspace: true
				});
			} else {
				if (!selectedProject) return;
				await onSessionCreate?.({
					workspacePath: selectedProject.path,
					sessionId: selectedSession?.id || null,
					projectName: selectedProject.name,
					resumeSession: !!selectedSession,
					createWorkspace: false
				});
			}
			handleClose();
		} catch (error) {
			console.error('Failed to create Claude session:', error);
		} finally {
			creating = false;
		}
	}

	function handleClose() {
		projectName = '';
		selectedProject = null;
		selectedSession = null;
		mode = 'new';
		open = false;
	}

	function handleProjectSelect(project) {
		selectedProject = project;
		selectedSession = null;
	}

	const canCreate = $derived(
		mode === 'new' ? projectName.trim().length > 0 : selectedProject !== null
	);

	const createButtonText = $derived(
		creating
			? 'Creating...'
			: mode === 'existing' && selectedSession
				? 'Resume Session'
				: 'Create Session'
	);
</script>

<Modal bind:open title="Create Claude Session" onclose={handleClose} size="fullscreen">
	{#snippet children()}
		<div class="terminal-form">
			<div class="mode-selector">
				<div class="tabs">
					<button
						type="button"
						class="tab {mode === 'new' ? 'active' : ''}"
						onclick={() => (mode = 'new')}
					>
						<span class="tab-prefix">01</span> NEW PROJECT
					</button>
					<button
						type="button"
						class="tab {mode === 'existing' ? 'active' : ''}"
						onclick={() => (mode = 'existing')}
					>
						<span class="tab-prefix">02</span> EXISTING PROJECT
					</button>
				</div>
			</div>

			<div class="content-area">
				{#if mode === 'new'}
					<div class="input-group">
						<label for="project-name">PROJECT NAME</label>
						<div class="terminal-input">
							<span class="prompt">></span>
							<input
								id="project-name"
								type="text"
								bind:value={projectName}
								placeholder="my-awesome-project"
								disabled={creating}
							/>
						</div>
						<div class="hint">Enter a unique name for your new Claude project workspace</div>
					</div>
				{:else}
					<div class="input-group">
						<label>SELECT PROJECT</label>
						<ClaudeProjectPicker
							bind:selected={selectedProject}
							onSelect={handleProjectSelect}
							api="/api/claude/projects"
						/>
					</div>

					{#if selectedProject}
						<div class="input-group">
							<label>RESUME SESSION <span class="optional">(OPTIONAL)</span></label>
							<ClaudeSessionPicker
								project={selectedProject.name}
								bind:selected={selectedSession}
								apiBase="/api/claude/sessions"
							/>
							<div class="hint">
								Select a previous session to resume or leave empty for new session
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet footer()}
		<div class="terminal-actions">
			<button class="terminal-btn cancel" onclick={handleClose} disabled={creating}>
				<span class="btn-prefix">ESC</span> CANCEL
			</button>
			<button
				class="terminal-btn create {!canCreate || creating ? 'disabled' : ''}"
				onclick={handleCreate}
				disabled={!canCreate || creating}
			>
				<span class="btn-prefix">ENTER</span>
				{createButtonText.toUpperCase()}
			</button>
		</div>
	{/snippet}
</Modal>

<style>
	.terminal-form {
		padding: 0;
		background: var(--bg);
		font-family: var(--font-mono);
	}

	.mode-selector {
		border-bottom: 1px solid var(--primary-dim);
		background: var(--bg-dark);
	}

	.tabs {
		display: flex;
	}

	.tab {
		flex: 1;
		background: transparent;
		border: none;
		padding: 1rem 1.5rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
		text-align: left;
	}

	.tab:hover {
		color: var(--text);
		background: rgba(46, 230, 107, 0.05);
	}

	.tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
		background: rgba(46, 230, 107, 0.1);
	}

	.tab-prefix {
		color: var(--accent-amber);
		margin-right: 0.5rem;
		font-size: 0.7rem;
	}

	.content-area {
		padding: 2rem;
		min-height: 300px;
		max-height: 80svh;
		overflow-y: auto;
	}

	.input-group {
		margin-bottom: 2rem;
	}

	.input-group:last-child {
		margin-bottom: 0;
	}

	label {
		display: block;
		color: var(--primary);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		font-family: var(--font-mono);
	}

	.optional {
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.terminal-input {
		display: flex;
		align-items: center;
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 0;
		padding: 0;
		font-family: var(--font-mono);
		transition: border-color 0.2s ease;
	}

	.terminal-input:focus-within {
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}

	.prompt {
		color: var(--accent-amber);
		padding: 0.75rem;
		font-weight: bold;
		font-size: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-right: 1px solid var(--primary-dim);
	}

	.terminal-input input {
		flex: 1;
		background: transparent;
		border: none;
		padding: 0.75rem;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.terminal-input input:focus {
		outline: none;
	}

	.terminal-input input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.5rem;
		line-height: 1.4;
		font-family: var(--font-mono);
	}

	.terminal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		align-items: center;
	}

	.terminal-btn {
		background: transparent;
		border: 1px solid var(--primary-dim);
		color: var(--text);
		padding: 0.75rem 1.5rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.2s ease;
		text-transform: uppercase;
	}

	.terminal-btn:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
		background: rgba(46, 230, 107, 0.1);
		box-shadow: 0 0 10px rgba(46, 230, 107, 0.2);
	}

	.terminal-btn.create {
		background: var(--primary);
		color: var(--bg);
		border-color: var(--primary);
	}

	.terminal-btn.create:hover:not(:disabled) {
		background: color-mix(in oklab, var(--primary) 90%, white 10%);
		box-shadow: 0 0 15px rgba(46, 230, 107, 0.3);
	}

	.terminal-btn:disabled,
	.terminal-btn.disabled {
		opacity: 0.5;
		cursor: not-allowed;
		border-color: var(--text-muted);
		color: var(--text-muted);
		background: var(--bg-dark);
	}

	.btn-prefix {
		color: var(--accent-amber);
		margin-right: 0.5rem;
		font-size: 0.7rem;
		opacity: 0.8;
	}
</style>
