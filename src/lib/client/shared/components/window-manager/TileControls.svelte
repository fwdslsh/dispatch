<!--
	TileControls.svelte
	
	UI controls for tile management in edit mode
-->
<script>
	import IconButton from '../IconButton.svelte';
	import IconX from '../Icons/IconX.svelte';
	import IconArrowRight from '../Icons/IconArrowRight.svelte';
	import IconArrowDown from '../Icons/IconArrowDown.svelte';

	let {
		/** @type {boolean} */ visible = false,
		/** @type {() => void} */ onSplitRight = () => {},
		/** @type {() => void} */ onSplitDown = () => {},
		/** @type {() => void} */ onClose = () => {}
	} = $props();
</script>

{#if visible}
	<div class="tile-controls">
		<div class="tile-controls-group">
			<IconButton
				onclick={onSplitRight}
				variant="secondary"
				size="small"
				ariaLabel="Split tile to the right"
				title="Split Right"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<rect
						x="1"
						y="2"
						width="6"
						height="12"
						rx="1"
						stroke="currentColor"
						fill="none"
						stroke-width="1.5"
					/>
					<rect
						x="9"
						y="2"
						width="6"
						height="12"
						rx="1"
						stroke="currentColor"
						fill="none"
						stroke-width="1.5"
					/>
				</svg>
			</IconButton>

			<IconButton
				onclick={onSplitDown}
				variant="secondary"
				size="small"
				ariaLabel="Split tile downward"
				title="Split Down"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<rect
						x="2"
						y="1"
						width="12"
						height="6"
						rx="1"
						stroke="currentColor"
						fill="none"
						stroke-width="1.5"
					/>
					<rect
						x="2"
						y="9"
						width="12"
						height="6"
						rx="1"
						stroke="currentColor"
						fill="none"
						stroke-width="1.5"
					/>
				</svg>
			</IconButton>

			<IconButton
				onclick={onClose}
				variant="danger"
				size="small"
				ariaLabel="Close this tile"
				title="Close Tile"
			>
				<IconX size={16} />
			</IconButton>
		</div>
	</div>
{/if}

<style>
	.tile-controls {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		z-index: 10;
		background: var(--surface-raised);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		padding: var(--space-1);
		box-shadow: var(--shadow-sm);
		backdrop-filter: blur(4px);
	}

	.tile-controls-group {
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}

	/* Ensure controls are visible above tile content */
	.tile-controls :global(.btn-icon-only) {
		min-width: 32px;
		height: 32px;
		padding: var(--space-1);
	}

	/* Make controls slightly transparent when not hovered */
	.tile-controls {
		opacity: 0.9;
		transition: opacity 0.2s ease;
	}

	.tile-controls:hover {
		opacity: 1;
	}
</style>
