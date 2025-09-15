<!--
	SessionGrid.svelte

	Session grid layout component using snippets for flexible rendering
	Handles responsive layout with mobile/desktop display modes
-->
<script>
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { uiState } from '$lib/client/shared/state/ui-state.svelte.js';

	// Props
	let { sessions = [], onSessionFocus = () => {}, sessionContainer } = $props();

	// Derived values from state
	const currentBreakpoint = $derived(
		uiState.layout.isMobile ? 'mobile' : uiState.layout.isTablet ? 'tablet' : 'desktop'
	);
	const layoutColumns = $derived(() => {
		if (uiState.layout.isMobile) return 1;
		switch (uiState.layout.preset) {
			case '2up':
				return 2;
			case '4up':
				return 2;
			case 'grid':
				return uiState.layout.isTablet ? 2 : 3;
			default:
				return 1;
		}
	});

	// Reactive layout calculations
	const gridColumns = $derived(layoutColumns());
	const isMobile = $derived(currentBreakpoint === 'mobile');

	// Touch gesture state for mobile navigation
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let isSwipeInProgress = $state(false);

	function handleTouchStart(e) {
		if (!isMobile) return;

		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
		isSwipeInProgress = true;
	}

	function handleTouchMove(e) {
		if (!isMobile || !isSwipeInProgress) return;
		// Track movement but don't interfere with scrolling
	}

	function handleTouchEnd(e) {
		if (!isMobile || !isSwipeInProgress) return;

		isSwipeInProgress = false;
		const touchEndX = e.changedTouches[0].screenX;
		const touchEndY = e.changedTouches[0].screenY;

		handleSwipeGesture(touchEndX, touchEndY);
	}

	function handleSwipeGesture(touchEndX, touchEndY) {
		const swipeThreshold = 75;
		const verticalThreshold = 50;

		const deltaX = touchEndX - touchStartX;
		const deltaY = Math.abs(touchEndY - touchStartY);

		// Check if it's a horizontal swipe
		if (deltaY > verticalThreshold || Math.abs(deltaX) < swipeThreshold) {
			return;
		}

		// Dispatch swipe events for parent to handle
		if (deltaX < -swipeThreshold) {
			// Left swipe - next session
			const event = new CustomEvent('swipe', { detail: { direction: 'next' } });
			window.dispatchEvent(event);
		} else if (deltaX > swipeThreshold) {
			// Right swipe - previous session
			const event = new CustomEvent('swipe', { detail: { direction: 'prev' } });
			window.dispatchEvent(event);
		}
	}
</script>

<div
	class="session-grid"
	style:--columns={gridColumns}
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	{#each sessions as session, index (session.id)}
		{#if session && typeof session === 'object' && 'id' in session && 'type' in session}
			<div
				class="session-slot"
				style="--animation-index: {index};"
				in:fly|global={{
					x: 0,
					y: isMobile ? 0 : 20,
					duration: isMobile ? 150 : 250,
					easing: cubicOut
				}}
				out:fly|global={{
					x: 0,
					y: isMobile ? 0 : -20,
					duration: isMobile ? 100 : 200,
					easing: cubicOut
				}}
				onclick={() => onSessionFocus(session)}
				onkeydown={(e) => e.key === 'Enter' && onSessionFocus(session)}
				role="button"
				tabindex="0"
				aria-label="Focus session {session.id}"
			>
				{@render sessionContainer(session, index)}
			</div>
		{/if}
	{/each}
</div>

<style>
	.session-grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), 1fr);
		gap: var(--space-1);
		height: 100%;
		overflow: hidden;
		padding: var(--space-1);
		min-width: 0;
		/* Prevent pull-to-refresh on the grid */
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	.session-slot {
		min-width: 0;
		position: relative;
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.session-grid {
			grid-template-columns: 1fr !important;
			padding: 0;
			gap: 0;
			height: 100%;
		}

		.session-slot {
			height: 100%;
			/* Smoother transitions for mobile */
			transition: opacity 0.15s ease-out;
			will-change: opacity;
			contain: layout style;
			/* Hardware acceleration */
			transform: translateZ(0);
			backface-visibility: hidden;
		}
	}

	/* Accessibility: reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.session-slot {
			transition: opacity 0.2s ease;
		}

		@starting-style {
			.session-slot {
				opacity: 0;
				transform: none;
			}
		}
	}
</style>
