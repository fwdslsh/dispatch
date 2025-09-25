<script>
	import { SecurityState } from '../state/SecurityState.svelte.js';

	let {
		method = '',
		showStatus = true,
		showReason = true,
		compact = false
	} = $props();

	const securityState = new SecurityState();

	const methodConfig = $derived(() => {
		return securityState.methodAvailability[method] || {
			available: false,
			reason: 'Unknown method'
		};
	});

	const methodDisplayName = $derived(() => {
		switch (method) {
			case 'local':
				return 'Access Code';
			case 'webauthn':
				return 'WebAuthn/Passkeys';
			case 'oauth':
				return 'OAuth (Google/GitHub)';
			default:
				return method;
		}
	});

	const methodIcon = $derived(() => {
		switch (method) {
			case 'local':
				return '🔑';
			case 'webauthn':
				return '🔐';
			case 'oauth':
				return '🔗';
			default:
				return '❓';
		}
	});

	const statusIcon = $derived(() => {
		return methodConfig().available ? '✅' : '❌';
	});

	const statusClass = $derived(() => {
		return methodConfig().available ? 'available' : 'unavailable';
	});
</script>

<div
	class="auth-method-indicator {statusClass} {compact ? 'compact' : ''}"
	data-testid="auth-method-indicator"
	data-method={method}
	title={methodConfig().reason || ''}
>
	<div class="method-header">
		<div class="method-info">
			<span class="method-icon">{methodIcon}</span>
			<span class="method-name">{methodDisplayName}</span>
		</div>

		{#if showStatus}
			<div class="status-indicator">
				<span class="status-icon" title={methodConfig().available ? 'Available' : 'Not Available'}>
					{statusIcon}
				</span>
			</div>
		{/if}
	</div>

	{#if showReason && methodConfig().reason && !compact}
		<div class="method-reason">
			<span class="reason-text">{methodConfig().reason}</span>
		</div>
	{/if}
</div>

<style>
	.auth-method-indicator {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border: 1px solid;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
	}

	.auth-method-indicator.compact {
		padding: 0.5rem 0.75rem;
		gap: 0.25rem;
	}

	.auth-method-indicator.available {
		background-color: rgba(16, 185, 129, 0.05);
		border-color: #10b981;
		color: #059669;
	}

	.auth-method-indicator.unavailable {
		background-color: rgba(239, 68, 68, 0.05);
		border-color: #ef4444;
		color: #dc2626;
		opacity: 0.8;
	}

	.method-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.method-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
	}

	.method-icon {
		font-size: 1.125rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.method-name {
		font-weight: 500;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.compact .method-name {
		font-size: 0.8125rem;
	}

	.status-indicator {
		flex-shrink: 0;
	}

	.status-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.method-reason {
		padding-left: 1.625rem; /* Align with method name */
		margin-top: -0.25rem;
	}

	.reason-text {
		font-size: 0.8125rem;
		line-height: 1.4;
		opacity: 0.8;
		font-style: italic;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.auth-method-indicator {
			padding: 0.625rem 0.875rem;
		}

		.auth-method-indicator.compact {
			padding: 0.5rem 0.625rem;
		}

		.method-name {
			font-size: 0.8125rem;
		}

		.compact .method-name {
			font-size: 0.75rem;
		}

		.reason-text {
			font-size: 0.75rem;
		}
	}
</style>