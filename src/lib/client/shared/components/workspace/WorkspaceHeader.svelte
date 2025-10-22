<!--
	WorkspaceHeader.svelte

	Extracted header component with brand logo and layout controls
	Uses ViewModels for state management and business logic
-->

<script>
	import BrandLogo from '$lib/client/shared/components/BrandLogo.svelte';
	import IconButton from '$lib/client/shared/components/IconButton.svelte';
	import IconLogout from '$lib/client/shared/components/Icons/IconLogout.svelte';
	import IconInfoCircle from '$lib/client/shared/components/Icons/IconInfoCircle.svelte';
	import HelpModal from '$lib/client/shared/components/HelpModal.svelte';
	import TunnelIndicator from '$lib/client/shared/components/TunnelIndicator.svelte';
	import LayoutControls from './LayoutControls.svelte';

	// Props
	let {
		hasActiveSessions: _hasActiveSessions = false,
		sessionCount = 0,
		currentSessionIndex = 0,
		onLogout = () => {},
		viewMode = 'window-manager',
		onViewModeChange = () => {},
		onInstallPWA: _onInstallPWA = () => {},
		isSingleSessionMode = false,
		editModeEnabled = false,
		onEditModeToggle = () => {}
	} = $props();

	// Help modal state
	let showHelpModal = $state(false);

	// Handle help button click
	function handleHelpClick() {
		showHelpModal = true;
	}

	// Handle edit mode toggle
	function handleEditModeToggle() {
		onEditModeToggle();
	}
</script>

<header class="workspace-header">
	<div>
		<BrandLogo />
	</div>

	<div class="flex-1"></div>

	<!-- Tunnel indicator -->
	<TunnelIndicator />

	<div class="flex gap-3">
		<!-- <IconButton onclick={onInstallPWA} aria-label="Install app" title="Install App">
			<IconAppWindow size={18} />
		</IconButton> -->
		{#if !isSingleSessionMode}
			<IconButton
				onclick={handleHelpClick}
				aria-label="Keyboard shortcuts"
				title="Keyboard Shortcuts"
			>
				<IconInfoCircle size={18} />
			</IconButton>
			{#if viewMode === 'window-manager'}
				<IconButton
					onclick={handleEditModeToggle}
					variant={editModeEnabled ? 'primary' : 'toggle-off'}
					aria-label={editModeEnabled ? 'Disable edit mode' : 'Enable edit mode'}
					title={editModeEnabled ? 'Disable Edit Mode' : 'Enable Edit Mode'}
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
						/>
					</svg>
				</IconButton>
			{/if}
		{:else if sessionCount > 0}
			<div class="flex items-center justify-center">
				<span>
					{Math.min(currentSessionIndex + 1, sessionCount)} / {sessionCount}
				</span>
			</div>
		{/if}
		<LayoutControls {viewMode} onSelectView={onViewModeChange} />
		<IconButton onclick={onLogout} aria-label="Logout">
			<IconLogout size={18} />
		</IconButton>
	</div>
</header>

<!-- Help Modal -->
<HelpModal bind:open={showHelpModal} />

<style>
	/* Component-specific sizing only */
	.workspace-header {
		
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	@media (max-width: 800px) {
		.workspace-header {
			padding: var(--space-2) var(--space-3);
			gap: var(--space-2);
		}
	}
</style>
