<script>
	/**
	 * @component EmptyState
	 * @description
	 * Displays empty state messaging with optional icon and action buttons.
	 * Used when lists, tables, or sections have no content.
	 * Provides better UX than bare "no data" text with actionable next steps.
	 *
	 * @typedef {Object} EmptyStateProps
	 * @property {string|import('svelte').Snippet} [icon] - Icon string or snippet
	 * @property {string} message - Required empty state message
	 * @property {string} [title] - Optional title above message
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic usage -->
	 * <EmptyState
	 *   message="No sessions available"
	 * />
	 *
	 * <!-- With icon and title -->
	 * <EmptyState
	 *   title="No Workspaces"
	 *   message="Create your first workspace to get started">
	 *   {#snippet icon()}
	 *     <IconFolder size={48} />
	 *   {/snippet}
	 * </EmptyState>
	 *
	 * <!-- With action buttons -->
	 * <EmptyState
	 *   title="No API Keys"
	 *   message="Generate an API key to access the Dispatch API">
	 *   {#snippet icon()}
	 *     <IconKey size={48} />
	 *   {/snippet}
	 *   <Button onclick={handleCreateKey}>Create API Key</Button>
	 * </EmptyState>
	 * ```
	 */

	/** @type {EmptyStateProps & Record<string, any>} */
	let {
		// Content
		icon = '',
		message,
		title = '',

		// Optional action buttons (rendered in children)
		children = undefined,

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
