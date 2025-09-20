<script>
	/**
	 * ErrorDisplay Foundation Component
	 * Standardized error message presentation with different severity levels
	 */
	import IconX from './Icons/IconX.svelte';
	import IconAlertTriangle from './Icons/IconAlertTriangle.svelte';
	import IconCheck from './Icons/IconCheck.svelte';
	import IconInfoCircle from './Icons/IconInfoCircle.svelte';

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

		// Children content
		children = undefined,

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
		error: IconX,
		warning: IconAlertTriangle,
		info: IconInfoCircle,
		success: IconCheck
	};

	// Handle dismiss
	function handleDismiss() {
		ondismiss?.();
	}
</script>

<div class={errorClasses} role="alert" aria-live="polite" {...restProps}>
	{#if showIcon}
		<div class="error-display__icon" aria-hidden="true">
			{#if severity === 'error'}
				<IconX size={20} />
			{:else if severity === 'warning'}
				<IconAlertTriangle size={20} />
			{:else if severity === 'info'}
				<IconInfoCircle size={20} />
			{:else if severity === 'success'}
				<IconCheck size={20} />
			{/if}
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
		<div class="error-display__slot">
			{@render children?.()}
		</div>
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
