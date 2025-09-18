<!--
	SessionContainer.svelte

	Individual session wrapper component
	Uses snippets for flexible header and content rendering
-->
<script>
	// Props
	let {
		session,
		index = 0,
		onClose = () => {},
		onUnpin = () => {},
		isFocused = false,
		header,
		content
	} = $props();

	// Derived state for styling
	const containerClass = $derived(
		`session-container ${isFocused ? 'focused' : ''} ${session.type || session.sessionType}`
	);

	// Loading state - sessions start as loading until they're ready
	let isLoading = $state(true);

	// Update loading state when session becomes active
	$effect(() => {
		if (session.isActive !== undefined) {
			isLoading = !session.isActive;
		}
	});
</script>

<div class={containerClass}>
	{@render header({ session, onClose, onUnpin, index })}
	{@render content({ session, isLoading, index })}
</div>

<style>
	.session-container {
		display: flex;
		flex-direction: column;
		background: var(--bg-panel);
		border: 1px solid var(--primary-dim);
		overflow: hidden;
		width: 100%;
		height: 100%;
		position: relative;
		transition: border-color 0.2s ease;
	}

	.session-container:hover {
		border-color: var(--primary);
	}

	.session-container.focused {
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary-glow);
	}

	.session-container.claude {
		border-color: var(--primary-dim);
	}

	.session-container.claude:hover,
	.session-container.claude.focused {
		border-color: var(--primary);
	}

	.session-container.pty {
		border-color: var(--accent-amber);
	}

	.session-container.pty:hover,
	.session-container.pty.focused {
		border-color: var(--accent-amber);
	}

	/* Mobile session container adjustments */
	@media (max-width: 768px) {
		.session-container {
			height: 100%;
			display: flex;
			flex-direction: column;
			transition: opacity 0.15s ease-out;
			will-change: opacity;
			contain: layout style;
			transform: translateZ(0);
			backface-visibility: hidden;
		}
	}

	/* Accessibility: reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.session-container {
			transition: opacity 0.2s ease;
		}

		.session-container:hover {
			transform: none !important;
			box-shadow: none !important;
		}
	}
</style>
