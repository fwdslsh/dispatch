<script>
	/**
	 * @component IconButton
	 * @description
	 * Icon-only button variant using unified button system with .btn--icon modifier.
	 * Optimized for toolbar actions, close buttons, and compact interfaces.
	 * Automatically handles loading states and accessibility.
	 *
	 * @typedef {Object} IconButtonProps
	 * @property {'primary'|'ghost'|'warn'|'danger'} [variant='ghost'] - Visual variant
	 * @property {'small'|'medium'|'large'} [size='medium'] - Button size
	 * @property {boolean} [disabled=false] - Disabled state
	 * @property {boolean} [loading=false] - Loading state with spinner
	 * @property {string} ariaLabel - Required accessible label (no visual text)
	 * @property {(event: MouseEvent) => void} [onclick] - Click event handler
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic usage -->
	 * <IconButton ariaLabel="Close" onclick={handleClose}>
	 *   <IconX size={18} />
	 * </IconButton>
	 *
	 * <!-- Danger variant -->
	 * <IconButton variant="danger" ariaLabel="Delete" onclick={handleDelete}>
	 *   <IconTrash size={18} />
	 * </IconButton>
	 *
	 * <!-- With loading state -->
	 * <IconButton loading={isProcessing} ariaLabel="Processing">
	 *   <IconCheck size={18} />
	 * </IconButton>
	 * ```
	 *
	 * @fires {MouseEvent} click - Fired when button is clicked (not disabled/loading)
	 */

	// Props
	let {
		children = undefined,
		variant = 'ghost', // 'primary' | 'ghost' | 'warn' | 'danger'
		size = 'medium', // 'small' | 'medium' | 'large'
		disabled = false,
		loading = false,
		ariaLabel = undefined,
		onclick = undefined,
		class: customClass = '',
		...restProps
	} = $props();

	// Compute BEM-style classes
	const buttonClasses = $derived.by(() => {
		const classes = ['btn', 'btn--icon'];

		// Add variant modifier
		if (variant === 'primary') classes.push('btn--primary');
		else if (variant === 'danger') classes.push('btn--danger');
		else if (variant === 'warn') classes.push('btn--warn');
		else if (variant === 'ghost') classes.push('btn--ghost');

		// Add size modifier
		if (size === 'small') classes.push('btn--sm');
		else if (size === 'large') classes.push('btn--lg');

		// Add custom classes
		if (customClass) classes.push(...customClass.split(' '));

		return classes.join(' ');
	});
</script>

<button
	{disabled}
	class:loading
	aria-label={ariaLabel}
	{onclick}
	class={buttonClasses}
	{...restProps}
>
	{#if loading}
		<div class="spinner"></div>
	{:else if children}
		{@render children()}
	{/if}
</button>

<style>
	/* All icon button styles defined in buttons.css - no component-specific CSS needed */
</style>
