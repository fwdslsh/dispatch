<!--
	WorkspaceHeader.svelte

	Extracted header component with brand logo and layout controls
	Uses ViewModels for state management and business logic
-->

<script>
	import BrandLogo from '$lib/client/shared/components/BrandLogo.svelte';
	import IconButton from '$lib/client/shared/components/IconButton.svelte';
	import IconLogout from '$lib/client/shared/components/Icons/IconLogout.svelte';
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
		isSingleSessionMode = false
	} = $props();
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
		{#if isSingleSessionMode && sessionCount > 0}
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
			padding-block: 0;
			gap: var(--space-2);
		}
	}
</style>
