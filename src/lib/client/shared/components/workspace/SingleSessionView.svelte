<!--
	SingleSessionView.svelte

	Renders a single session at full size with controls for session management.
	Features swipe gesture navigation between sessions on mobile.
	Displays an empty state when no sessions are available.
-->
<script>
	import EmptyTabPanel from './EmptyTabPanel.svelte';
	import SessionContainer from './SessionContainer.svelte';
	import SessionHeaderRenderer from './SessionHeaderRenderer.svelte';
	import SessionViewport from './SessionViewport.svelte';
	import SwipeContainer from '../SwipeContainer.svelte';

	let {
		session = null,
		sessionIndex = 0,
		totalSessions = 0,
		onSessionFocus = () => {},
		onSessionClose = () => {},
		onSessionUnpin: _onSessionUnpin = () => {},
		onCreateSession = () => {},
		onNavigateSession = () => {}
	} = $props();

	const hasSession = $derived(Boolean(session));
	const canSwipeLeft = $derived(sessionIndex < totalSessions - 1);
	const canSwipeRight = $derived(sessionIndex > 0);

	$effect(() => {
		if (hasSession) {
			onSessionFocus?.(session);
		}
	});

	function handleSwipe(direction) {
		if (direction === 'left' && canSwipeLeft) {
			onNavigateSession('next');
		} else if (direction === 'right' && canSwipeRight) {
			onNavigateSession('prev');
		}
	}
</script>

<div class="single-session-view">
	<SwipeContainer
		onSwipe={handleSwipe}
		enabled={hasSession && totalSessions > 1}
		{canSwipeLeft}
		{canSwipeRight}
		showIndicators={true}
	>
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
			<EmptyTabPanel onCreateTab={onCreateSession}></EmptyTabPanel>
		{/if}
	</SwipeContainer>

	<!-- Session indicator dots (mobile) -->
	{#if hasSession && totalSessions > 1}
		<div class="session-dots" role="tablist" aria-label="Session navigation">
			{#each Array(totalSessions) as _, i}
				<button
					class="session-dot"
					class:active={i === sessionIndex}
					role="tab"
					aria-selected={i === sessionIndex}
					aria-label="Session {i + 1}"
					onclick={() => {
						const diff = i - sessionIndex;
						if (diff > 0) {
							for (let j = 0; j < diff; j++) onNavigateSession('next');
						} else if (diff < 0) {
							for (let j = 0; j < -diff; j++) onNavigateSession('prev');
						}
					}}
				></button>
			{/each}
		</div>
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

	.single-session-view :global(.swipe-container) {
		flex: 1;
	}

	/* Session indicator dots */
	.session-dots {
		display: none;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--surface);
		border-top: 1px solid var(--surface-border);
	}

	.session-dot {
		width: 8px;
		height: 8px;
		padding: 0;
		background: var(--surface-border);
		border: none;
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.session-dot:hover {
		background: var(--text-muted);
		transform: scale(1.2);
	}

	.session-dot.active {
		background: var(--primary);
		box-shadow: 0 0 6px var(--primary-glow-40);
		transform: scale(1.2);
	}

	/* Show dots on mobile */
	@media (max-width: 768px) {
		.session-dots {
			display: flex;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.session-dot {
			transition: none;
		}
	}
</style>
