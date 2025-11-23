<script>
	/**
	 * @component Header
	 * @description
	 * Application header component with brand logo, tunnel indicator, and action slots.
	 * Provides consistent header layout across the application.
	 *
	 * @typedef {Object} HeaderProps
	 * @property {import('svelte').Snippet} [actions] - Optional action buttons/controls snippet
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic header -->
	 * <Header />
	 *
	 * <!-- With custom actions -->
	 * <Header>
	 *   {#snippet actions()}
	 *     <Button onclick={handleSettings}>Settings</Button>
	 *     <Button onclick={handleLogout}>Logout</Button>
	 *   {/snippet}
	 * </Header>
	 * ```
	 */
	import BrandLogo from './BrandLogo.svelte';
	import TunnelIndicator from './TunnelIndicator.svelte';

	// Props
	let { actions = null } = $props();
</script>

<header class="workspace-header">
	<BrandLogo />

	<div class="flex-1"></div>

	<!-- Tunnel indicator -->
	<TunnelIndicator />

	<div class="flex gap-3">
		{@render actions?.()}
	</div>
</header>

<style>
	.workspace-header {
		min-height: 40px;
		display: flex;
		align-items: end;
		padding-inline: var(--space-2, 1rem);
	}
</style>
