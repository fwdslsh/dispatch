<script>
	import { Modal } from '$lib/shared/components';
	import ClaudeProjectPicker from './ClaudeProjectPicker.svelte';
	import ClaudeSessionPicker from './ClaudeSessionPicker.svelte';

	let { open = $bindable(false), onSessionCreate } = $props();

	let selectedProject = $state(null);
	let selectedSession = $state(null);
	let newProjectName = $state('');
	let creating = $state(false);
	let mode = $state('existing'); // 'existing' | 'new'

	async function handleCreate() {
		creating = true;
		try {
			let projectPath;
			let sessionId = null;

			if (mode === 'new') {
				if (!newProjectName.trim()) return;
				// For new projects, send just the project name and let backend construct the full path
				projectPath = newProjectName.trim();
			} else {
				if (!selectedProject) return;
				projectPath = selectedProject.path;
				sessionId = selectedSession?.id || null;
			}

			await onSessionCreate?.({
				workspacePath: projectPath,
				sessionId,
				projectName: mode === 'new' ? newProjectName.trim() : selectedProject.name,
				resumeSession: !!sessionId,
				createWorkspace: mode === 'new'
			});

			handleClose();
		} catch (error) {
			console.error('Failed to create Claude session:', error);
		} finally {
			creating = false;
		}
	}

	function handleClose() {
		selectedProject = null;
		selectedSession = null;
		newProjectName = '';
		mode = 'existing';
		open = false;
	}

	function handleProjectSelect(project) {
		selectedProject = project;
		selectedSession = null; // Reset session when project changes
	}

	const canCreate = $derived.by(() => {
		if (mode === 'new') {
			return newProjectName.trim().length > 0;
		}
		return selectedProject !== null;
	});

	const createButtonText = $derived.by(() => {
		if (creating) return 'Creating...';
		if (mode === 'new') return 'Create Project & Session';
		if (selectedSession) return 'Resume Session';
		return 'Create Session';
	});
</script>

<Modal bind:open title="Create Claude Session" size="medium" onclose={handleClose}>
	{#snippet children()}
		<div class="form">
			<div class="mode-selector">
				<button
					type="button"
					class="button aug {mode === 'existing' ? 'primary' : ''}"
					data-augmented-ui="l-clip r-clip both"
					onclick={() => (mode = 'existing')}
					disabled={creating}
				>
					Use Existing Project
				</button>
				<button
					type="button"
					class="button aug {mode === 'new' ? 'primary' : ''}"
					data-augmented-ui="l-clip r-clip both"
					onclick={() => (mode = 'new')}
					disabled={creating}
				>
					Create New Project
				</button>
			</div>

			{#if mode === 'existing'}
				<div class="form-group">
					<div class="label">Claude Code Project</div>
					<ClaudeProjectPicker
						bind:selected={selectedProject}
						onSelect={handleProjectSelect}
						api="/api/claude/projects"
					/>
				</div>

				{#if selectedProject}
					<div class="form-group">
						<div class="label">Session (Optional)</div>
						<ClaudeSessionPicker
							project={selectedProject.name}
							bind:selected={selectedSession}
							apiBase="/api/claude/sessions"
						/>
						<p class="help-text">
							Leave empty to create a new session, or select an existing session to resume.
						</p>
					</div>
				{/if}
			{:else}
				<div class="form-group">
					<label for="project-name">New Project Name</label>
					<input
						id="project-name"
						type="text"
						bind:value={newProjectName}
						placeholder="Enter project name..."
						disabled={creating}
					/>
					<p class="help-text">This will create a new directory and Claude Code project.</p>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<button class="button aug" data-augmented-ui="l-clip r-clip both" onclick={handleClose} disabled={creating}>Cancel</button>
		<button class="button aug primary" data-augmented-ui="l-clip r-clip both" onclick={handleCreate} disabled={!canCreate || creating}>
			{createButtonText}
		</button>
	{/snippet}
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		min-height: 320px;
		padding: var(--space-2);
	}

	.mode-selector {
		display: flex;
		gap: var(--space-3);
		justify-content: center;
		margin-bottom: var(--space-2);
	}

	.mode-selector .button {
		flex: 1;
		max-width: 200px;
		padding: var(--space-3) var(--space-4);
		font-size: 0.95rem;
		font-weight: 500;
		transition: all 0.3s ease;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-2);
	}

	label,
	.label {
		font-weight: 600;
		color: var(--primary);
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--space-2);
		font-family: var(--font-mono);
	}

	.label::before {
		content: '> ';
		color: var(--accent-amber);
		margin-right: 0.5rem;
	}

	input[type="text"] {
		padding: var(--space-4);
		font-size: 1rem;
		background: var(--bg-input);
		border: 2px solid var(--primary-dim);
		color: var(--text);
		border-radius: 0;
		font-family: var(--font-mono);
		transition: all 0.3s ease;
		min-height: 48px;
	}

	input[type="text"]:focus {
		outline: none;
		border-color: var(--primary);
		background: var(--bg);
		box-shadow: 0 0 0 2px rgba(46, 230, 107, 0.2);
	}

	input[type="text"]::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.help-text {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: var(--space-2) 0 0 0;
		font-style: italic;
		line-height: 1.4;
		padding-left: var(--space-2);
		border-left: 2px solid var(--primary-dim);
	}
</style>
