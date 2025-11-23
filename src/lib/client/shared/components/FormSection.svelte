<script>
	/**
	 * @component FormSection
	 * @description
	 * Consistent form section container with label/title and optional description.
	 * Provides structured layout for form fields with semantic heading and content areas.
	 * Supports both simple label mode and detailed title+description mode.
	 *
	 * @typedef {Object} FormSectionProps
	 * @property {string} [label=''] - Simple label text (deprecated, use title)
	 * @property {string} [title=''] - Section title (preferred over label)
	 * @property {string} [description=''] - Optional description text
	 * @property {import('svelte').Snippet} [icon] - Optional icon snippet
	 * @property {boolean} [required=false] - Show required indicator (*)
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic form section -->
	 * <FormSection title="User Information">
	 *   <Input label="Name" bind:value={name} />
	 *   <Input label="Email" type="email" bind:value={email} />
	 * </FormSection>
	 *
	 * <!-- With description and icon -->
	 * <FormSection
	 *   title="Workspace Settings"
	 *   description="Configure how your workspace behaves"
	 *   required
	 * >
	 *   {#snippet icon()}
	 *     <IconSettings size={18} />
	 *   {/snippet}
	 *   <Input label="Workspace Name" bind:value={workspaceName} />
	 * </FormSection>
	 * ```
	 */

	// Props
	let {
		label = '',
		title = '',
		description = '',
		icon = undefined,
		required = false,
		class: customClass = '',
		children = undefined,
		...restProps
	} = $props();

	// Use title if provided, otherwise fall back to label
	const displayLabel = title || label;
</script>

<div class="form-section {customClass}" {...restProps}>
	{#if displayLabel}
		<div class="form-section__header">
			<h5 class="form-section__title">
				{#if icon}
					<span class="form-section__label-icon">{@render icon()}</span>
				{/if}
				<span>{displayLabel}{required ? ' *' : ''}</span>
			</h5>
			{#if description}
				<p class="form-section__description">{description}</p>
			{/if}
		</div>
	{/if}

	<div class="form-section__content">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	/* Form Section Component Styles */
	.form-section {
		margin-bottom: var(--space-md);
		position: relative;
	}

	.form-section__header {
		margin-bottom: var(--space-md);
	}

	.form-section__title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 var(--space-2) 0;
		font-weight: 600;
		color: var(--text);
		font-size: var(--font-size-3);
		letter-spacing: 0.01em;
	}

	.form-section__description {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--muted);
		line-height: 1.5;
	}

	.form-section__label-icon {
		font-size: 1.1em;
		filter: drop-shadow(0 0 6px var(--primary-glow-40));
	}
</style>
