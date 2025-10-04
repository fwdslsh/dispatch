<!--
	Header.svelte

	Extracted header component with brand logo
-->

<script>
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
