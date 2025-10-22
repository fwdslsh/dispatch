<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import DirectoryBrowser from './directory-browser/DirectoryBrowser.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
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
	import { SESSION_TYPE } from '$lib/shared/session-types.js';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	// Props
	let { open = $bindable(false), initialType = SESSION_TYPE.CLAUDE, oncreated, onclose } = $props();

	// State
	let sessionType = $state(initialType);
	let workspacePath = $state('');
	let loading = $state(false);
	let error = $state(null);
	let sessionViewModel = $state(null);
	// eslint-disable-next-line svelte/prefer-writable-derived -- sessionSettings is reset in multiple effects, not derived from single source
	let sessionSettings = $state({});

	// Reset settings when session type changes
	$effect(() => {
		sessionSettings = {};
	});

	// Get SessionViewModel from service container
	$effect(() => {
		// Get the service container and initialize the SessionViewModel
		try {
			const container = useServiceContainer();
			const maybePromise = container.get('sessionViewModel');
			if (maybePromise && typeof maybePromise.then === 'function') {
				maybePromise
					.then((viewModel) => {
						sessionViewModel = viewModel;
					})
					.catch((error) => {
						console.error('Failed to get sessionViewModel from service container:', error);
					});
			} else {
				sessionViewModel = maybePromise;
			}
		} catch (e) {
			console.error('Failed to access service container:', e);
		}
	});

	// Set default workspace path (will be set when modal opens)
	async function setDefaultWorkspace() {
		// Use the global defaultWorkspaceDirectory setting if available
		if (!workspacePath) {
			const defaultWorkspaceDirectory = settingsService.get('global.defaultWorkspaceDirectory', '');
			workspacePath = defaultWorkspaceDirectory;
		}
	}

	// Create session
	async function createSession() {
		if (!workspacePath) {
			error = 'Please select a workspace';
			return;
		}

		if (!sessionViewModel) {
			error = 'SessionViewModel not initialized';
			return;
		}

		loading = true;
		error = null;

		try {
			// Create the session using SessionViewModel (NOT sessionApi directly)
			// This ensures the session is immediately added to sessionViewModel.sessions
			const session = await sessionViewModel.createSession({
				type: sessionType,
				workspacePath,
				options: sessionSettings
			});

			if (!session) {
				throw new Error('Session creation failed');
			}

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
	}

	// Load default workspace when modal opens
	$effect(() => {
		if (open) {
			setDefaultWorkspace();
			error = null;
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
	augmented="tl-clip tr-clip br-clip both"
	class="create-session-modal"
>
	<div class="modal-content p-5 flex flex-col gap-4">
		<!-- Session Type Selection -->
		<FormSection label="Session Type">
			{#snippet icon()}<IconPlus size={18} />{/snippet}

			<div class="type-grid">
				<TypeCard
					title="Claude Code"
					description="AI-powered coding assistant"
					active={sessionType === SESSION_TYPE.CLAUDE}
					disabled={loading}
					onclick={() => (sessionType = SESSION_TYPE.CLAUDE)}
					aria-label="Select Claude Code session type"
					role="button"
					tabindex="0"
				>
					{#snippet icon()}<IconRobot size={32} />{/snippet}
				</TypeCard>
				<TypeCard
					title="Terminal"
					description="Direct shell access"
					active={sessionType === SESSION_TYPE.PTY}
					disabled={loading}
					onclick={() => (sessionType = SESSION_TYPE.PTY)}
					aria-label="Select Terminal session type"
					role="button"
					tabindex="0"
				>
					{#snippet icon()}<IconTerminal2 size={32} />{/snippet}
				</TypeCard>
				<TypeCard
					title="File Editor"
					description="Browse, edit, and upload files"
					active={sessionType === SESSION_TYPE.FILE_EDITOR}
					disabled={loading}
					onclick={() => (sessionType = SESSION_TYPE.FILE_EDITOR)}
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

			<div class="directory-browser-container surface border-2 border-primary-dim p-4">
				<DirectoryBrowser
					bind:selected={workspacePath}
					startPath={workspacePath || settingsService.get('global.defaultWorkspaceDirectory', '')}
					onSelect={handleDirectorySelect}
				/>
			</div>
		</FormSection>

		<!-- Session Type Settings -->
		{#if sessionType}
			{@const currentModule = getClientSessionModule(sessionType)}
			{#if currentModule?.settingsComponent}
				{@const SettingsComponent = currentModule.settingsComponent}
				<SettingsComponent bind:settings={sessionSettings} disabled={loading} />
			{/if}
		{/if}

		<!-- Error Display -->
		{#if error}
			<div class="error-message border border-err text-err p-3 font-mono text-sm text-center">
				{error}
			</div>
		{/if}
	</div>

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
	/* Component-specific overrides only */
	:global(.create-session-modal) {
		width: 520px;
		max-width: 90vw;
	}

	/* Type Selection Grid */
	.type-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.type-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}

	.directory-browser-container {
		border-radius: 0;
		max-height: 400px;
		overflow-y: auto;
		box-shadow: inset 0 0 10px var(--glow);
	}

	.error-message {
		background: color-mix(in oklab, var(--err) 10%, var(--surface));
		border-radius: 0;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 768px) {
		:global(.create-session-modal) {
			width: 95vw;
			max-width: 95vw;
		}

		.modal-content {
			padding: var(--space-4) !important;
			gap: var(--space-3) !important;
		}
	}
</style>
