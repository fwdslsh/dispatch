<script>
	let { sessionContainer = false, children, header = null, footer = null } = $props();
</script>

<div
	class="container no-hover"
	class:session-container={sessionContainer}
	data-augmented-ui="br-clip bl-clip tl-clip tr-clip border"
>
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
	.container {
		/* Augmented-UI optimizations following best practices */
		--aug-border-opacity: 0.25;
		--aug-border-bg: rgba(0, 255, 136, 0.3);

		/* Layout */
		max-width: calc(100svw - var(--space-xl));
		height: calc(100svh - var(--space-xl));
		margin: var(--space-lg) auto 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		container-type: inline-size;

		/* Performance optimized transitions */
		transition:
			--aug-border-opacity 0.2s ease,
			--aug-border-bg 0.2s ease,
			box-shadow 0.2s ease;

		/* Enhanced glassmorphism */
		background: rgba(26, 26, 26, 0.1);
		backdrop-filter: blur(12px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.2),
			0 0 16px rgba(0, 255, 136, 0.02),
			inset 0 1px 0 rgba(255, 255, 255, 0.02);
	}

	.container-header {
		flex-shrink: 0;
		margin-inline: calc(var(--space-md) * -1);
	}

	.container-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: var(--space-md);
	}

	.container-footer {
		flex-shrink: 0;
		padding: var(--space-md);
		border-top: 1px solid var(--border);
		background: rgba(26, 26, 26, 0.8);
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
	@container (max-width: 800px) {
		.container {
			max-width: 100%;
			height: 100dvh;
			margin: 0;
			--aug-border-all: 0px;
			--aug-inlay-all: 0px;
			clip-path: none;
			box-shadow: none;
			background: var(--bg-dark);
			backdrop-filter: none;
		}

		.container-header {
			margin-inline: 0;
		}

		.container-content {
			padding: var(--space-sm);
		}

		.session-container .container-content {
			padding: 0;
		}
	}

	/* iOS Safari dynamic viewport handling */
	@supports (-webkit-touch-callout: none) {
		@container (max-width: 800px) {
			.container {
				height: -webkit-fill-available;
			}
		}
	}
</style>
