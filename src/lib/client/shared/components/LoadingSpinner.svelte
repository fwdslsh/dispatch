<script>
	/**
	 * LoadingSpinner Foundation Component
	 * Animated loading indicator with size variants
	 */

	// Props with defaults
	let {
		// Size variants
		size = 'medium', // 'small' | 'medium' | 'large' | 'xl'

		// Style variants
		variant = 'primary', // 'primary' | 'secondary' | 'muted'

		// Content
		text = '',

		// Behavior
		inline = false, // If true, displays inline; if false, centers in container

		// Accessibility
		ariaLabel = 'Loading',

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Compute spinner classes - simplified for global styles
	const spinnerClasses = $derived(() => {
		const classes = ['spinner', `spinner--${size}`, `spinner--${variant}`];
		if (inline) classes.push('spinner--inline');
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});
</script>

<div class="flex flex-col flex-center gap-2 {inline ? '' : 'spinner-wrapper--centered'} {text ? 'spinner-wrapper--with-text' : ''}" {...restProps}>
	<div class={spinnerClasses} role="status" aria-label={ariaLabel} aria-live="polite">
		<div class="spinner__circle"></div>
		{#if text}
			<span class="spinner__text" aria-hidden="true">
				{text}
			</span>
		{/if}
		<span class="sr-only">{ariaLabel}</span>
	</div>
</div>

<style>
	.spinner-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
	}

	.spinner-wrapper--centered {
		min-height: 100px;
		width: 100%;
	}

	.spinner-wrapper--inline {
		display: inline-flex;
		min-height: auto;
		width: auto;
	}

	.spinner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
	}

	.spinner--inline {
		flex-direction: row;
		gap: var(--space-xs);
	}

	.spinner__circle {
		border-radius: 50%;
		border-style: solid;
		animation: spin 1s linear infinite;
	}

	/* Size variants */
	.spinner--small .spinner__circle {
		width: 16px;
		height: 16px;
		border-width: 2px;
	}

	.spinner--medium .spinner__circle {
		width: 24px;
		height: 24px;
		border-width: 2.5px;
	}

	.spinner--large .spinner__circle {
		width: 32px;
		height: 32px;
		border-width: 3px;
	}

	.spinner--xl .spinner__circle {
		width: 48px;
		height: 48px;
		border-width: 4px;
	}

	/* Color variants */
	.spinner--primary .spinner__circle {
		border-color: color-mix(in oklab, var(--accent) 30%, transparent);
		border-top-color: var(--accent);
	}

	.spinner--secondary .spinner__circle {
		border-color: color-mix(in oklab, var(--accent-2) 30%, transparent);
		border-top-color: var(--accent-2);
	}

	.spinner--muted .spinner__circle {
		border-color: var(--line);
		border-top-color: var(--muted);
	}

	/* Text styling */
	.spinner__text {
		font-family: var(--font-mono);
		color: var(--muted);
		font-size: 0.875rem;
		text-align: center;
		line-height: 1.4;
	}

	.spinner--small .spinner__text {
		font-size: 0.75rem;
	}

	.spinner--large .spinner__text {
		font-size: 1rem;
	}

	.spinner--xl .spinner__text {
		font-size: 1.125rem;
		font-weight: 500;
	}

	.spinner--inline .spinner__text {
		margin: 0;
	}

	/* Screen reader only text */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Animation */

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.spinner__circle {
			animation: none;
			border-top-color: transparent;
			border-right-color: transparent;
		}

		/* Provide alternative indication */
		.spinner__circle::after {
			content: '';
			position: absolute;
			top: 50%;
			left: 50%;
			width: 6px;
			height: 6px;
			background: currentColor;
			border-radius: 50%;
			transform: translate(-50%, -50%);
			opacity: 0.6;
			animation: pulse 1.5s ease-in-out infinite;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.spinner--primary .spinner__circle {
			border-color: transparent;
			border-top-color: currentColor;
		}

		.spinner--secondary .spinner__circle {
			border-color: transparent;
			border-top-color: currentColor;
		}

		.spinner--muted .spinner__circle {
			border-color: transparent;
			border-top-color: currentColor;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.spinner-wrapper--centered {
			min-height: 80px;
		}

		.spinner--xl .spinner__circle {
			width: 40px;
			height: 40px;
			border-width: 3px;
		}
	}
</style>
