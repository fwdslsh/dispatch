<script>
	/**
	 * ErrorDisplay Foundation Component
	 * Standardized error message presentation with different severity levels
	 */

	// Props with defaults
	let {
		// Error content
		error = '',
		title = '',

		// Severity levels
		severity = 'error', // 'error' | 'warning' | 'info' | 'success'

		// Display options
		dismissible = false,
		showIcon = true,

		// Styling
		size = 'medium', // 'small' | 'medium' | 'large'

		// Event handlers
		ondismiss = undefined,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Compute classes
	const errorClasses = $derived.by(() => {
		const classes = ['error-display', `error-display--${severity}`, `error-display--${size}`];
		if (dismissible) classes.push('error-display--dismissible');
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});

	// Icon mappings
	const icons = {
		error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>`,
		warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><dot cx="12" cy="17" fill="currentColor" r="1"/></svg>`,
		info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4" stroke="currentColor" stroke-width="2"/><path d="M12 8h.01" stroke="currentColor" stroke-width="2"/></svg>`,
		success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2" fill="none"/></svg>`
	};

	// Handle dismiss
	function handleDismiss() {
		ondismiss?.();
	}
</script>

<div class={errorClasses} role="alert" aria-live="polite" {...restProps}>
	{#if showIcon}
		<div class="error-display__icon" aria-hidden="true">
			{@html icons[severity]}
		</div>
	{/if}

	<div class="error-display__content">
		{#if title}
			<h4 class="error-display__title">{title}</h4>
		{/if}

		{#if error}
			<div class="error-display__message">
				{error}
			</div>
		{/if}

		<!-- Allow for custom content -->
		{#if $$slots.default}
			<div class="error-display__slot">
				<slot></slot>
			</div>
		{/if}
	</div>

	{#if dismissible}
		<button
			class="error-display__dismiss"
			onclick={handleDismiss}
			aria-label="Dismiss message"
			type="button"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
				<path
					d="M18 6L6 18M6 6L18 18"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.error-display {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-radius: 6px;
		border-left: 4px solid;
		font-family: var(--font-sans);
		position: relative;
	}

	/* Severity variants */
	.error-display--error {
		background: rgba(255, 107, 107, 0.1);
		border-left-color: var(--secondary);
		color: var(--text-primary);
	}

	.error-display--warning {
		background: rgba(255, 167, 38, 0.1);
		border-left-color: #ffa726;
		color: var(--text-primary);
	}

	.error-display--info {
		background: rgba(0, 255, 136, 0.1);
		border-left-color: var(--primary);
		color: var(--text-primary);
	}

	.error-display--success {
		background: rgba(76, 175, 80, 0.1);
		border-left-color: #4caf50;
		color: var(--text-primary);
	}

	/* Size variants */
	.error-display--small {
		padding: var(--space-xs) var(--space-sm);
		font-size: 0.875rem;
	}

	.error-display--medium {
		padding: var(--space-sm) var(--space-md);
		font-size: 1rem;
	}

	.error-display--large {
		padding: var(--space-md) var(--space-lg);
		font-size: 1.125rem;
	}

	/* Icon */
	.error-display__icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 2px;
	}

	.error-display--error .error-display__icon {
		color: var(--secondary);
	}

	.error-display--warning .error-display__icon {
		color: #ffa726;
	}

	.error-display--info .error-display__icon {
		color: var(--primary);
	}

	.error-display--success .error-display__icon {
		color: #4caf50;
	}

	.error-display--small .error-display__icon {
		margin-top: 1px;
	}

	.error-display--large .error-display__icon {
		margin-top: 3px;
	}

	/* Content */
	.error-display__content {
		flex: 1;
		min-width: 0;
	}

	.error-display__title {
		font-size: 1em;
		font-weight: 600;
		margin: 0 0 var(--space-xs) 0;
		line-height: 1.3;
	}

	.error-display--small .error-display__title {
		font-size: 0.875rem;
	}

	.error-display--large .error-display__title {
		font-size: 1.25rem;
	}

	.error-display__message {
		line-height: 1.4;
		margin: 0;
	}

	.error-display__slot {
		margin-top: var(--space-xs);
	}

	/* Dismiss button */
	.error-display--dismissible {
		padding-right: var(--space-xl);
	}

	.error-display__dismiss {
		position: absolute;
		top: var(--space-sm);
		right: var(--space-sm);
		background: none;
		border: none;
		color: currentColor;
		cursor: pointer;
		padding: var(--space-xs);
		border-radius: 4px;
		opacity: 0.7;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.error-display__dismiss:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.1);
	}

	.error-display__dismiss:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
		opacity: 1;
	}

	.error-display--small .error-display__dismiss {
		top: var(--space-xs);
		right: var(--space-xs);
	}

	.error-display--large .error-display__dismiss {
		top: var(--space-md);
		right: var(--space-md);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.error-display {
			gap: var(--space-xs);
		}

		.error-display--dismissible {
			padding-right: var(--space-lg);
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.error-display {
			border-width: 2px;
			background: var(--bg);
		}

		.error-display__dismiss {
			border: 1px solid currentColor;
		}
	}
</style>
