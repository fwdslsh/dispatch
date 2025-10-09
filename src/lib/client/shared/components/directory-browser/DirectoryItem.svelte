<script>
	import IconFolder from '../Icons/IconFolder.svelte';
	import IconFile from '../Icons/IconFile.svelte';
	import IconCheck from '../Icons/IconCheck.svelte';
	import IconButton from '../IconButton.svelte';

	/**
	 * DirectoryItem Component
	 *
	 * Renders a single directory or file entry.
	 * Handles navigation for directories, file opening, and selection.
	 */
	let {
		entry = null, // Directory entry object with { name, path, isDirectory }
		isSelected = false,
		loading = false,
		isAlwaysOpen = false,
		showFileActions = false,
		isParentDirectory = false, // Special case for ".." parent directory
		onNavigate = null,
		onSelect = null,
		onFileOpen = null
	} = $props();

	function handleClick() {
		if (isParentDirectory) {
			onNavigate?.();
		} else if (entry?.isDirectory) {
			onNavigate?.(entry.path);
		} else if (showFileActions && onFileOpen) {
			onFileOpen(entry);
		}
	}

	function handleSelect() {
		if (entry && !isParentDirectory) {
			onSelect?.(entry.path);
		}
	}
</script>

<div class="directory-item-enhanced {isSelected ? 'selected' : ''}">
	{#if isParentDirectory}
		<span class="directory-icon-enhanced"><IconFolder size={20} /></span>
		<button
			type="button"
			onclick={handleClick}
			disabled={loading}
			class="flex-1 text-left font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer"
		>
			..
		</button>
		<span class="text-xs text-muted opacity-75">parent directory</span>
	{:else if entry?.isDirectory}
		<span class="directory-icon-enhanced"><IconFolder size={20} /></span>
		<button
			type="button"
			onclick={handleClick}
			disabled={loading}
			class="flex-1 text-left font-medium cursor-pointer"
		>
			{entry.name}
		</button>
		<span class="text-xs text-muted opacity-75">directory</span>
		{#if !isAlwaysOpen}
			<div class="px-2">
				<IconButton
					type="button"
					onclick={handleSelect}
					disabled={loading}
					title="Select this directory"
					variant="ghost"
				>
					<IconCheck size={16} />
				</IconButton>
			</div>
		{/if}
	{:else if showFileActions && onFileOpen}
		<span class="directory-icon-enhanced"><IconFile size={20} /></span>
		<button
			type="button"
			class="flex-1 text-left font-medium bg-transparent border-none cursor-pointer hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
			onclick={handleClick}
			disabled={loading}
			title="Open file"
		>
			{entry?.name || ''}
		</button>
		<span class="text-xs text-muted opacity-75">file</span>
	{:else}
		<span class="directory-icon-enhanced"><IconFile size={20} /></span>
		<span class="flex-1 font-medium text-muted">{entry?.name || ''}</span>
		<span class="text-xs text-muted opacity-75">file</span>
	{/if}
</div>

<style>
	.directory-item-enhanced {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid transparent;
		position: relative;
	}

	.directory-item-enhanced:hover {
		background: color-mix(in oklab, var(--primary) 8%, transparent);
		border-color: color-mix(in oklab, var(--primary) 20%, transparent);
		transform: translateX(4px);
	}

	.directory-item-enhanced.selected {
		background: color-mix(in oklab, var(--primary) 15%, transparent);
		border-color: var(--primary);
		color: var(--primary);
	}

	.directory-icon-enhanced {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--space-5);
		height: var(--space-5);
		color: var(--accent-amber);
		transition: all 0.2s ease;
	}

	.directory-item-enhanced:hover .directory-icon-enhanced {
		color: var(--primary);
		transform: scale(1.1);
	}

	/* Fix button styles within directory items */
	.directory-item-enhanced button {
		color: var(--text);
		text-decoration: none;
		transition: color 0.2s ease;
		font-family: inherit;
		font-size: inherit;
		background-color: transparent;
		border: none;
	}

	.directory-item-enhanced button:hover:enabled {
		color: var(--primary);
		text-decoration: none;
	}

	.directory-item-enhanced button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}

	.directory-item-enhanced button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.directory-item-enhanced {
			padding: var(--space-4);
			min-height: var(--space-7); /* Better touch target */
		}

		.directory-item-enhanced button {
			min-height: 44px;
			display: flex;
			align-items: center;
		}

		/* Larger icons on mobile */
		.directory-icon-enhanced {
			width: 28px;
			height: 28px;
		}
	}
</style>
