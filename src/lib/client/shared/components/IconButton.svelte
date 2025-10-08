<script>
	/**
	 * IconButton Component - Simplified
	 * Icon-only button using unified button system with .btn--icon modifier
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
