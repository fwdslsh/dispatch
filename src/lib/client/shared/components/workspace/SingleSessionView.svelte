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
</style>
