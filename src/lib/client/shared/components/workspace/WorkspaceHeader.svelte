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

	// Props
	let {
		onLogout = () => {},
		viewMode = 'window-manager',
		onViewModeChange = () => {},
		onInstallPWA = () => {}
	} = $props();
</script>

<header class="workspace-header">
	<BrandLogo />

	<div class="header-spacer"></div>

	<div class="header-actions">
		<IconButton onclick={onInstallPWA} aria-label="Install app" title="Install App">
			<IconAppWindow size={18} />
		</IconButton>
		<LayoutControls {viewMode} onSelectView={onViewModeChange} />
		<IconButton onclick={onLogout} aria-label="Logout">
			<IconLogout size={18} />
		</IconButton>
	</div>
</header>

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
</style>
