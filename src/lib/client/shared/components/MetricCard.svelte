<script>
	/**
	 * MetricCard Component
	 * Displays metrics with value and label
	 *
	 * Used for displaying statistics, usage data, and counts
	 * Replaces duplicate metric display patterns
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
