<script>
	/**
	 * StatusBadge Component
	 * Displays status indicators with semantic color variants
	 *
	 * Used across settings sections for consistent status display
	 * Replaces duplicate status badge patterns
	 */

	let {
		// Variant determines color and meaning
		variant = 'default', // 'default' | 'active' | 'inactive' | 'error' | 'warning' | 'success' | 'info' | 'enabled' | 'disabled' | 'failed'

		// Content
		children,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Map semantic variants to CSS classes
	const variantClass = $derived(`status-badge ${variant}`);
</script>

<span class="{variantClass} {customClass}" {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</span>
