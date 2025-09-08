<script>
	import { Modal, Button } from '$lib/shared/components';
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
				// Create session with new project directory as workspace path
				// The backend will create the directory if it doesn't exist
				projectPath = `/workspace/${newProjectName.trim()}`;
			} else {
				if (!selectedProject) return;
				projectPath = selectedProject.path;
				sessionId = selectedSession?.id || null;
			}

			await onSessionCreate?.({
				workspacePath: projectPath,
				sessionId,
				projectName: mode === 'new' ? newProjectName.trim() : selectedProject.name,
				resumeSession: !!sessionId
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
					class="mode-button {mode === 'existing' ? 'active' : ''}"
					onclick={() => (mode = 'existing')}
					disabled={creating}
				>
					Use Existing Project
				</button>
				<button
					type="button"
					class="mode-button {mode === 'new' ? 'active' : ''}"
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
		<Button onclick={handleClose} text="Cancel" variant="ghost" disabled={creating} />
		<Button
			onclick={handleCreate}
			text={createButtonText}
			variant="primary"
			disabled={!canCreate || creating}
		/>
	{/snippet}
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.mode-selector {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.mode-button {
		flex: 1;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface);
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.mode-button:not(:last-child) {
		border-right: 1px solid var(--border);
	}

	.mode-button:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.mode-button.active {
		background: var(--primary);
		color: var(--primary-text);
	}

	.mode-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	label,
	.label {
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	input {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: var(--space-sm);
		border-radius: 4px;
		font-size: 0.9rem;
	}

	input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-alpha);
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.help-text {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 0;
	}
</style>
