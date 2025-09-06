<script>
	// Props
	let { command = {}, selected = false, onSelect = () => {}, onExecute = () => {} } = $props();

	// Derived properties for safety
	let name = $derived(command.name || '');
	let description = $derived(command.description || '');
	let category = $derived(command.category || '');
	let shortcut = $derived(command.shortcut || '');

	function handleClick() {
		onExecute();
	}

	function handleMouseEnter() {
		onSelect();
	}
</script>

<div
	class="command-item"
	class:selected
	role="option"
	aria-selected={selected}
	on:click={handleClick}
	on:mouseenter={handleMouseEnter}
>
	<div class="command-main">
		<div class="command-name">{name}</div>
		{#if description}
			<div class="command-description">{description}</div>
		{/if}
	</div>

	{#if category || shortcut}
		<div class="command-meta">
			{#if category}
				<div class="command-category">{category}</div>
			{/if}
			{#if shortcut}
				<div class="command-shortcut">{shortcut}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.command-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md);
		cursor: pointer;
		border-bottom: 1px solid var(--border);
		transition: all 0.15s ease;
		gap: var(--space-md);
	}

	.command-item:hover,
	.command-item.selected {
		background: var(--surface-hover);
		border-left: 3px solid var(--primary);
	}

	.command-item:last-child {
		border-bottom: none;
	}

	.command-main {
		flex: 1;
		min-width: 0;
	}

	.command-name {
		font-weight: 600;
		color: var(--text-primary);
		font-family: var(--font-mono);
		margin-bottom: var(--space-xs);
		word-break: break-word;
	}

	.command-description {
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.3;
		word-break: break-word;
	}

	.command-meta {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-shrink: 0;
	}

	.command-category {
		background: var(--primary-muted);
		color: var(--primary);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.command-shortcut {
		background: var(--bg-darker);
		color: var(--text-muted);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		border: 1px solid var(--border);
		white-space: nowrap;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.command-item {
			padding: var(--space-sm) var(--space-md);
		}

		.command-meta {
			flex-direction: column;
			align-items: flex-end;
			gap: var(--space-xs);
		}

		.command-name {
			font-size: 0.95rem;
		}

		.command-description {
			font-size: 0.85rem;
		}

		.command-category,
		.command-shortcut {
			font-size: 0.7rem;
		}
	}

	/* Focus and keyboard navigation styles */
	@media (prefers-reduced-motion: no-preference) {
		.command-item {
			transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.command-item.selected {
			border-left-width: 4px;
		}
	}

	/* Touch devices - larger tap targets */
	@media (pointer: coarse) {
		.command-item {
			padding: var(--space-md) var(--space-lg);
			min-height: 60px;
		}
	}
</style>
