<script>
	import { Modal, Button } from '$lib/client/shared/components';
	import ClaudeProjectPicker from './ClaudeProjectPicker.svelte';
	import ClaudeSessionPicker from './ClaudeSessionPicker.svelte';
	import DirectoryBrowser from '$lib/client/shared/components/DirectoryBrowser.svelte';
	import { IconRobot, IconFolder } from '@tabler/icons-svelte';

	let { open = $bindable(false), onSessionCreate } = $props();

	let mode = $state('new');
	let projectName = $state('');
	let selectedProject = $state(null);
	let selectedSession = $state(null);
	let selectedDirectory = $state(null);
	let projectSource = $state('browse'); // 'browse' for directory browser, 'claude' for existing Claude projects
	let creating = $state(false);

	async function handleCreate() {
		creating = true;
		try {
			console.log('ClaudeSessionModal: Starting session creation', { mode, projectSource });

			if (mode === 'new') {
				// Using directory browser for new project
				if (!selectedDirectory) {
					console.error('No directory selected');
					return;
				}
				console.log('Creating new session with directory:', selectedDirectory);
				// Use the selected directory as the workspace path
				await onSessionCreate?.({
					workspacePath: selectedDirectory,
					sessionId: null,
					projectName: projectName || selectedDirectory.split('/').pop() || 'project',
					resumeSession: false,
					createWorkspace: false // Don't create a new workspace, use existing directory
				});
			} else {
				// Existing project mode
				if (projectSource === 'claude') {
					// Using existing Claude project
					if (!selectedProject) {
						console.error('No project selected');
						return;
					}
					console.log('Creating session for existing Claude project:', selectedProject);
					await onSessionCreate?.({
						workspacePath: selectedProject.path,
						sessionId: selectedSession?.id || null,
						projectName: selectedProject.name,
						resumeSession: !!selectedSession,
						createWorkspace: false
					});
				} else {
					// Using directory browser
					if (!selectedDirectory) {
						console.error('No directory selected');
						return;
					}
					console.log('Creating session with existing directory:', selectedDirectory);
					// Extract project name from the directory path
					const dirName = selectedDirectory.split('/').pop() || 'project';
					await onSessionCreate?.({
						workspacePath: selectedDirectory,
						sessionId: null,
						projectName: dirName,
						resumeSession: false,
						createWorkspace: false
					});
				}
			}
			console.log('ClaudeSessionModal: Session created successfully, closing modal');
			handleClose();
		} catch (error) {
			console.error('Failed to create Claude session:', error);
			alert(`Failed to create session: ${error.message || 'Unknown error'}`);
		} finally {
			creating = false;
		}
	}

	function handleClose() {
		projectName = '';
		selectedProject = null;
		selectedSession = null;
		selectedDirectory = null;
		projectSource = 'browse'; // Reset to browse for new projects
		mode = 'new';
		open = false;
	}

	function handleProjectSelect(project) {
		selectedProject = project;
		selectedSession = null;
	}

	const canCreate = $derived(
		mode === 'new'
			? selectedDirectory !== null
			: projectSource === 'claude'
				? selectedProject !== null
				: selectedDirectory !== null
	);

	const createButtonText = $derived(
		creating
			? 'Creating...'
			: mode === 'existing' && selectedSession
				? 'Resume Session'
				: 'Create Session'
	);
</script>

<Modal
	bind:open
	title="Create Claude Session"
	onclose={handleClose}
	size="large"
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet children()}
		<div class="terminal-form">
			<div class="mode-selector">
				<div class="tabs">
					<button
						type="button"
						class="tab {mode === 'new' ? 'active' : ''}"
						onclick={() => {
							mode = 'new';
							projectSource = 'browse'; // Default to browse when switching to new mode
							selectedDirectory = null;
							selectedProject = null;
							selectedSession = null;
						}}
					>
						<span class="tab-prefix">01</span> NEW PROJECT
					</button>
					<button
						type="button"
						class="tab {mode === 'existing' ? 'active' : ''}"
						onclick={() => {
							mode = 'existing';
							projectSource = 'claude'; // Reset to claude when switching to existing mode
							selectedDirectory = null;
							projectName = '';
						}}
					>
						<span class="tab-prefix">02</span> EXISTING PROJECT
					</button>
				</div>
			</div>

			<div class="content-area">
				{#if mode === 'new'}
					<!-- Directory browser only for new projects -->
					<div class="input-group">
						<label for="directory-browser-new" id="directory-label-new"
							>SELECT PROJECT DIRECTORY</label
						>
						<DirectoryBrowser
							bind:selected={selectedDirectory}
							api="/api/browse"
							placeholder="Navigate to your project directory..."
							onSelect={(path) => {
								// Extract project name from selected directory
								const dirName = path.split('/').pop() || 'project';
								projectName = dirName;
							}}
						/>
						<div class="hint">Browse and select a directory for your new Claude project</div>
						{#if selectedDirectory && projectName}
							<div class="project-name-preview">
								<span class="preview-label">Project Name:</span>
								<span class="preview-value">{projectName}</span>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Source selector for existing projects -->
					<div class="input-group">
						<label id="project-source-label" for="project-source-claude">PROJECT SOURCE</label>
						<div class="source-selector">
							<button
								id="project-source-claude"
								type="button"
								class="source-tab {projectSource === 'claude' ? 'active' : ''}"
								onclick={() => {
									projectSource = 'claude';
									selectedDirectory = null;
								}}
							>
								<span class="tab-icon"><IconRobot size={20} /></span>
								CLAUDE PROJECTS
							</button>
							<button
								id="project-source-browse"
								type="button"
								class="source-tab {projectSource === 'browse' ? 'active' : ''}"
								onclick={() => {
									projectSource = 'browse';
									selectedProject = null;
									selectedSession = null;
								}}
							>
								<span class="tab-icon"><IconFolder size={20} /></span>
								BROWSE PROJECTS
							</button>
						</div>
					</div>

					{#if projectSource === 'claude'}
						<div class="input-group">
							<label for="claude-project-picker" id="claude-project-label"
								>SELECT CLAUDE PROJECT</label
							>
							<ClaudeProjectPicker
								bind:selected={selectedProject}
								onSelect={handleProjectSelect}
								api="/api/claude/projects"
							/>
						</div>

						{#if selectedProject}
							<div class="input-group">
								<label for="claude-session-picker" id="claude-session-label"
									>RESUME SESSION <span class="optional">(OPTIONAL)</span></label
								>
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
					{:else}
						<div class="input-group">
							<label for="directory-browser-existing" id="directory-label-existing"
								>SELECT DIRECTORY</label
							>
							<DirectoryBrowser
								bind:selected={selectedDirectory}
								api="/api/browse"
								placeholder="Navigate to your project directory..."
								onSelect={() => {}}
							/>
							<div class="hint">Browse and select a directory to start a new Claude session</div>
						</div>
					{/if}
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
			ariaLabel="Cancel session creation"
		>
			Cancel
		</Button>
		<Button
			variant="primary"
			augmented="tl-clip br-clip both"
			onclick={handleCreate}
			disabled={!canCreate || creating}
			loading={creating}
			ariaLabel="Create new Claude session"
		>
			{createButtonText}
		</Button>
	{/snippet}
</Modal>

<style>
	.terminal-form {
		padding: 0;
		background: var(--bg);
		font-family: var(--font-mono);
		position: relative;
		min-height: 300px;
	}

	.mode-selector {
		border-bottom: 1px solid var(--primary-dim);
		background: var(--bg-dark);
		position: relative;
		overflow: hidden;
	}

	.tabs {
		display: flex;
	}

	.tab {
		flex: 1;
		background: transparent;
		border: none;
		padding: 1rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
		text-align: center;
		position: relative;
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
		padding: 1.5rem;
		min-height: 400px;
		max-height: 60vh;
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
		scrollbar-width: thin;
		scrollbar-color: var(--primary-dim) transparent;
	}

	.content-area::-webkit-scrollbar {
		width: 8px;
	}

	.content-area::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, var(--primary-dim), var(--primary));
		border-radius: 4px;
	}

	.content-area::-webkit-scrollbar-track {
		background: rgba(0, 20, 10, 0.3);
		border-radius: 4px;
	}

	.input-group {
		margin-bottom: 1.5rem;
	}

	.input-group:last-child {
		margin-bottom: 0;
	}

	label {
		display: block;
		color: var(--primary);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		font-family: var(--font-mono);
	}

	.optional {
		color: var(--text-muted);
		font-size: 0.7rem;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.5rem;
		line-height: 1.4;
		font-family: var(--font-mono);
	}

	/* Removed terminal-actions and terminal-btn styles - using shared Button component now */

	/* Source selector styles */
	.source-selector {
		display: flex;
		gap: 0.5rem;
		background: var(--bg-dark);
		padding: 0.25rem;
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
	}

	.source-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		cursor: pointer;
		border-radius: 3px;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.source-tab:hover {
		color: var(--text);
		background: rgba(46, 230, 107, 0.05);
		border-color: var(--primary-dim);
	}

	.source-tab.active {
		background: rgba(46, 230, 107, 0.15);
		color: var(--primary);
		border-color: var(--primary);
	}

	.tab-icon {
		font-size: 1.2em;
		flex-shrink: 0;
	}

	/* Project name preview */
	.project-name-preview {
		margin-top: 1rem;
		padding: 0.75rem;
		background: rgba(46, 230, 107, 0.05);
		border: 1px solid var(--primary);
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-family: var(--font-mono);
	}

	.preview-label {
		color: var(--primary);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.preview-value {
		color: var(--text);
		font-size: 0.9rem;
		font-weight: 500;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.content-area {
			min-height: 300px;
			max-height: 70vh;
			padding: 1rem;
		}

		.source-selector {
			flex-direction: column;
		}

		.source-tab {
			justify-content: flex-start;
			padding: var(--space-2) var(--space-3);
		}

		.terminal-form {
			min-height: auto;
		}

		.mode-selector {
			position: sticky;
			top: 0;
			z-index: 10;
			background: var(--bg-dark);
		}

		.tabs {
			flex-direction: column;
		}

		.tab {
			width: 100%;
			text-align: left;
			padding: 0.75rem 1rem;
		}
	}
</style>
