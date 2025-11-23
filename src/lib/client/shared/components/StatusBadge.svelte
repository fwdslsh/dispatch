<script>
	/**
	 * @component StatusBadge
	 * @description
	 * Displays status indicators with semantic color variants.
	 * Used across settings sections for consistent status display.
	 * Provides visual feedback for state, health, and availability.
	 *
	 * @typedef {Object} StatusBadgeProps
	 * @property {'default'|'active'|'inactive'|'error'|'warning'|'success'|'info'|'enabled'|'disabled'|'failed'} [variant='default'] - Status variant determines color and meaning
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic status indicators -->
	 * <StatusBadge variant="active">Active</StatusBadge>
	 * <StatusBadge variant="inactive">Inactive</StatusBadge>
	 *
	 * <!-- Health indicators -->
	 * <StatusBadge variant="success">Healthy</StatusBadge>
	 * <StatusBadge variant="warning">Degraded</StatusBadge>
	 * <StatusBadge variant="error">Failed</StatusBadge>
	 *
	 * <!-- Feature flags -->
	 * <StatusBadge variant="enabled">Enabled</StatusBadge>
	 * <StatusBadge variant="disabled">Disabled</StatusBadge>
	 * ```
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
