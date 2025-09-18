<!--
	MobileNavigation.svelte

	Mobile session navigation controls for switching between sessions
	Provides previous/next buttons and session counter
-->

<script>
	import IconButton from '../IconButton.svelte';
	import { IconPlayerTrackNext, IconPlayerTrackPrev } from '@tabler/icons-svelte';

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

	{#if totalSessions > 0}
		<span class="session-counter">
			{currentDisplay} / {totalSessions}
		</span>
	{/if}

	<IconButton class="bottom-btn nav-btn" onclick={handleNext} {disabled} aria-label="Next session">
		<IconPlayerTrackNext size={18} />
	</IconButton>
</div>

<style>
	.mobile-navigation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.session-counter {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		min-width: 40px;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0 0.25rem;
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

	/* Hide on desktop */
	@media (min-width: 769px) {
		.mobile-navigation {
			display: none;
		}
	}

	/* Very small screens - compact layout */
	@media (max-width: 480px) {
		.mobile-navigation {
			gap: 0.25rem;
		}

		.session-counter {
			min-width: 35px;
			font-size: 0.7rem;
		}
	}
</style>
