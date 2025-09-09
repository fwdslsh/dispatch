<script>
	let { sessionContainer = false, children, header = null, footer = null } = $props();
</script>

<div class="container" data-augmented-ui="" class:session-container={sessionContainer}>
	{#if header}
		<div class="container-header">
			{@render header()}
		</div>
	{/if}

	<div class="container-content">
		{@render children()}
	</div>

	{#if footer}
		<div class="container-footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	/* Override global container with app-specific layout */
	.container {
		height: calc(100vh - var(--space-6));
		margin: var(--space-5) auto 0;
		display: flex;
		flex-direction: column;
	}

	.container-header {
		flex-shrink: 0;
	}

	.container-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: var(--space-4);
	}

	.container-footer {
		flex-shrink: 0;
		padding: var(--space-4);
		border-top: 1px solid var(--line);
		background: color-mix(in oklab, var(--surface) 80%, black 20%);
	}

	/* Default desktop layout */
	.container:not(.session-container) .container-content {
		min-height: 400px;
		overflow: auto;
	}

	/* Session container specific styles */
	.session-container .container-content {
		padding: 0;
		overflow: hidden;
	}

	/* Mobile responsive */
	@media (max-width: 800px) {
		.container {
			height: 100vh;
			margin: 0;
		}

		.container-content {
			padding: var(--space-3);
		}

		.session-container .container-content {
			padding: 0;
		}
	}
</style>
