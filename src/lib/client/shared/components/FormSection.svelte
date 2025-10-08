<script>
	/**
	 * FormSection Component
	 * Consistent form section with label and content
	 */

	// Props
	let {
		label = '',
		icon = undefined,
		required = false,
		class: customClass = '',
		children = undefined,
		...restProps
	} = $props();
</script>

<div class="form-section {customClass}" {...restProps}>
	{#if label}
		<label class="form-section__label">
			{#if icon}
				<span class="form-section__label-icon">{@render icon()}</span>
			{/if}
			<span>{label}{required ? ' *' : ''}</span>
		</label>
	{/if}

	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	/* Form Section Component Styles */
	.form-section {
		margin-bottom: 2rem;
		position: relative;
	}

	.form-section__label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-weight: 700;
		color: var(--primary);
		font-size: 1rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow: 0 0 8px var(--primary-glow-30);
	}

	.form-section__label-icon {
		font-size: 1.1em;
		filter: drop-shadow(0 0 6px var(--primary-glow-40));
	}
</style>
