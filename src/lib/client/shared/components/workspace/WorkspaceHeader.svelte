<!--
	WorkspaceHeader.svelte

	Extracted header component with brand logo and layout controls
	Uses ViewModels for state management and business logic
-->
<script>
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { uiState } from '$lib/client/shared/state/ui-state.svelte.js';
	import BrandLogo from './BrandLogo.svelte';
	import LayoutControls from './LayoutControls.svelte';
	import IconButton from '../IconButton.svelte';
	import { IconLogout } from '@tabler/icons-svelte';

	// Props
	let { onLogout = () => {} } = $props();

	// Get services
	const container = useServiceContainer();

	// Derived values from ui state
	const shouldUseSidebar = $derived(!uiState.layout.isMobile);

	// Only show header on desktop
	const showHeader = $derived(shouldUseSidebar);
</script>

{#if showHeader}
	<header class="workspace-header">
		<BrandLogo />

		<div class="header-spacer"></div>

		<LayoutControls />

		<div class="header-actions">
			<IconButton class="logout-btn" onclick={onLogout} aria-label="Logout">
				<IconLogout size={18} />
			</IconButton>
		</div>
	</header>
{/if}

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

	:global(.logout-btn) {
		margin-left: 1rem;
		padding: 0.5em 1em;
		background: #222;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1em;
		transition: background 0.2s;
	}

	:global(.logout-btn:hover) {
		background: #444;
	}

	/* Hide on mobile */
	@media (max-width: 768px) {
		.workspace-header {
			display: none;
		}
	}
</style>
