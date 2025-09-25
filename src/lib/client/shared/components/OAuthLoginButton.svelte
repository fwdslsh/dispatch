<script>
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	export let provider; // 'google' or 'github'
	export let returnTo = '/';
	export let disabled = false;

	const dispatch = createEventDispatcher();

	let loading = false;
	let error = null;

	// Provider configurations
	const providers = {
		google: {
			name: 'Google',
			icon: '🔍',
			color: '#4285f4',
			textColor: '#ffffff'
		},
		github: {
			name: 'GitHub',
			icon: '🐙',
			color: '#333333',
			textColor: '#ffffff'
		}
	};

	$: providerConfig = providers[provider] || { name: 'OAuth', icon: '🌐', color: '#666666', textColor: '#ffffff' };

	async function handleLogin() {
		if (loading || disabled) return;

		loading = true;
		error = null;

		try {
			// Construct OAuth URL
			const oauthUrl = `/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`;

			// Redirect to OAuth provider
			window.location.href = oauthUrl;

		} catch (err) {
			loading = false;
			error = err.message || 'OAuth authentication failed';
			dispatch('error', { error, provider });
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleLogin();
		}
	}
</script>

<button
	class="oauth-button"
	class:loading
	class:disabled
	style="--provider-color: {providerConfig.color}; --provider-text-color: {providerConfig.textColor};"
	on:click={handleLogin}
	on:keydown={handleKeydown}
	{disabled}
	title="Continue with {providerConfig.name}"
	aria-label="Continue with {providerConfig.name}"
>
	<div class="button-content">
		{#if loading}
			<LoadingSpinner size="sm" />
		{:else}
			<span class="provider-icon" aria-hidden="true">{providerConfig.icon}</span>
		{/if}
		<span class="provider-text">Continue with {providerConfig.name}</span>
	</div>
</button>

{#if error}
	<div class="error-message" role="alert">
		<span class="error-icon" aria-hidden="true">⚠️</span>
		{error}
	</div>
{/if}

<style>
	.oauth-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.75rem 1rem;
		background: var(--provider-color);
		color: var(--provider-text-color);
		border: 1px solid var(--provider-color);
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		margin: 0.5rem 0;
	}

	.oauth-button:hover:not(:disabled):not(.loading) {
		opacity: 0.9;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.oauth-button:active:not(:disabled):not(.loading) {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.oauth-button:disabled,
	.oauth-button.disabled,
	.oauth-button.loading {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.button-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.provider-icon {
		font-size: 1.125rem;
		flex-shrink: 0;
	}

	.provider-text {
		flex: 1;
		text-align: center;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		margin-top: 0.5rem;
		background: var(--color-error-bg, #fee);
		color: var(--color-error, #d32f2f);
		border: 1px solid var(--color-error, #d32f2f);
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.error-icon {
		flex-shrink: 0;
	}

	/* Focus styles for accessibility */
	.oauth-button:focus {
		outline: 2px solid var(--color-primary, #0066cc);
		outline-offset: 2px;
	}

	.oauth-button:focus:not(:focus-visible) {
		outline: none;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.oauth-button {
			box-shadow: 0 1px 2px rgba(255, 255, 255, 0.1);
		}

		.oauth-button:hover:not(:disabled):not(.loading) {
			box-shadow: 0 2px 4px rgba(255, 255, 255, 0.15);
		}

		.error-message {
			background: rgba(211, 47, 47, 0.1);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.oauth-button {
			transition: none;
		}

		.oauth-button:hover:not(:disabled):not(.loading) {
			transform: none;
		}

		.oauth-button:active:not(:disabled):not(.loading) {
			transform: none;
		}
	}
</style>