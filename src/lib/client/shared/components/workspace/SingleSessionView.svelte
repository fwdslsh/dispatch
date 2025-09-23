<!--
	SingleSessionView.svelte

	Renders a single session at full size with controls for session management.
	Displays an empty state when no sessions are available.
-->
<script>
	import EmptySessionPane from './EmptySessionPane.svelte';

	import SessionContainer from './SessionContainer.svelte';
	import SessionHeaderRenderer from './SessionHeaderRenderer.svelte';
	import SessionViewport from './SessionViewport.svelte';

	let {
		session = null,
		sessionIndex = 0,
		onSessionFocus = () => {},
		onSessionClose = () => {},
		onSessionUnpin = () => {},
		onCreateSession = () => {}
	} = $props();

	const hasSession = $derived(Boolean(session));

	function create(type) {
		onCreateSession?.(type);
	}

	$effect(() => {
		if (hasSession) {
			onSessionFocus?.(session);
		}
	});
</script>

<div class="single-session-view">
	{#if hasSession}
		<SessionContainer {session} index={sessionIndex} isFocused={true} onClose={onSessionClose}>
			{#snippet header({ session, onClose, index })}
				<SessionHeaderRenderer {session} {onClose} {index} />
			{/snippet}

			{#snippet content({ session, isLoading, index })}
				<SessionViewport {session} {isLoading} {index} />
			{/snippet}
		</SessionContainer>
	{:else}
		<EmptySessionPane {onCreateSession}></EmptySessionPane>
	{/if}
</div>

<style>
	.single-session-view {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.single-session-view :global(.session-container) {
		height: 100%;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: var(--space-3);
		background: var(--bg-panel);
		border: 1px dashed var(--surface-border);
		border-radius: 6px;
		padding: var(--space-4);
		text-align: center;
	}

	.empty-state h2 {
		margin: 0;
		font-size: 1.05rem;
		color: var(--text-primary);
	}

	.empty-state p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.empty-actions {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		justify-content: center;
	}

	.create-session {
		background: var(--surface-hover);
		border: 1px solid var(--surface-border);
		color: var(--text);
		border-radius: 0.35rem;
		padding: 0.45rem 0.75rem;
		font-family: var(--font-mono);
		cursor: pointer;
		transition:
			background 0.15s ease,
			transform 0.15s ease;
	}

	.create-session:hover {
		background: var(--primary-alpha);
		transform: translateY(-1px);
	}

	.create-session:active {
		transform: translateY(0);
	}

	@media (max-width: 768px) {
		.empty-actions {
			width: 100%;
		}

		.create-session {
			width: 100%;
		}
	}
</style>
