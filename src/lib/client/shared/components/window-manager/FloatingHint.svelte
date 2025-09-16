<script>
	/**
	 * FloatingHint.svelte
	 *
	 * Subtle floating hint that appears on hover to guide new users.
	 * Progressive disclosure pattern - only shows when needed.
	 */

	let {
		/** @type {boolean} */ show = false,
		/** @type {string} */ message = 'Press ? for keyboard shortcuts',
		/** @type {'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'} */ position = 'top-right'
	} = $props();

	// Auto-hide after a delay
	let hideTimeout;
	let visible = $state(false);

	$effect(() => {
		if (show) {
			visible = true;
			clearTimeout(hideTimeout);
			hideTimeout = setTimeout(() => {
				visible = false;
			}, 3000); // Hide after 3 seconds
		} else {
			clearTimeout(hideTimeout);
			visible = false;
		}

		return () => clearTimeout(hideTimeout);
	});
</script>

{#if visible}
	<div
		class="wm-floating-hint"
		class:position-top-right={position === 'top-right'}
		class:position-top-left={position === 'top-left'}
		class:position-bottom-right={position === 'bottom-right'}
		class:position-bottom-left={position === 'bottom-left'}
		role="tooltip"
		aria-live="polite"
	>
		<div class="hint-content">
			{message}
		</div>
		<div class="hint-arrow"></div>
	</div>
{/if}

<style>
	.wm-floating-hint {
		position: absolute;
		z-index: 100;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 8px;
		padding: var(--space-2) var(--space-3);
		font-size: var(--font-size-0);
		color: var(--text-primary);
		white-space: nowrap;
		backdrop-filter: blur(8px);
		box-shadow:
			0 0 0 1px var(--primary-glow),
			0 4px 12px rgba(0, 0, 0, 0.2);

		/* Animation */
		opacity: 0;
		transform: translateY(-10px) scale(0.95);
		animation: hint-appear 0.3s cubic-bezier(0.23, 1, 0.32, 1) 0.5s forwards;
	}

	/* Positioning */
	.position-top-right {
		top: var(--space-3);
		right: var(--space-3);
	}

	.position-top-left {
		top: var(--space-3);
		left: var(--space-3);
	}

	.position-bottom-right {
		bottom: var(--space-3);
		right: var(--space-3);
	}

	.position-bottom-left {
		bottom: var(--space-3);
		left: var(--space-3);
	}

	.hint-content {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-weight: 500;
	}

	/* Subtle arrow pointer */
	.hint-arrow {
		position: absolute;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	.position-top-right .hint-arrow,
	.position-top-left .hint-arrow {
		top: -6px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-bottom: 6px solid var(--accent);
	}

	.position-bottom-right .hint-arrow,
	.position-bottom-left .hint-arrow {
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%);
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-top: 6px solid var(--accent);
	}

	/* Animations */
	@keyframes hint-appear {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Glow effect */
	.wm-floating-hint::before {
		content: '';
		position: absolute;
		top: -2px;
		left: -2px;
		right: -2px;
		bottom: -2px;
		background: var(--accent);
		border-radius: 10px;
		opacity: 0.3;
		filter: blur(4px);
		z-index: -1;
		animation: glow-pulse 2s ease-in-out infinite;
	}

	@keyframes glow-pulse {
		0%,
		100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.4;
		}
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.wm-floating-hint {
			animation: none;
			opacity: 1;
			transform: none;
		}

		.wm-floating-hint::before {
			animation: none;
		}
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.wm-floating-hint {
			display: none; /* Hide on mobile to reduce clutter */
		}
	}
</style>
