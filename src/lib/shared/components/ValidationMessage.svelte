<script>
	/**
	 * ValidationMessage Foundation Component
	 * Input validation feedback display component
	 */
	import { IconX, IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-svelte';

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
		error: IconX,
		warning: IconAlertTriangle,
		success: IconCheck,
		info: IconInfoCircle
	};
</script>

{#if message}
	<div class={messageClasses} id={messageId} role="alert" aria-live="polite" {...restProps}>
		{#if showIcon}
			<div class="validation-message__icon" aria-hidden="true">
				<svelte:component this={icons[type]} size={16} />
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
