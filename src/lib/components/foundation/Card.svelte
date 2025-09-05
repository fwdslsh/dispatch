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
		augmented = 'tl-clip br-clip',
		
		// Interactive states
		clickable = false,
		hover = true,
		
		// Event handlers
		onclick = undefined,
		
		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Compute card classes
	const cardClasses = $derived(() => {
		const classes = ['card', `card--${variant}`, `card--padding-${padding}`];
		if (clickable) classes.push('card--clickable');
		if (hover && !clickable) classes.push('card--hoverable');
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
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	/* Variants */
	.card--default {
		background: var(--surface);
		border-color: var(--border);
	}

	.card--elevated {
		background: var(--surface);
		border-color: var(--border);
		box-shadow: 
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.2);
	}

	.card--outlined {
		background: transparent;
		border: 2px solid var(--border-light);
	}

	.card--filled {
		background: var(--bg-darker);
		border-color: var(--bg-darker);
	}

	/* Padding variants */
	.card--padding-none {
		padding: 0;
	}

	.card--padding-small {
		padding: var(--space-sm);
	}

	.card--padding-medium {
		padding: var(--space-md);
	}

	.card--padding-large {
		padding: var(--space-lg);
	}

	/* Interactive states */
	.card--clickable {
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.card--clickable:hover,
	.card--hoverable:hover {
		transform: translateY(-1px);
		box-shadow: 
			0 8px 15px -3px rgba(0, 0, 0, 0.4),
			0 4px 6px -2px rgba(0, 0, 0, 0.3);
		border-color: var(--primary-muted);
	}

	.card--clickable:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.card--clickable:active {
		transform: translateY(0);
	}

	/* Card sections */
	.card__header {
		padding: var(--space-md) var(--space-md) 0 var(--space-md);
		border-bottom: 1px solid var(--border);
		margin-bottom: var(--space-md);
		font-weight: 600;
		color: var(--text-primary);
	}

	.card__content {
		flex: 1;
		line-height: 1.5;
	}

	.card__footer {
		padding: var(--space-md) var(--space-md) 0 var(--space-md);
		border-top: 1px solid var(--border);
		margin-top: var(--space-md);
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	/* Adjust sections for different padding variants */
	.card--padding-none .card__header,
	.card--padding-none .card__content,
	.card--padding-none .card__footer {
		padding-left: var(--space-md);
		padding-right: var(--space-md);
	}

	.card--padding-none .card__header {
		padding-top: var(--space-md);
	}

	.card--padding-none .card__footer {
		padding-bottom: var(--space-md);
	}

	.card--padding-small .card__header,
	.card--padding-small .card__footer {
		padding-left: var(--space-sm);
		padding-right: var(--space-sm);
	}

	.card--padding-large .card__header,
	.card--padding-large .card__footer {
		padding-left: var(--space-lg);
		padding-right: var(--space-lg);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.card--padding-medium {
			padding: var(--space-sm);
		}

		.card--padding-large {
			padding: var(--space-md);
		}

		.card__header,
		.card__footer {
			padding-left: var(--space-sm);
			padding-right: var(--space-sm);
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.card {
			border-width: 2px;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}

		.card--clickable:hover,
		.card--hoverable:hover {
			transform: none;
		}
	}
</style>