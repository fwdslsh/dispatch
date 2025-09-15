<!--
	CreateSessionButton.svelte

	Main create session button in the status bar
	Prominent circular button with plus icon and pulsing animation
-->
<script>
	// Props
	let {
		onCreateSession = () => {}
	} = $props();

	function handleClick() {
		// Default to Claude session creation
		onCreateSession('claude');
	}
</script>

<button
	class="create-session-btn"
	onclick={handleClick}
	aria-label="Create new session"
	title="Create new session"
>
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<line x1="12" y1="5" x2="12" y2="19"></line>
		<line x1="5" y1="12" x2="19" y2="12"></line>
	</svg>
</button>

<style>
	.create-session-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		background: var(--primary);
		border: 2px solid var(--primary);
		border-radius: 50%;
		color: var(--bg);
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(46, 230, 107, 0.3);
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		animation: pulse 2s infinite;
		position: relative;
	}

	.create-session-btn:hover {
		background: color-mix(in oklab, var(--primary) 90%, white 10%);
		transform: scale(1.1);
		box-shadow: 0 4px 12px rgba(46, 230, 107, 0.4);
	}

	.create-session-btn:active {
		transform: scale(0.95);
	}

	.create-session-btn svg {
		width: 24px;
		height: 24px;
		stroke-width: 2.5;
	}

	/* Pulsing animation */
	@keyframes pulse {
		0%, 100% {
			box-shadow: 0 2px 8px rgba(46, 230, 107, 0.3);
		}
		50% {
			box-shadow: 0 4px 16px rgba(46, 230, 107, 0.5);
		}
	}

	/* Disable animation on reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.create-session-btn {
			animation: none;
		}
	}

	/* Mobile touch optimization */
	@media (hover: none) and (pointer: coarse) {
		.create-session-btn {
			width: 44px;
			height: 44px;
		}

		.create-session-btn:active {
			transform: scale(0.9);
		}
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.create-session-btn {
			width: 36px;
			height: 36px;
		}

		.create-session-btn svg {
			width: 20px;
			height: 20px;
		}
	}
</style>