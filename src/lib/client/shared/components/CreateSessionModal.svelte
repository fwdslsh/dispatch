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

	// Props
	let { open = $bindable(false), initialType = SESSION_TYPE.CLAUDE, oncreated, onclose } = $props();

	// ViewModel (business logic)
	let viewModel = $state(null);

	// Get ViewModel from service container
	$effect(() => {
		try {
			const container = useServiceContainer();
			const vmPromise = container.get('createSessionViewModel');
			if (vmPromise && typeof vmPromise.then === 'function') {
				vmPromise
					.then((vm) => {
						viewModel = vm;
						// Initialize with the provided session type
						viewModel.reset(initialType);
					})
					.catch((error) => {
						console.error('Failed to get createSessionViewModel from service container:', error);
					});
			} else {
				viewModel = vmPromise;
				viewModel.reset(initialType);
			}
		} catch (e) {
			console.error('Failed to access service container:', e);
		}
	});

	// Handle session creation (delegates to ViewModel)
	async function handleCreateSession() {
		if (!viewModel) return;

		const result = await viewModel.createSession();
		if (result) {
			// Success - notify parent and close modal
			if (oncreated) {
				oncreated({
					id: result.id,
					type: result.type,
					workspacePath: result.workspacePath,
					typeSpecificId: result.typeSpecificId
				});
			}
			open = false;
		}
		// On failure, error is set in viewModel.error and displayed in UI
	}

	// Handle directory selection
	function handleDirectorySelect(path) {
		if (viewModel) {
			viewModel.setWorkspacePath(path);
		}
	}

	// Handle session type selection
	function handleTypeSelect(type) {
		if (viewModel) {
			viewModel.setSessionType(type);
		}
	}

	// Handle session settings update
	function handleSettingsUpdate(settings) {
		if (viewModel) {
			viewModel.setSessionSettings(settings);
		}
	}

	// Initialize when modal opens
	$effect(() => {
		if (open && viewModel) {
			viewModel.initialize();
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
	title="New Tab"
	size="fullscreen"
	closeOnBackdrop={true}
	closeOnEscape={true}
	showCloseButton={true}
	augmented="tl-clip tr-clip br-clip both"
	class="create-session-modal"
>
	<div class="modal-content p-5 flex flex-col gap-4">
		<!-- Tab Type Selection -->
		<FormSection label="Tab Type">
			{#snippet icon()}<IconPlus size={18} />{/snippet}

			<div class="type-grid">
				<TypeCard
					title="AI Agent"
					description="AI-powered coding assistant"
					active={viewModel?.sessionType === SESSION_TYPE.CLAUDE}
					disabled={viewModel?.loading}
					onclick={() => handleTypeSelect(SESSION_TYPE.CLAUDE)}
					aria-label="Select AI Agent tab type"
					role="button"
					tabindex="0"
				>
					{#snippet icon()}<IconRobot size={32} />{/snippet}
				</TypeCard>
				<TypeCard
					title="OpenCode"
					description="OpenCode portal interface"
					active={viewModel?.sessionType === SESSION_TYPE.OPENCODE}
					disabled={viewModel?.loading}
					onclick={() => handleTypeSelect(SESSION_TYPE.OPENCODE)}
					aria-label="Select OpenCode tab type"
					role="button"
					tabindex="0"
				>
					{#snippet icon()}<IconBolt size={32} />{/snippet}
				</TypeCard>
				<TypeCard
					title="Terminal"
					description="Direct shell access"
					active={viewModel?.sessionType === SESSION_TYPE.PTY}
					disabled={viewModel?.loading}
					onclick={() => handleTypeSelect(SESSION_TYPE.PTY)}
					aria-label="Select Terminal tab type"
					role="button"
					tabindex="0"
				>
					{#snippet icon()}<IconTerminal2 size={32} />{/snippet}
				</TypeCard>
				<TypeCard
					title="File Editor"
					description="Browse, edit, and upload files"
					active={viewModel?.sessionType === SESSION_TYPE.FILE_EDITOR}
					disabled={viewModel?.loading}
					onclick={() => handleTypeSelect(SESSION_TYPE.FILE_EDITOR)}
					aria-label="Select File Editor tab type"
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
					selected={viewModel?.workspacePath}
					startPath={viewModel?.workspacePath || viewModel?.defaultWorkspace}
					onSelect={handleDirectorySelect}
				/>
			</div>
		</FormSection>

		<!-- Session Type Settings -->
		{#if viewModel?.sessionType}
			{@const currentModule = getClientSessionModule(viewModel.sessionType)}
			{#if currentModule?.settingsComponent}
				{@const SettingsComponent = currentModule.settingsComponent}
				<SettingsComponent
					bind:settings={viewModel.sessionSettings}
					disabled={viewModel?.loading}
					onupdate={handleSettingsUpdate}
				/>
			{/if}
		{/if}

		<!-- Error Display -->
		{#if viewModel?.error}
			<div class="error-message border border-err text-err p-3 font-mono text-sm text-center">
				{viewModel.error}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<Button
			variant="ghost"
			augmented="tl-clip br-clip both"
			onclick={() => (open = false)}
			disabled={viewModel?.loading}
		>
			Cancel
		</Button>
		<Button
			variant="primary"
			augmented="tl-clip br-clip both"
			onclick={handleCreateSession}
			disabled={!viewModel?.canSubmit}
			loading={viewModel?.loading}
			hideTextOnLoading={false}
		>
			{#snippet icon()}
				{#if viewModel?.loading}
					<IconBolt size={18} />
				{:else}
					<IconPlus size={18} />
				{/if}
			{/snippet}
			{viewModel?.loading ? 'Creating...' : 'Create'}
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
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	@media (min-width: 1024px) {
		.type-grid {
			grid-template-columns: repeat(4, 1fr);
		}
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
