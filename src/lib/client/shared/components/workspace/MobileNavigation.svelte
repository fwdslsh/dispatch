<!--
	MobileNavigation.svelte

	Mobile session navigation controls for switching between sessions
	Provides previous/next buttons and session counter
-->

<script>
	import IconButton from '../IconButton.svelte';
	import IconPlayerTrackNext from '../Icons/IconPlayerTrackNext.svelte';
	import IconPlayerTrackPrev from '../Icons/IconPlayerTrackPrev.svelte';

	// Props
	let {
		onNavigateSession = () => {},
		disabled = false,
		currentIndex = 0,
		totalSessions = 0
	} = $props();

	const currentDisplay = $derived(Math.min(currentIndex + 1, totalSessions));

	function handlePrevious() {
		onNavigateSession('prev');
	}

	function handleNext() {
		onNavigateSession('next');
	}
</script>

<div class="mobile-navigation">
	<IconButton
		class="bottom-btn nav-btn"
		onclick={handlePrevious}
		{disabled}
		aria-label="Previous session"
	>
		<IconPlayerTrackPrev size={18} />
	</IconButton>
	<!-- 
	{#if totalSessions > 0}
		<span class="session-counter">
			{currentDisplay} / {totalSessions}
		</span>
	{/if} -->

	<IconButton class="bottom-btn nav-btn" onclick={handleNext} {disabled} aria-label="Next session">
		<IconPlayerTrackNext size={18} />
	</IconButton>
</div>

<style>
	.mobile-navigation {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	:global(.nav-btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.nav-btn:disabled:hover) {
		background: var(--surface-hover) !important;
		border-color: var(--surface-border) !important;
		color: var(--text) !important;
		transform: none !important;
	}

	/* Mobile touch improvements */
	:global(.bottom-btn:active) {
		opacity: 0.8;
		transform: scale(0.95);
	}

	/* Hide on desktop */
	@media (min-width: 769px) {
		.mobile-navigation {
			display: none;
		}
	}

	/* Very small screens - compact layout */
	@media (max-width: 480px) {
		.mobile-navigation {
			gap: 0.75rem;
		}
	}

	/* Only apply touch styles on touch devices */
	@media (hover: none) and (pointer: coarse) {
		:global(.bottom-btn:active) {
			opacity: 0.8;
			transform: scale(0.95);
		}
	}
</style>
