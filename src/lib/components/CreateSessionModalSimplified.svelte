<script>
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/shared/components/Modal.svelte';
	import DirectoryBrowser from './DirectoryBrowser.svelte';
	import Button from '$lib/shared/components/Button.svelte';
	import WorkspaceSelector from '$lib/shared/components/WorkspaceSelector.svelte';
	import FormSection from '$lib/shared/components/FormSection.svelte';
	import TypeCard from '$lib/shared/components/TypeCard.svelte';
	import { IconBolt, IconRobot, IconTerminal2, IconFolder, IconPlus } from '@tabler/icons-svelte';

	// Props
	let { open = $bindable(false), initialType = 'claude' } = $props();

	// State
	let sessionType = $state(initialType);
	let workspacePath = $state('');
	let showDirectoryBrowser = $state(false);
	let loading = $state(false);
	let error = $state(null);

	const dispatch = createEventDispatcher();

	// Set default workspace path (will be set when modal opens)
	async function setDefaultWorkspace() {
		// Do not hardcode a default; let DirectoryBrowser pick from user settings or WORKSPACES_ROOT
		if (!workspacePath) {
			workspacePath = '';
		}
	}

	// Create session
	async function createSession() {
		if (!workspacePath) {
			error = 'Please select a workspace';
			return;
		}

		loading = true;
		error = null;

		try {
			// Create the session using unified API
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: sessionType,
					workspacePath,
					options: {}
				})
			});

			if (response.ok) {
				const session = await response.json();
				dispatch('created', {
					id: session.id,
					type: sessionType,
					workspacePath,
					terminalId: session.terminalId,
					claudeId: session.claudeId
				});
				open = false;
			} else {
				const errorText = await response.text();
				error = `Failed to create session: ${errorText}`;
			}
		} catch (err) {
			error = 'Error creating session: ' + err.message;
		} finally {
			loading = false;
		}
	}

	// Handle directory selection
	function handleDirectorySelect(path) {
		workspacePath = path;
		showDirectoryBrowser = false;
	}

	// Format display path
	function formatPath(path) {
		if (!path) return 'Select directory...';
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-2).join('/');
		}
		return path;
	}

	// Load default workspace when modal opens
	$effect(() => {
		if (open) {
			setDefaultWorkspace();
			error = null;
			showDirectoryBrowser = false;
		}
	});
</script>

<Modal 
	bind:open
	title="Create New Session"
	size="medium"
	closeOnBackdrop={true}
	closeOnEscape={true}
	showCloseButton={true}
	augmented="tl-clip tr-clip bl-clip br-clip both"
	class="create-session-modal"
>
	{#snippet children()}
		<div class="modal-content">
				<!-- Session Type Selection -->
				<FormSection label="Session Type">
					{#snippet icon()}<IconPlus size={18} />{/snippet}
					
					<div class="type-grid">
						<TypeCard
							title="Claude Code"
							description="AI-powered coding assistant"
							active={sessionType === 'claude'}
							disabled={loading}
							onclick={() => (sessionType = 'claude')}
							aria-label="Select Claude Code session type"
							role="button"
							tabindex="0"
						>
							{#snippet icon()}<IconRobot size={32} />{/snippet}
						</TypeCard>
						<TypeCard
							title="Terminal"
							description="Direct shell access"
							active={sessionType === 'pty'}
							disabled={loading}
							onclick={() => (sessionType = 'pty')}
							aria-label="Select Terminal session type"
							role="button"
							tabindex="0"
						>
							{#snippet icon()}<IconTerminal2 size={32} />{/snippet}
						</TypeCard>
					</div>
				</FormSection>

				<!-- Workspace Directory Selection -->
				<FormSection label="Working Directory">
					{#snippet icon()}<IconFolder size={18} />{/snippet}
					
					{#if showDirectoryBrowser}
						<div class="directory-browser-container">
								<DirectoryBrowser
									bind:selected={workspacePath}
									startPath={workspacePath || ''}
									onSelect={handleDirectorySelect}
								/>
							<Button
								variant="secondary"
								augmented="tl-clip br-clip both"
								onclick={() => (showDirectoryBrowser = false)}
								class="cancel-browser-btn"
							>
								Cancel
							</Button>
						</div>
					{:else}
						<WorkspaceSelector
							bind:selectedPath={workspacePath}
							disabled={loading}
							placeholder="Select directory..."
							onClick={() => (showDirectoryBrowser = true)}
							aria-label="Select workspace directory"
						/>
					{/if}
				</FormSection>

			<!-- Error Display -->
			{#if error}
				<div class="error-message">{error}</div>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button
			variant="ghost"
			augmented="tl-clip br-clip both"
			onclick={() => (open = false)}
			disabled={loading}
		>
			Cancel
		</Button>
		<Button
			variant="primary"
			augmented="tl-clip br-clip both"
			onclick={createSession}
			disabled={loading || !workspacePath}
			{loading}
			hideTextOnLoading={false}
		>
			{#snippet icon()}
				{#if loading}
					<IconBolt size={18} />
				{:else}
					<IconPlus size={18} />
				{/if}
			{/snippet}
			{loading ? 'Creating...' : 'Create Session'}
		</Button>
	{/snippet}
</Modal>

<style>
	/* Modal content styling - much cleaner and follows design system */
	:global(.create-session-modal) {
		/* Override the default medium size for this specific modal */
		width: 520px;
		max-width: 90vw;
	}

	.modal-content {
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.directory-browser-container {
		background: var(--surface);
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		padding: var(--space-4);
		max-height: 400px;
		overflow-y: auto;
		/* Use consistent design system borders */
		box-shadow: inset 0 0 10px var(--glow);
	}

	.cancel-browser-btn {
		margin-top: var(--space-3);
		width: 100%;
	}

	.error-message {
		background: color-mix(in oklab, var(--err) 10%, var(--surface));
		border: 1px solid var(--err);
		border-radius: 0;
		color: var(--err);
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		text-align: center;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 768px) {
		:global(.create-session-modal) {
			width: 95vw;
			max-width: 95vw;
		}

		.modal-content {
			padding: var(--space-4);
			gap: var(--space-3);
		}
	}
</style>
