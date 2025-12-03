<script>
	/**
	 * @component MetricCard
	 * @description
	 * Displays metrics with value and label in a card format.
	 * Used for displaying statistics, usage data, counts, and KPIs.
	 * Provides consistent metric visualization across the application.
	 *
	 * @typedef {Object} MetricCardProps
	 * @property {string|number} value - Metric value to display
	 * @property {string} label - Metric label/name
	 * @property {string} [description=''] - Optional description text
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic metric -->
	 * <MetricCard
	 *   value="42"
	 *   label="Active Sessions"
	 * />
	 *
	 * <!-- With description -->
	 * <MetricCard
	 *   value={totalUsers}
	 *   label="Total Users"
	 *   description="Registered in last 30 days"
	 * />
	 *
	 * <!-- Multiple metrics in grid -->
	 * <div class="grid grid-cols-3 gap-4">
	 *   <MetricCard value="1.2k" label="API Calls" />
	 *   <MetricCard value="99.9%" label="Uptime" />
	 *   <MetricCard value="12ms" label="Avg Response" />
	 * </div>
	 * ```
	 */

	let {
		// Metric data
		value,
		label,
		description = '',

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();
</script>

<div class="metric-card {customClass}" {...restProps}>
	<div class="metric-value">{value}</div>
	<div class="metric-label">{label}</div>
	{#if description}
		<div class="metric-description">{description}</div>
	{/if}
</div>
