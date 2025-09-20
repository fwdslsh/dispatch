<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import DirectoryBrowser from './DirectoryBrowser.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import WorkspaceSelector from '$lib/client/shared/components/WorkspaceSelector.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import TypeCard from '$lib/client/shared/components/TypeCard.svelte';
	import IconBolt from './Icons/IconBolt.svelte';
	import IconRobot from './Icons/IconRobot.svelte';
	import IconTerminal2 from './Icons/IconTerminal2.svelte';
	import IconFolder from './Icons/IconFolder.svelte';
	import IconPlus from './Icons/IconPlus.svelte';
	import IconEdit from './Icons/IconEdit.svelte';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { getClientSessionModule } from '$lib/client/shared/session-modules/index.js';

	// Props
	let { open = $bindable(false), initialType = 'claude', oncreated, onclose } = $props();

	// State
	let sessionType = $state(initialType);
	let workspacePath = $state('');
	let showDirectoryBrowser = $state(false);
	let loading = $state(false);
	let error = $state(null);
	let sessionApi = $state(null);
	let sessionSettings = $state({});

	// Reset settings when session type changes
	$effect(() => {
		sessionSettings = {};
	});

	// Get API client from service container
	$effect(() => {
		// Get the service container and initialize the API client
		try {
			const container = useServiceContainer();
			const maybePromise = container.get('sessionApi');
			if (maybePromise && typeof maybePromise.then === 'function') {
				maybePromise.then(api => {
					sessionApi = api;
				}).catch((error) => {
					console.error('Failed to get sessionApi from service container:', error);
					// Don't fall back to static import - let the service container handle it
				});
			} else {
				sessionApi = maybePromise;
			}
		} catch (e) {
			console.error('Failed to access service container:', e);
			// Don't fall back to static import - service container should be available
		}
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

		if (!sessionApi) {
			error = 'API client not initialized';
			return;
		}

		loading = true;
		error = null;

		try {
			// Create the session using SessionApiClient
			const session = await sessionApi.create({
				type: /** @type {'pty' | 'claude' | 'file-editor'} */ (sessionType),
				workspacePath,
				options: sessionSettings
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
			sessionSettings = {};
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
					<TypeCard
						title="File Editor"
						description="Browse, edit, and upload files"
						active={sessionType === 'file-editor'}
						disabled={loading}
						onclick={() => (sessionType = 'file-editor')}
						aria-label="Select File Editor session type"
						role="button"
						tabindex="0"
					>
						{#snippet icon()}<IconEdit size={32} />{/snippet}
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

			<!-- Session Type Settings -->
			{#if sessionType}
				{@const currentModule = getClientSessionModule(sessionType)}
				{#if currentModule?.settingsComponent}
					{@const SettingsComponent = currentModule.settingsComponent}
					<SettingsComponent 
						bind:settings={sessionSettings}
						disabled={loading}
					/>
				{/if}
			{/if}

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
