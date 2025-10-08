<script>
	/**
	 * WorkspaceSelector Component
	 * Directory picker with dropdown functionality
	 */
	import IconFolder from './Icons/IconFolder.svelte';
	import IconChevronDown from './Icons/IconChevronDown.svelte';

	// Props
	let {
		selectedPath = $bindable(''),
		disabled = false,
		placeholder = 'Select directory...',
		augmented = 'tl-clip br-clip both',
		onClick = undefined,
		class: customClass = '',
		...restProps
	} = $props();

	// Format path for display
	function formatPath(path) {
		if (!path) return placeholder;
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-2).join('/');
		}
		return path;
	}

	// Handle click
	function handleClick() {
		if (disabled || !onClick) return;
		onClick();
	}
</script>

<button
	type="button"
	class="workspace-selector {customClass}"
	{disabled}
	data-augmented-ui={augmented}
	onclick={handleClick}
	{...restProps}
>
	<span class="workspace-selector__icon">
		<IconFolder size={20} />
	</span>
	<span class="workspace-selector__path">{formatPath(selectedPath)}</span>
	<span class="workspace-selector__arrow">
		<IconChevronDown size={16} />
	</span>
</button>

<style>
	/* Workspace/Directory Selector Component Styles */
	.workspace-selector {
		width: 100%;
		padding: 1rem 1.25rem;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
			color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%)
		);
		border: 2px solid var(--surface-border);
		border-radius: 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		position: relative;
		overflow: hidden;
	}

	.workspace-selector:hover:not(:disabled) {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 15%, var(--surface)),
			color-mix(in oklab, var(--primary) 8%, var(--surface))
		);
		border-color: var(--primary);
		box-shadow:
			0 0 20px var(--primary-glow-20),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.workspace-selector__icon {
		font-size: 1.2em;
		color: var(--primary);
		filter: drop-shadow(0 0 6px var(--primary-glow-30));
	}

	.workspace-selector:hover:not(:disabled) .workspace-selector__icon {
		filter: drop-shadow(0 0 10px var(--primary-glow-50));
		transform: scale(1.1);
	}

	.workspace-selector__path {
		flex: 1;
	}

	.workspace-selector__arrow {
		color: var(--text-muted);
		transition: transform 0.3s ease;
	}

	.workspace-selector:hover:not(:disabled) .workspace-selector__arrow {
		transform: translateY(2px);
		color: var(--primary);
	}

	.workspace-selector:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
