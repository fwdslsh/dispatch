<script>
	/**
	 * IconButton Component
	 * Icon-only button for close, actions, etc.
	 */
	// Props
	let {
		children = undefined,
		variant = 'ghost',
		size = 'medium',
		disabled = false,
		loading = false,
		ariaLabel = undefined,
		onclick = undefined,
		class: customClass = '',
		...restProps
	} = $props();
</script>

<button
	{disabled}
	class:loading
	aria-labelledby={ariaLabel}
	{onclick}
	class="btn-icon-only fade-in {customClass} {variant}"
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</button>

<style>
	/* IconButton component uses utility classes - no additional styles needed */
</style>
