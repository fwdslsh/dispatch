<script>
	/**
	 * TypeCard Component
	 * Card-style button for type selection with icon, title, and description
	 */

	// Props
	let {
		icon = undefined,
		title = '',
		description = '',
		active = false,
		disabled = false,
		augmented = 'tl-clip br-clip both',
		onclick = undefined,
		class: customClass = '',
		...restProps
	} = $props();
</script>

<button
	type="button"
	class="type-card {customClass}"
	class:active
	{disabled}
	data-augmented-ui={augmented}
	{onclick}
	{...restProps}
>
	<div class="type-card__content">
		{#if icon}
			<div class="type-card__icon">{@render icon()}</div>
		{/if}
		<div class="type-card__info">
			<div class="type-card__title">{title}</div>
			{#if description}
				<div class="type-card__desc">{description}</div>
			{/if}
		</div>
	</div>
</button>

<style>
	/* Use CSS utility classes from retro.css - no additional styles needed */
</style>
