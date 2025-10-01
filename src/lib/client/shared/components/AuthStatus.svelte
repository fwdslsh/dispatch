<!--
	AuthStatus Component
	Displays the current authentication provider (Terminal Key, GitHub OAuth, etc.)
	Simplified for single-user app - just shows which auth mechanism is active
-->

<script>
	import { onMount } from 'svelte';

	let provider = $state(null);
	let loading = $state(true);

	onMount(() => {
		// Get auth provider from localStorage
		provider = localStorage.getItem('dispatch-auth-provider');
		loading = false;
	});

	const providerLabels = {
		terminal_key: 'Terminal Key',
		github: 'GitHub',
		google: 'Google',
		oauth: 'OAuth'
	};

	const providerIcons = {
		terminal_key: '🔑',
		github: '🐙',
		google: '🔵',
		oauth: '🔐'
	};
</script>

{#if !loading && provider}
	<div class="auth-status" data-testid="auth-status">
		<div class="auth-status-header">
			<span class="auth-icon" aria-hidden="true">
				{providerIcons[provider] || '🔐'}
			</span>
			<div class="auth-info">
				<h4 class="auth-title">Current Authentication</h4>
				<p class="auth-provider">
					Authenticated via <strong>{providerLabels[provider] || provider}</strong>
				</p>
			</div>
		</div>
	</div>
{:else if !loading}
	<div class="auth-status auth-status-empty" data-testid="auth-status-empty">
		<p class="auth-empty-message">No active authentication provider detected</p>
	</div>
{/if}

<style>
	.auth-status {
		background: var(--surface-elevated, #2a2a2a);
		border: 1px solid var(--border-color, #3a3a3a);
		border-radius: var(--radius-md, 8px);
		padding: var(--space-4, 1rem);
		margin-bottom: var(--space-4, 1rem);
	}

	.auth-status-header {
		display: flex;
		align-items: center;
		gap: var(--space-3, 0.75rem);
	}

	.auth-icon {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.auth-info {
		flex: 1;
		min-width: 0;
	}

	.auth-title {
		margin: 0 0 var(--space-1, 0.25rem) 0;
		font-size: var(--font-size-sm, 0.875rem);
		font-weight: 600;
		color: var(--text-secondary, #a0a0a0);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.auth-provider {
		margin: 0;
		font-size: var(--font-size-base, 1rem);
		color: var(--text-primary, #e0e0e0);
	}

	.auth-provider strong {
		color: var(--accent-color, #60a5fa);
		font-weight: 600;
	}

	.auth-status-empty {
		opacity: 0.6;
	}

	.auth-empty-message {
		margin: 0;
		font-size: var(--font-size-sm, 0.875rem);
		color: var(--text-secondary, #a0a0a0);
		font-style: italic;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.auth-status-header {
			gap: var(--space-2, 0.5rem);
		}

		.auth-icon {
			font-size: 1.5rem;
		}

		.auth-title {
			font-size: var(--font-size-xs, 0.75rem);
		}

		.auth-provider {
			font-size: var(--font-size-sm, 0.875rem);
		}
	}
</style>
