<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import DirectoryBrowser from './DirectoryBrowser.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import WorkspaceSelector from '$lib/client/shared/components/WorkspaceSelector.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import TypeCard from '$lib/client/shared/components/TypeCard.svelte';
	import { IconBolt, IconRobot, IconTerminal2, IconFolder, IconPlus } from '@tabler/icons-svelte';
	import { SessionApiClient } from '$lib/client/shared/services/SessionApiClient.js';

	// Props
	let { open = $bindable(false), initialType = 'claude', oncreated, onclose } = $props();

	// State
	let sessionType = $state(initialType);
	let workspacePath = $state('');
	let showDirectoryBrowser = $state(false);
	let loading = $state(false);
	let error = $state(null);

	// API client
	const sessionApi = new SessionApiClient({
		apiBaseUrl: '',
		authTokenKey: 'terminal-key',
		debug: false
	});

	// Set default workspace path (will be set when modal opens)
	async function setDefaultWorkspace() {
		// DirectoryBrowser will now default to WORKSPACES_ROOT when workspacePath is empty
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
			// Create the session using SessionApiClient
			const session = await sessionApi.create({
				type: /** @type {'pty' | 'claude'} */ (sessionType),
				workspacePath,
				options: {}
			});

			if (oncreated) {
				oncreated({
					id: session.id,
					type: sessionType,
					workspacePath,
					typeSpecificId: session.typeSpecificId
				});
			}
			// Close the modal by setting open to false
			open = false;
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

	// Watch for modal close events
	$effect(() => {
		if (!open && onclose) {
			onclose();
		}
	});
</script>

<Modal
	bind:open
	title="Create New Session"
	size="fullscreen"
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

				<div class="directory-browser-container">
					<DirectoryBrowser
						bind:selected={workspacePath}
						startPath={workspacePath || ''}
						onSelect={handleDirectorySelect}
					/>
			
				</div>
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
