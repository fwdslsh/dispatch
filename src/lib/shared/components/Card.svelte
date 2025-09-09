<script>
	/**
	 * Card Foundation Component
	 * Content container with consistent styling using augmented-ui
	 */

	// Props with defaults
	let {
		// Content snippets
		children,
		header,
		footer,

		// Styling
		variant = 'default', // 'default' | 'elevated' | 'outlined' | 'filled'
		padding = 'medium', // 'none' | 'small' | 'medium' | 'large'

		// Augmented UI
		augmented = 'tl-clip br-clip both',

		// Interactive states
		clickable = false,
		hover = true,

		// Event handlers
		onclick = undefined,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Compute card classes - use global retro.css classes
	const cardClasses = $derived.by(() => {
		const classes = [variant === 'elevated' ? 'panel' : 'card'];
		if (augmented && augmented !== 'none') classes.push('aug');
		if (clickable) classes.push('clickable');
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});

	// Handle click
	function handleClick(event) {
		if (clickable && onclick) {
			onclick(event);
		}
	}

	// Handle keyboard activation
	function handleKeyDown(event) {
		if (clickable && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			handleClick(event);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={cardClasses}
	data-augmented-ui={augmented}
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : undefined}
	onclick={handleClick}
	onkeydown={handleKeyDown}
	{...restProps}
>
	{#if header}
		<div class="card__header">
			{@render header()}
		</div>
	{/if}

	<div class="card__content">
		{@render children()}
	</div>

	{#if footer}
		<div class="card__footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	/* Override global card/panel styles with layout-specific adjustments */
	.clickable {
		cursor: pointer;
	}

	/* Card sections layout */
	.card__header {
		margin-bottom: var(--space-4);
		font-weight: 600;
		border-bottom: 1px solid var(--line);
		padding-bottom: var(--space-3);
	}

	.card__content {
		flex: 1;
		line-height: 1.5;
	}

	.card__footer {
		margin-top: var(--space-4);
		border-top: 1px solid var(--line);
		padding-top: var(--space-3);
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
