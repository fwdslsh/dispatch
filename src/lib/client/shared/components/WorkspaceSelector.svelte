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
	/* Use CSS utility classes from retro.css - no additional styles needed */
</style>
