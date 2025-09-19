<script>
	/**
	 * EmptyTile.svelte
	 *
	 * Enhanced empty tile component with progressive disclosure and clear actions.
	 * Provides intuitive ways to create new sessions.
	 */

	let {
		/** @type {string} */ tileId,
		/** @type {boolean} */ focused = false,
		/** @type {(type: 'pty' | 'claude') => void} */ onCreateSession = () => {},
		/** @type {() => void} */ onShowHelp = () => {}
	} = $props();

	// Animation state
	let hovering = $state(false);
	let animationKey = $state(0);

	// Handle keyboard interactions
	function handleKeydown(event) {
		if (!focused) return;

		switch (event.key) {
			case 't':
			case 'T':
				event.preventDefault();
				onCreateSession('pty');
				break;
			case 'c':
			case 'C':
				event.preventDefault();
				onCreateSession('claude');
				break;
			case '?':
				event.preventDefault();
				onShowHelp();
				break;
		}
	}

	// Pulse animation trigger
	function triggerPulse() {
		animationKey = Date.now();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div
	class="wm-empty-tile"
	class:focused
	class:hovering
	data-tile-id={tileId}
	onmouseenter={() => (hovering = true)}
	onmouseleave={() => (hovering = false)}
	role="button"
	tabindex="0"
	aria-label="Empty tile - press T for terminal, C for Claude, or ? for help"
>
	<!-- Animated icon -->
	<div class="wm-empty-tile-icon" data-animation-key={animationKey}>
		{#if focused}
			<span class="icon-pulse">⚡</span>
		{:else if hovering}
			<span class="icon-hover">➕</span>
		{:else}
			<span class="icon-default">○</span>
		{/if}
	</div>

	<!-- Content -->
	<h3 class="wm-empty-tile-title">
		{focused ? 'Ready to Create' : 'Empty Pane'}
	</h3>

	<p class="wm-empty-tile-description">
		{#if focused}
			Press <strong>T</strong> for Terminal or <strong>C</strong> for Claude
		{:else}
			Click to create a new session
		{/if}
	</p>

	<!-- Actions -->
	<div class="wm-empty-tile-actions">
		<button
			class="wm-empty-tile-action wm-action-terminal"
			onclick={() => onCreateSession('pty')}
			onfocus={triggerPulse}
		>
			<span class="action-icon">🖥️</span>
			<span>Terminal</span>
			{#if focused}
				<span class="action-shortcut">T</span>
			{/if}
		</button>

		<button
			class="wm-empty-tile-action wm-action-claude"
			onclick={() => onCreateSession('claude')}
			onfocus={triggerPulse}
		>
			<span class="action-icon">🤖</span>
			<span>Claude</span>
			{#if focused}
				<span class="action-shortcut">C</span>
			{/if}
		</button>
	</div>

	<!-- Focused help hint -->
	{#if focused}
		<div class="wm-empty-tile-help">
			<button class="wm-help-button" onclick={() => onShowHelp()} aria-label="Show keyboard shortcuts">
				<span>?</span> Show all shortcuts
			</button>
		</div>
	{/if}
</div>

<style>
	.wm-empty-tile {
		position: relative;
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		outline: none;
	}

	.wm-empty-tile.focused {
		border-color: var(--accent);
		background: var(--elev);
		box-shadow: 0 0 0 2px var(--primary-glow);
	}

	.wm-empty-tile.focused::before {
		content: '';
		position: absolute;
		top: -4px;
		left: -4px;
		right: -4px;
		bottom: -4px;
		border: 2px solid var(--accent);
		border-radius: 12px;
		opacity: 0.3;
		animation: focus-pulse 2s ease-in-out infinite;
	}

	/* Icon animations */
	.wm-empty-tile-icon {
		position: relative;
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.icon-pulse {
		animation: icon-bounce 0.6s ease-in-out;
		color: var(--accent);
	}

	.icon-hover {
		color: var(--primary-dim);
		transform: scale(1.1);
	}

	.icon-default {
		opacity: 0.4;
	}

	/* Enhanced action buttons */
	.wm-empty-tile-action {
		position: relative;
		overflow: hidden;
	}

	.wm-empty-tile-action::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
		transition: left 0.5s ease;
	}

	.wm-empty-tile-action:hover::before {
		left: 100%;
	}

	.wm-action-terminal:hover {
		background: var(--accent-cyan);
		border-color: var(--accent-cyan);
		color: var(--bg);
		box-shadow: 0 4px 12px rgba(0, 194, 255, 0.3);
	}

	.wm-action-claude:hover {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--bg);
		box-shadow: 0 4px 12px var(--primary-glow);
	}

	.action-icon {
		font-size: 1.2em;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
	}

	.action-shortcut {
		background: rgba(0, 0, 0, 0.2);
		padding: 2px 6px;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		margin-left: auto;
		backdrop-filter: blur(4px);
	}

	/* Help section */
	.wm-empty-tile-help {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
		opacity: 0;
		transform: translateY(10px);
		animation: help-appear 0.3s ease-out 0.2s forwards;
	}

	.wm-help-button {
		background: none;
		border: 1px solid var(--line);
		color: var(--text-muted);
		padding: var(--space-1) var(--space-2);
		border-radius: 4px;
		font-size: var(--font-size-0);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.wm-help-button:hover {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--bg);
	}

	/* Animations */
	@keyframes focus-pulse {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(1.02);
		}
	}

	@keyframes icon-bounce {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.3);
		}
	}

	@keyframes help-appear {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Accessibility improvements */
	@media (prefers-reduced-motion: reduce) {
		.wm-empty-tile,
		.wm-empty-tile-icon,
		.wm-empty-tile-action,
		.wm-empty-tile-help {
			animation: none;
			transition: none;
		}

		.wm-empty-tile.focused::before {
			animation: none;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.wm-empty-tile {
			border-width: 3px;
		}

		.wm-empty-tile.focused {
			border-width: 4px;
		}

		.wm-empty-tile-action {
			border-width: 2px;
		}
	}
</style>
