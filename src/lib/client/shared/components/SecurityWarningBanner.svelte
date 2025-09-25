<script>
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let {
		type = 'warning',
		title = '',
		message = '',
		dismissible = true,
		actions = [],
		visible = $bindable(true)
	} = $props();

	function dismissWarning() {
		if (dismissible) {
			visible = false;
			dispatch('dismiss');
		}
	}

	function handleAction(action) {
		dispatch('action', { action });
	}
</script>

{#if visible}
	<div class="security-warning {type}" role="alert" data-testid="security-warning">
		<div class="warning-content">
			<div class="warning-icon">
				{#if type === 'error'}
					🔴
				{:else if type === 'warning'}
					⚠️
				{:else if type === 'info'}
					ℹ️
				{:else if type === 'success'}
					✅
				{/if}
			</div>

			<div class="warning-details">
				{#if title}
					<h4 class="warning-title">{title}</h4>
				{/if}
				<p class="warning-message">{message}</p>

				{#if actions.length > 0}
					<div class="warning-actions">
						{#each actions as action}
							<button
								class="action-btn {action.variant || 'primary'}"
								onclick={() => handleAction(action)}
								disabled={action.disabled}
							>
								{action.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if dismissible}
				<button class="warning-dismiss" onclick={dismissWarning} aria-label="Dismiss warning">
					×
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.security-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		margin-bottom: 1rem;
		border-radius: 0.375rem;
		border: 1px solid;
		position: relative;
		animation: slideIn 0.3s ease-out;
	}

	.security-warning.error {
		background-color: rgba(239, 68, 68, 0.1);
		border-color: #ef4444;
		color: #dc2626;
	}

	.security-warning.warning {
		background-color: rgba(245, 158, 11, 0.1);
		border-color: #f59e0b;
		color: #d97706;
	}

	.security-warning.info {
		background-color: rgba(59, 130, 246, 0.1);
		border-color: #3b82f6;
		color: #2563eb;
	}

	.security-warning.success {
		background-color: rgba(16, 185, 129, 0.1);
		border-color: #10b981;
		color: #059669;
	}

	.warning-content {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
	}

	.warning-icon {
		font-size: 1.25rem;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.warning-details {
		flex: 1;
	}

	.warning-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		line-height: 1.4;
	}

	.warning-message {
		font-size: 0.875rem;
		line-height: 1.5;
		margin: 0;
		opacity: 0.9;
	}

	.warning-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.action-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		border-radius: 0.25rem;
		border: 1px solid;
		cursor: pointer;
		transition: all 0.2s ease;
		font-weight: 500;
	}

	.action-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.primary {
		background-color: currentColor;
		color: white;
		border-color: currentColor;
	}

	.action-btn.secondary {
		background-color: transparent;
		color: currentColor;
		border-color: currentColor;
	}

	.warning-dismiss {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		color: currentColor;
		opacity: 0.6;
		transition: opacity 0.2s ease;
		padding: 0.25rem;
	}

	.warning-dismiss:hover {
		opacity: 1;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
