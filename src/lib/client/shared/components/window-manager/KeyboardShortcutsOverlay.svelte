<script>
	/**
	 * KeyboardShortcutsOverlay.svelte
	 *
	 * Discoverable keyboard shortcuts overlay for the WindowManager.
	 * Provides progressive disclosure of power user features.
	 */

	let {
		/** @type {boolean} */ visible = false,
		/** @type {() => void} */ onClose = () => {},
		/** @type {Record<string, string>} */ keymap = {}
	} = $props();

	// Comprehensive shortcut definitions with descriptions
	const shortcuts = [
		{
			action: 'Split Right',
			keys: ['Ctrl', 'Enter'],
			description: 'Create new pane to the right'
		},
		{
			action: 'Split Down',
			keys: ['Ctrl', 'Shift', 'Enter'],
			description: 'Create new pane below'
		},
		{
			action: 'Close Pane',
			keys: ['Ctrl', 'Shift', 'X'],
			description: 'Close current pane'
		},
		{
			action: 'Focus Next',
			keys: ['Alt', '→'],
			description: 'Move focus to next pane'
		},
		{
			action: 'Focus Previous',
			keys: ['Alt', '←'],
			description: 'Move focus to previous pane'
		},
		{
			action: 'Grow Height',
			keys: ['Ctrl', '↑'],
			description: 'Increase pane height'
		},
		{
			action: 'Shrink Height',
			keys: ['Ctrl', '↓'],
			description: 'Decrease pane height'
		},
		{
			action: 'Show Help',
			keys: ['?'],
			description: 'Toggle this help overlay'
		}
	];

	// Handle escape key to close
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	// Handle backdrop keyboard events
	function handleBackdropKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<!-- Backdrop -->
	<div
		class="wm-shortcuts-backdrop"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		role="button"
		tabindex="0"
		aria-label="Close keyboard shortcuts"
	></div>

	<!-- Overlay -->
	<div
		class="wm-shortcuts-overlay visible"
		role="dialog"
		aria-labelledby="shortcuts-title"
		aria-modal="true"
	>
		<header class="wm-shortcuts-header">
			<h2 id="shortcuts-title" class="wm-shortcuts-title">⌨️ Keyboard Shortcuts</h2>
			<button class="wm-shortcuts-close" onclick={() => onClose()} aria-label="Close shortcuts"> ✕ </button>
		</header>

		<div class="wm-shortcuts-grid">
			{#each shortcuts as shortcut}
				<div class="wm-shortcut-item">
					<div class="wm-shortcut-action">
						{shortcut.action}
						<div class="wm-shortcut-description">
							{shortcut.description}
						</div>
					</div>
					<div class="wm-shortcut-keys">
						{#each shortcut.keys as key, index}
							<span class="wm-shortcut-key">{key}</span>
							{#if index < shortcut.keys.length - 1}
								<span class="wm-shortcut-plus">+</span>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<footer class="wm-shortcuts-footer">
			<p>Pro tip: Hold <span class="wm-shortcut-key">?</span> to show/hide this overlay</p>
		</footer>
	</div>
{/if}

<style>
	.wm-shortcuts-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		z-index: 999;
		animation: fade-in 0.2s ease-out;
	}

	.wm-shortcut-description {
		font-size: var(--font-size-0);
		color: var(--text-dim);
		margin-top: 2px;
		font-weight: normal;
	}

	/* Animation for backdrop */
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.wm-shortcuts-grid {
			grid-template-columns: 1fr;
		}

		.wm-shortcut-item {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-2);
		}

		.wm-shortcut-keys {
			align-self: flex-end;
		}
	}
</style>
