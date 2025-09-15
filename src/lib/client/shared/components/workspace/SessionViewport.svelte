<!--
	SessionViewport.svelte

	Session content rendering component with dynamic component selection
	Renders Claude or Terminal pane based on session type
-->
<script>
	import ClaudePane from '$lib/client/claude/ClaudePane.svelte';
	import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';

	// Props
	let { session, isLoading = false, index = 0 } = $props();

	// Dynamic component selection based on session type
	const Component = $derived(session.type === 'claude' ? ClaudePane : TerminalPane);

	// Session-specific props for the rendered component
	const sessionProps = $derived(() => {
		console.log('[SessionViewport] Processing session:', session);
		console.log('[SessionViewport] Session ID:', session?.id);
		console.log('[SessionViewport] Session type:', session?.type);

		if (!session || !session.id) {
			console.error('[SessionViewport] Invalid session - missing ID');
			return {};
		}

		if (session.type === 'claude') {
			const props = {
				sessionId: session.id,
				claudeSessionId: session.claudeSessionId || session.typeSpecificId || session.sessionId,
				shouldResume: session.shouldResume || session.resumeSession || false,
				workspacePath: session.workspacePath
			};
			console.log('[SessionViewport] Claude props:', props);
			return props;
		} else {
			const props = {
				sessionId: session.id,
				shouldResume: session.resumeSession || false,
				workspacePath: session.workspacePath
			};
			console.log('[SessionViewport] Terminal props:', props);
			return props;
		}
	});
</script>

<div class="session-viewport" class:loading={isLoading}>
	{#if isLoading}
		<div class="loading-indicator">
			<div class="loading-spinner"></div>
			<p>Loading {session.type === 'claude' ? 'Claude' : 'Terminal'} session...</p>
		</div>
	{:else if Component}
		<Component {...sessionProps()} />
	{:else}
		<div class="error-state">
			<p>Unknown session type: {session.type}</p>
		</div>
	{/if}
</div>

<style>
	.session-viewport {
		flex: 1;
		overflow: hidden;
		background: var(--bg-dark);
		min-height: 0;
		display: flex;
		flex-direction: column;
		position: relative;
		contain: layout;
	}

	.loading-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--space-3);
		color: var(--text-muted);
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--surface-border);
		border-top: 2px solid var(--primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.loading-indicator p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		margin: 0;
	}

	.error-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-error);
		font-family: var(--font-mono);
	}

	.error-state p {
		margin: 0;
	}

	/* Mobile viewport adjustments */
	@media (max-width: 768px) {
		.session-viewport {
			/* Ensure full height is used on mobile */
			flex: 1 1 auto;
			min-height: 0;
			height: 100%;
		}
	}

	/* Animation for loading spinner */
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
