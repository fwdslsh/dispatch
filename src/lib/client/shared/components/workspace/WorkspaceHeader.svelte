<!--
	WorkspaceHeader.svelte

	Extracted header component with brand logo and layout controls
	Uses ViewModels for state management and business logic
-->

<script>
	import BrandLogo from './BrandLogo.svelte';
	import LayoutControls from './LayoutControls.svelte';
	import IconButton from '../IconButton.svelte';
	import IconAppWindow from '../Icons/IconAppWindow.svelte';
	import IconLogout from '../Icons/IconLogout.svelte';
	import IconInfoCircle from '../Icons/IconInfoCircle.svelte';
	import HelpModal from '../HelpModal.svelte';
	import TunnelIndicator from '../TunnelIndicator.svelte';

	// Props
	let {
		hasActiveSessions = false,
		sessionCount = 0,
		currentSessionIndex = 0,
		onLogout = () => {},
		viewMode = 'window-manager',
		onViewModeChange = () => {},
		onInstallPWA = () => {},
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
	<BrandLogo />

	<div class="header-spacer"></div>

	<!-- Tunnel indicator -->
	<TunnelIndicator />

	<div class="header-actions">
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
					variant={editModeEnabled ? 'primary' : 'ghost'}
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
			<div class="session-info">
				<span class="session-counter">
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
	.workspace-header {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding-inline: var(--space-3);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 50px;
		flex-shrink: 0;
	}

	.header-spacer {
		flex: 1;
	}

	.header-actions {
		display: flex;
		gap: var(--space-3);
	}
	.session-info {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
