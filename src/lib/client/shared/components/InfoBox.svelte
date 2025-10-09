<script>
	/**
	 * InfoBox Component
	 * Displays informational messages with variant styling
	 *
	 * Used for warnings, errors, success messages, and informational content
	 * Replaces duplicate alert/message patterns
	 */

	let {
		// Variant determines color and icon
		variant = 'info', // 'info' | 'warning' | 'error' | 'success'

		// Optional title
		title = '',

		// Optional icon snippet
		icon = undefined,

		// Content
		children,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Default icons for each variant (can be overridden)
	const defaultIcons = {
		info: 'ℹ️',
		warning: '⚠️',
		error: '❌',
		success: '✓'
	};

	const displayIcon = $derived(icon || defaultIcons[variant]);
</script>

<div class="info-box {variant} {customClass}" {...restProps}>
	{#if displayIcon}
		<div class="info-box__icon">
			{#if typeof displayIcon === 'string'}
				{displayIcon}
			{:else}
				{@render displayIcon()}
			{/if}
		</div>
	{/if}
	<div class="info-box__content">
		{#if title}
			<div class="info-box__title">{title}</div>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	/* Additional InfoBox-specific styles */
	.info-box__title {
		font-weight: 600;
		margin-bottom: var(--space-1);
		color: inherit;
	}
</style>
