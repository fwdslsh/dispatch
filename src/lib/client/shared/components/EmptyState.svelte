<script>
	/**
	 * EmptyState Component
	 * Displays empty state messaging with optional icon and actions
	 *
	 * Used when lists, tables, or sections have no content
	 * Provides better UX than bare "no data" text
	 */

	let {
		// Content
		icon = '',
		message,
		title = '',

		// Optional action buttons (rendered in children)
		children,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();
</script>

<div class="empty-state {customClass}" {...restProps}>
	{#if icon}
		<div class="empty-state__icon">
			{#if typeof icon === 'string'}
				{icon}
			{:else}
				{@render icon()}
			{/if}
		</div>
	{/if}

	{#if title}
		<h3 class="empty-state__title">{title}</h3>
	{/if}

	<p class="empty-state__message">{message}</p>

	{#if children}
		<div class="empty-state__actions">
			{@render children()}
		</div>
	{/if}
</div>
