<!--
	WorkspaceHeader.svelte

	Extracted header component with brand logo and layout controls
	Uses ViewModels for state management and business logic
-->

<script>
	import BrandLogo from './BrandLogo.svelte';
	import LayoutControls from './LayoutControls.svelte';
	import IconButton from '../IconButton.svelte';
	import { IconLogout } from '@tabler/icons-svelte';

	// Props
	let {
		onLogout = () => {},
		viewMode = 'window-manager',
		onViewModeChange = () => {}
	} = $props();
</script>

<header class="workspace-header">
	<BrandLogo />

	<LayoutControls viewMode={viewMode} onSelectView={onViewModeChange} />

	<div class="header-spacer"></div>

	<div class="header-actions">
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

	/* Hide on mobile */
	/* @media (max-width: 768px) {
		.workspace-header {
			display: none;
		}
	} */
</style>
