<!--
	Header.svelte

	Extracted header component with brand logo
-->

<script>
	import BrandLogo from './workspace/BrandLogo.svelte';
	import TunnelIndicator from './TunnelIndicator.svelte';

	// Props
	let { actions = null } = $props();
</script>

<header
	class="workspace-header flex items-center gap-4 px-3 bg-panel border-b border-primary-dim flex-shrink-0"
>
	<BrandLogo />

	<div class="flex-1"></div>

	<!-- Tunnel indicator -->
	<TunnelIndicator />

	<div class="flex gap-3">
		{@render actions?.()}
	</div>
</header>

<style>
	/* Component-specific sizing only */
	.workspace-header {
		min-height: 50px;
	}
</style>
