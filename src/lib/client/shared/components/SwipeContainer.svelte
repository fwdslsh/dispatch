<script>
	/**
	 * SwipeContainer Component
	 *
	 * Enables swipe gesture navigation for touch devices.
	 * Provides horizontal swipe detection with visual feedback.
	 *
	 * @file src/lib/client/shared/components/SwipeContainer.svelte
	 */
	import { onMount } from 'svelte';

	let {
		/** @type {import('svelte').Snippet} */
		children,
		/** @type {(direction: 'left' | 'right') => void} */
		onSwipe = () => {},
		/** @type {boolean} */
		enabled = true,
		/** @type {number} Minimum distance to trigger swipe */
		threshold = 50,
		/** @type {number} Maximum vertical movement allowed */
		maxVerticalMovement = 100,
		/** @type {boolean} Show visual edge indicators */
		showIndicators = true,
		/** @type {boolean} Can swipe left */
		canSwipeLeft = true,
		/** @type {boolean} Can swipe right */
		canSwipeRight = true
	} = $props();

	// Touch tracking state
	let startX = $state(0);
	let startY = $state(0);
	let currentX = $state(0);
	let isSwiping = $state(false);
	let swipeDirection = $state(null);
	let containerRef = $state(null);

	// Calculated swipe distance
	const swipeDistance = $derived(isSwiping ? currentX - startX : 0);
	const swipeProgress = $derived(Math.min(1, Math.abs(swipeDistance) / (threshold * 2)));

	function handleTouchStart(e) {
		if (!enabled) return;

		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		currentX = touch.clientX;
		isSwiping = false;
		swipeDirection = null;
	}

	function handleTouchMove(e) {
		if (!enabled || startX === 0) return;

		const touch = e.touches[0];
		const deltaX = touch.clientX - startX;
		const deltaY = Math.abs(touch.clientY - startY);

		// Cancel if too much vertical movement (scrolling)
		if (deltaY > maxVerticalMovement) {
			resetSwipe();
			return;
		}

		// Check if this direction is allowed
		const direction = deltaX > 0 ? 'right' : 'left';
		if ((direction === 'left' && !canSwipeLeft) || (direction === 'right' && !canSwipeRight)) {
			return;
		}

		// Start tracking swipe
		if (Math.abs(deltaX) > 10) {
			isSwiping = true;
			swipeDirection = direction;
			currentX = touch.clientX;

			// Prevent scrolling while swiping
			if (Math.abs(deltaX) > deltaY) {
				e.preventDefault();
			}
		}
	}

	function handleTouchEnd() {
		if (!enabled || !isSwiping) {
			resetSwipe();
			return;
		}

		const distance = currentX - startX;

		// Trigger swipe if threshold met
		if (Math.abs(distance) >= threshold) {
			const direction = distance > 0 ? 'right' : 'left';
			onSwipe(direction);

			// Haptic feedback if available
			if (navigator.vibrate) {
				navigator.vibrate(10);
			}
		}

		resetSwipe();
	}

	function resetSwipe() {
		startX = 0;
		startY = 0;
		currentX = 0;
		isSwiping = false;
		swipeDirection = null;
	}

	// Prevent default touch behavior that might interfere
	function handleTouchCancel() {
		resetSwipe();
	}
</script>

<div
	bind:this={containerRef}
	class="swipe-container"
	class:swiping={isSwiping}
	class:swipe-left={swipeDirection === 'left'}
	class:swipe-right={swipeDirection === 'right'}
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	ontouchcancel={handleTouchCancel}
	style:--swipe-distance="{swipeDistance}px"
	style:--swipe-progress={swipeProgress}
>
	<!-- Left edge indicator -->
	{#if showIndicators && canSwipeRight}
		<div
			class="swipe-indicator left"
			class:active={swipeDirection === 'right' && swipeProgress > 0.3}
		>
			<span class="indicator-arrow">‹</span>
		</div>
	{/if}

	<!-- Content -->
	<div class="swipe-content" class:swiping={isSwiping}>
		{@render children()}
	</div>

	<!-- Right edge indicator -->
	{#if showIndicators && canSwipeLeft}
		<div
			class="swipe-indicator right"
			class:active={swipeDirection === 'left' && swipeProgress > 0.3}
		>
			<span class="indicator-arrow">›</span>
		</div>
	{/if}
</div>

<style>
	.swipe-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		touch-action: pan-y pinch-zoom;
	}

	.swipe-content {
		width: 100%;
		height: 100%;
		transition: transform 0.1s ease-out;
	}

	.swipe-content.swiping {
		transform: translateX(calc(var(--swipe-distance) * 0.3));
		transition: none;
	}

	/* Edge indicators */
	.swipe-indicator {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 40px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		opacity: 0;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		z-index: 10;
	}

	.swipe-indicator.left {
		left: 0;
		background: linear-gradient(to right, var(--primary-glow-20), transparent);
		border-radius: 0 var(--radius) var(--radius) 0;
		transform: translateY(-50%) translateX(-100%);
	}

	.swipe-indicator.right {
		right: 0;
		background: linear-gradient(to left, var(--primary-glow-20), transparent);
		border-radius: var(--radius) 0 0 var(--radius);
		transform: translateY(-50%) translateX(100%);
	}

	.swipe-container.swipe-right .swipe-indicator.left,
	.swipe-container.swipe-left .swipe-indicator.right {
		opacity: calc(var(--swipe-progress) * 0.8);
		transform: translateY(-50%) translateX(0);
	}

	.swipe-indicator.active {
		opacity: 1;
	}

	.swipe-indicator.active .indicator-arrow {
		animation: pulse-arrow 0.5s ease-in-out infinite;
	}

	.indicator-arrow {
		font-size: 24px;
		color: var(--primary);
		font-weight: bold;
		text-shadow: 0 0 10px var(--primary-glow-40);
	}

	@keyframes pulse-arrow {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.2);
		}
	}

	/* Disable on desktop */
	@media (hover: hover) and (pointer: fine) {
		.swipe-indicator {
			display: none;
		}

		.swipe-content.swiping {
			transform: none;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.swipe-content,
		.swipe-indicator {
			transition: none;
		}

		.swipe-indicator.active .indicator-arrow {
			animation: none;
		}
	}
</style>
