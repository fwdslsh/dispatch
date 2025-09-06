<script>
	/**
	 * ValidationMessage Foundation Component
	 * Input validation feedback display component
	 */

	// Props with defaults
	let {
		// Message content
		message = '',

		// Validation state
		type = 'error', // 'error' | 'warning' | 'success' | 'info'

		// Display options
		showIcon = true,

		// HTML attributes
		class: customClass = '',
		id = undefined,
		...restProps
	} = $props();

	// Generate unique ID if not provided
	const messageId = id || crypto.randomUUID();

	// Compute classes
	const messageClasses = $derived(() => {
		const classes = ['validation-message', `validation-message--${type}`];
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});

	// Icon mappings
	const icons = {
		error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>`,
		warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><dot cx="12" cy="17" fill="currentColor" r="1"/></svg>`,
		success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
		info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4" stroke="currentColor" stroke-width="2"/><path d="M12 8h.01" stroke="currentColor" stroke-width="2"/></svg>`
	};
</script>

{#if message}
	<div class={messageClasses} id={messageId} role="alert" aria-live="polite" {...restProps}>
		{#if showIcon}
			<div class="validation-message__icon" aria-hidden="true">
				{@html icons[type]}
			</div>
		{/if}

		<div class="validation-message__text">
			{message}
		</div>
	</div>
{/if}

<style>
	.validation-message {
		display: flex;
		align-items: flex-start;
		gap: var(--space-xs);
		font-family: var(--font-sans);
		font-size: 0.75rem;
		line-height: 1.4;
		margin-top: var(--space-xs);
	}

	/* Type variants */
	.validation-message--error {
		color: var(--secondary);
	}

	.validation-message--warning {
		color: #ffa726;
	}

	.validation-message--success {
		color: #4caf50;
	}

	.validation-message--info {
		color: var(--primary);
	}

	/* Icon */
	.validation-message__icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1px; /* Align with text baseline */
	}

	/* Text content */
	.validation-message__text {
		flex: 1;
		min-width: 0;
		word-wrap: break-word;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.validation-message {
			font-size: 0.875rem;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.validation-message--error {
			color: #ff0000;
			font-weight: 600;
		}

		.validation-message--warning {
			color: #ff8c00;
			font-weight: 600;
		}

		.validation-message--success {
			color: #008000;
			font-weight: 600;
		}

		.validation-message--info {
			color: #0066cc;
			font-weight: 600;
		}
	}

	/* Animation for when message appears */
	.validation-message {
		animation: slideInDown 0.2s ease-out;
	}

	@keyframes slideInDown {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.validation-message {
			animation: none;
		}
	}
</style>
