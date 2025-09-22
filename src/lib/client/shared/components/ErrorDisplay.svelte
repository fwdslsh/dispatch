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

	// Compute classes using global utilities
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
/* Component-specific overrides only */
.error-display {
transition: all 0.3s ease;
}

/* Terminal-style glow effects for errors */
.error-display--error {
box-shadow: 0 0 20px color-mix(in oklab, var(--err) 20%, transparent);
}

.error-display--warning {
box-shadow: 0 0 20px color-mix(in oklab, var(--warn) 20%, transparent);
}

.error-display--success {
box-shadow: 0 0 20px color-mix(in oklab, var(--ok) 20%, transparent);
}

.error-display--info {
box-shadow: 0 0 20px color-mix(in oklab, var(--accent-cyan) 20%, transparent);
}

/* Hover effects for better interactivity */
.error-display:hover {
transform: translateY(-1px);
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
