<script>
	/**
	 * FormSection Component
	 * Consistent form section with label and content
	 * Supports both 'label' (simple) and 'title'+'description' (detailed) modes
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
