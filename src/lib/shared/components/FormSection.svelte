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
	/* Use CSS utility classes from retro.css - no additional styles needed */
</style>