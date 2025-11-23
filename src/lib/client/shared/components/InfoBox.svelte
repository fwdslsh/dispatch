<script>
	/**
	 * @component InfoBox
	 * @description
	 * Displays informational messages with semantic variant styling.
	 * Used for warnings, errors, success messages, and informational content.
	 * Provides consistent alert/message styling across the application.
	 *
	 * @typedef {Object} InfoBoxProps
	 * @property {'info'|'warning'|'error'|'success'} [variant='info'] - Message severity/type
	 * @property {string} [title=''] - Optional title text
	 * @property {import('svelte').Snippet|string} [icon] - Custom icon (defaults to variant icon)
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic info message -->
	 * <InfoBox variant="info">
	 *   This is an informational message.
	 * </InfoBox>
	 *
	 * <!-- Warning with title -->
	 * <InfoBox variant="warning" title="Important Notice">
	 *   Please review your settings before continuing.
	 * </InfoBox>
	 *
	 * <!-- Error with custom icon -->
	 * <InfoBox variant="error" title="Connection Failed">
	 *   {#snippet icon()}
	 *     <IconAlertTriangle size={20} />
	 *   {/snippet}
	 *   Unable to connect to server. Check your network connection.
	 * </InfoBox>
	 * ```
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
