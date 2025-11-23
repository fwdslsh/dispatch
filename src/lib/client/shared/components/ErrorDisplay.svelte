<script>
	/**
	 * @component ErrorDisplay
	 * @description
	 * Foundation component for displaying error, warning, success, and info messages.
	 * Supports dismissible messages, different severity levels, and custom content.
	 * Uses semantic colors and icons for accessibility.
	 *
	 * @typedef {Object} ErrorDisplayProps
	 * @property {string} [error=''] - Error message text
	 * @property {string} [title=''] - Optional title above message
	 * @property {'error'|'warning'|'info'|'success'} [severity='error'] - Message severity level
	 * @property {boolean} [dismissible=false] - Show dismiss button
	 * @property {boolean} [showIcon=true] - Show severity icon
	 * @property {'small'|'medium'|'large'} [size='medium'] - Display size
	 * @property {() => void} [ondismiss] - Called when message is dismissed
	 * @property {string} [class] - Additional CSS classes
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic error -->
	 * <ErrorDisplay
	 *   error="Failed to save changes"
	 *   severity="error"
	 * />
	 *
	 * <!-- Warning with title -->
	 * <ErrorDisplay
	 *   title="Unsaved Changes"
	 *   error="You have unsaved changes that will be lost"
	 *   severity="warning"
	 *   dismissible
	 *   ondismiss={handleDismiss}
	 * />
	 *
	 * <!-- Success message -->
	 * <ErrorDisplay
	 *   title="Success!"
	 *   error="Your changes have been saved"
	 *   severity="success"
	 * />
	 *
	 * <!-- With custom content -->
	 * <ErrorDisplay title="Connection Error" severity="error">
	 *   <p>Unable to connect to server</p>
	 *   <Button size="small" onclick={handleRetry}>Retry</Button>
	 * </ErrorDisplay>
	 * ```
	 *
	 * @fires {void} dismiss - Fired when dismiss button is clicked
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

	// Compute classes using global utilities
	const errorClasses = $derived.by(() => {
		const baseClasses = [
			'relative',
			'flex',
			'gap-3',
			'rounded-lg',
			'border',
			'transition-all',
			'duration-300'
		];

		// Size classes
		if (size === 'small') baseClasses.push('p-2', 'text-sm');
		else if (size === 'large') baseClasses.push('p-6', 'text-lg');
		else baseClasses.push('p-4', 'text-base');

		// Severity classes
		if (severity === 'error') {
			baseClasses.push('error-display--error');
		} else if (severity === 'warning') {
			baseClasses.push('error-display--warning');
		} else if (severity === 'success') {
			baseClasses.push('error-display--success');
		} else if (severity === 'info') {
			baseClasses.push('error-display--info');
		}

		if (customClass) baseClasses.push(...customClass.split(' '));
		return baseClasses.join(' ');
	});

	// Handle dismiss
	function handleDismiss() {
		ondismiss?.();
	}
</script>

<div class={errorClasses} role="alert" aria-live="polite" {...restProps}>
	{#if showIcon}
		<div class="shrink-0 mt-0.5" aria-hidden="true">
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

	<div class="flex-1 space-y-2">
		{#if title}
			<h4 class="font-semibold text-base">{title}</h4>
		{/if}

		{#if error}
			<div class="text-sm opacity-90">
				{error}
			</div>
		{/if}

		<!-- Allow for custom content -->
		{#if children}
			<div>
				{@render children()}
			</div>
		{/if}
	</div>

	{#if dismissible}
		<button
			class="shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
	/* Component-specific severity styles */
	.error-display--error {
		background: color-mix(in oklab, var(--err) 5%, transparent);
		border-color: color-mix(in oklab, var(--err) 30%, transparent);
		color: var(--err);
		box-shadow: 0 0 20px color-mix(in oklab, var(--err) 20%, transparent);
	}

	.error-display--warning {
		background: color-mix(in oklab, var(--warn) 5%, transparent);
		border-color: color-mix(in oklab, var(--warn) 30%, transparent);
		color: var(--warn);
		box-shadow: 0 0 20px color-mix(in oklab, var(--warn) 20%, transparent);
	}

	.error-display--success {
		background: color-mix(in oklab, var(--ok) 5%, transparent);
		border-color: color-mix(in oklab, var(--ok) 30%, transparent);
		color: var(--ok);
		box-shadow: 0 0 20px color-mix(in oklab, var(--ok) 20%, transparent);
	}

	.error-display--info {
		background: color-mix(in oklab, var(--accent-cyan) 5%, transparent);
		border-color: color-mix(in oklab, var(--accent-cyan) 30%, transparent);
		color: var(--accent-cyan);
		box-shadow: 0 0 20px color-mix(in oklab, var(--accent-cyan) 20%, transparent);
	}

	/* Hover effects for better interactivity */
	.error-display--error:hover,
	.error-display--warning:hover,
	.error-display--success:hover,
	.error-display--info:hover {
		filter: brightness(1.05);
		border-width: 2px;
	}

	.error-display--error:hover {
		box-shadow: 0 4px 20px color-mix(in oklab, var(--err) 30%, transparent);
	}

	.error-display--warning:hover {
		box-shadow: 0 4px 20px color-mix(in oklab, var(--warn) 30%, transparent);
	}

	.error-display--info:hover {
		box-shadow: 0 4px 20px color-mix(in oklab, var(--accent-cyan) 30%, transparent);
	}

	.error-display--success:hover {
		box-shadow: 0 4px 20px color-mix(in oklab, var(--ok) 30%, transparent);
	}
</style>
