<script>
	import '$lib/client/shared/styles/index.css';
	let { children, header = null, footer = null } = $props();

</script>

<div class="dispatch-app">
	{@render header?.()}

	<main class="app-main">
		{@render children()}
	</main>

	{@render footer?.()}
</div>

<style>
	/* Global layout structure */
	.dispatch-app {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		background: transparent;
		color: var(--text-primary);
		overflow: hidden;
		max-width: 100svw;
		width: 100%;
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	/* Main content area - takes remaining vertical space */
	.app-main {
		flex: 1 1 auto;
		overflow: auto;
		position: relative;
		min-width: 0;
		min-height: 0;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		width: 100%;
		display: grid;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 480px) {
		.dispatch-app {
			padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
		}
	}
</style>
