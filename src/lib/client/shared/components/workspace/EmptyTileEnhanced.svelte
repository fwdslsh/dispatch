<!--
	EmptyTileEnhanced.svelte

	Enhanced empty tile component with progressive disclosure and UX improvements
	Based on frontend design expert recommendations
-->
<script>
	import { onMount } from 'svelte';
	import Button from '../Button.svelte';
	import { IconTerminal, IconPlus, IconKeyboard } from '@tabler/icons-svelte';
	import IconClaude from '../Icons/IconClaude.svelte';

	// Props
	let {
		focused = false,
		onCreateSession = () => {},
		onShowShortcuts = () => {},
		tileId = null
	} = $props();

	// State
	let showHint = $state(false);
	let mounted = $state(false);

	// Show hint when focused for the first time
	let hasBeenFocused = $state(false);
	$effect(() => {
		if (focused && !hasBeenFocused && mounted) {
			hasBeenFocused = true;
			showHint = true;
			// Auto-hide after 3 seconds
			setTimeout(() => {
				showHint = false;
			}, 3000);
		}
	});

	// Handle keyboard shortcuts
	function handleKeydown(event) {
		if (!focused) return;

		switch (event.key.toLowerCase()) {
			case 't':
				event.preventDefault();
				onCreateSession('terminal', tileId);
				break;
			case 'c':
				event.preventDefault();
				onCreateSession('claude', tileId);
				break;
			case '?':
				event.preventDefault();
				onShowShortcuts();
				break;
		}
	}

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="empty-tile-enhanced"
	class:focused
	class:show-hint={showHint}
	role="button"
	tabindex="0"
	aria-label="Empty tile - create a new session"
>
	<!-- Floating hint -->
	{#if showHint}
		<div class="floating-hint" role="tooltip">
			<div class="hint-content">
				<div class="hint-title">Quick Create</div>
				<div class="hint-shortcuts">
					<kbd>T</kbd> Terminal
					<kbd>C</kbd> Claude
					<kbd>?</kbd> Help
				</div>
			</div>
		</div>
	{/if}

	<div class="empty-content">
		<!-- Main content - shown when not focused -->
		<div class="main-content" class:hidden={focused}>
			<div class="empty-icon">
				<IconPlus size={24} />
			</div>
			<h3>Add Session</h3>
			<p>Click to create a new session</p>
		</div>

		<!-- Focused content - shown when focused -->
		<div class="focused-content" class:visible={focused}>
			<div class="focused-title">
				<IconPlus size={20} />
				<span>Create New Session</span>
			</div>

			<div class="action-buttons">
				<Button
					variant="primary"
					onclick={() => onCreateSession('terminal', tileId)}
					aria-label="Create terminal session (T key)"
				>
					<IconTerminal size={16} />
					Terminal
					<kbd class="key-hint">T</kbd>
				</Button>

				<Button
					variant="secondary"
					onclick={() => onCreateSession('claude', tileId)}
					aria-label="Create Claude session (C key)"
				>
					<IconClaude size={16} />
					Claude
					<kbd class="key-hint">C</kbd>
				</Button>
			</div>

			<div class="help-section">
				<button
					class="help-button"
					onclick={() => onShowShortcuts()}
					aria-label="Show keyboard shortcuts (? key)"
				>
					<IconKeyboard size={14} />
					<span>Shortcuts</span>
					<kbd class="key-hint">?</kbd>
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.empty-tile-enhanced {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed var(--surface-border, #333);
		border-radius: 8px;
		background: var(--surface-hover, #2a2a2a);
		transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
		cursor: pointer;
		overflow: hidden;
		min-height: 200px;
	}

	.empty-tile-enhanced:hover {
		border-color: var(--primary-muted, #0066cc80);
		background: var(--surface-active, #333);
		transform: translateY(-1px);
	}

	.empty-tile-enhanced.focused {
		border-color: var(--primary, #0066cc);
		background: var(--primary-alpha, #0066cc10);
		box-shadow:
			0 0 0 1px var(--primary-alpha, #0066cc20),
			0 4px 12px rgba(0, 102, 204, 0.15);
		transform: translateY(-2px);
	}

	.floating-hint {
		position: absolute;
		top: 12px;
		right: 12px;
		background: var(--surface-elevated, #333);
		border: 1px solid var(--surface-border, #444);
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 0.75rem;
		z-index: 10;
		backdrop-filter: blur(8px);
		animation: slideInFade 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	@keyframes slideInFade {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.hint-content {
		text-align: center;
	}

	.hint-title {
		font-weight: 600;
		color: var(--text-primary, #fff);
		margin-bottom: 4px;
	}

	.hint-shortcuts {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		color: var(--text-muted, #888);
	}

	.hint-shortcuts kbd {
		background: var(--surface-active, #444);
		border: 1px solid var(--surface-border, #555);
		border-radius: 3px;
		padding: 2px 4px;
		font-family: var(--font-mono, monospace);
		font-size: 0.65rem;
		color: var(--text-primary, #fff);
		min-width: 16px;
		text-align: center;
	}

	.empty-content {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.main-content {
		text-align: center;
		transition: opacity 0.2s ease;
		padding: 2rem;
	}

	.main-content.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.empty-icon {
		margin: 0 auto 1rem;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--primary-alpha, #0066cc20);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--primary, #0066cc);
	}

	.main-content h3 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary, #fff);
		font-size: 1.1rem;
		font-weight: 600;
	}

	.main-content p {
		margin: 0;
		color: var(--text-muted, #888);
		font-size: 0.9rem;
	}

	.focused-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 2rem;
		opacity: 0;
		transform: translateY(8px);
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		pointer-events: none;
	}

	.focused-content.visible {
		opacity: 1;
		transform: translateY(0);
		pointer-events: auto;
	}

	.focused-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-primary, #fff);
		font-weight: 600;
		font-size: 1rem;
	}

	.action-buttons {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.action-buttons :global(.button) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		min-width: 120px;
		position: relative;
	}

	.key-hint {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		padding: 2px 4px;
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		font-weight: 500;
		margin-left: auto;
		min-width: 16px;
		text-align: center;
	}

	.help-section {
		margin-top: 0.5rem;
	}

	.help-button {
		background: transparent;
		border: 1px solid var(--surface-border, #444);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		color: var(--text-muted, #888);
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.help-button:hover {
		border-color: var(--primary-muted, #0066cc80);
		color: var(--text-primary, #fff);
		background: var(--surface-active, #333);
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.empty-tile-enhanced,
		.floating-hint,
		.main-content,
		.focused-content {
			transition: opacity 0.2s ease;
		}

		.empty-tile-enhanced:hover,
		.empty-tile-enhanced.focused {
			transform: none;
		}
	}

	/* High contrast support */
	@media (prefers-contrast: high) {
		.empty-tile-enhanced {
			border-width: 3px;
		}

		.empty-tile-enhanced.focused {
			box-shadow: 0 0 0 2px var(--primary);
		}
	}
</style>
