<!--
  OAuthProviderSelector.svelte

  Dynamic OAuth provider selection interface that adapts to available providers
  from server configuration. Supports provider availability checking and
  contextual messaging.
-->

<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import OAuthLoginButton from './OAuthLoginButton.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Button from './Button.svelte';

	const dispatch = createEventDispatcher();

	// Props
	let {
		returnTo = '/',
		showTitle = true,
		title = 'Sign in with your account',
		subtitle = 'Choose your preferred provider',
		compact = false,
		disabled = false
	} = $props();

	// State
	let providers = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let authConfig = $state(null);

	// Provider configurations with enhanced metadata
	const providerConfigs = {
		google: {
			name: 'Google',
			icon: '🔍',
			color: '#4285f4',
			textColor: '#ffffff',
			description: 'Sign in with your Google account',
			domains: ['gmail.com', 'googlemail.com'],
			features: ['Single Sign-On', 'Profile Sync']
		},
		github: {
			name: 'GitHub',
			icon: '🐙',
			color: '#333333',
			textColor: '#ffffff',
			description: 'Sign in with your GitHub account',
			domains: ['github.com'],
			features: ['Developer Profile', 'Repository Access']
		},
		microsoft: {
			name: 'Microsoft',
			icon: '🪟',
			color: '#0078d4',
			textColor: '#ffffff',
			description: 'Sign in with your Microsoft account',
			domains: ['outlook.com', 'hotmail.com', 'live.com'],
			features: ['Office 365', 'Azure AD']
		},
		apple: {
			name: 'Apple',
			icon: '🍎',
			color: '#000000',
			textColor: '#ffffff',
			description: 'Sign in with your Apple ID',
			domains: ['icloud.com', 'me.com'],
			features: ['Privacy Focused', 'Touch ID']
		}
	};

	/**
	 * Load OAuth provider configuration from server
	 */
	async function loadProviders() {
		if (!browser) return;

		loading = true;
		error = null;

		try {
			const response = await fetch('/api/auth/config');
			const data = await response.json();

			if (data.success) {
				authConfig = data;

				// Extract enabled OAuth providers
				const oauthConfig = data.methods?.oauth;
				if (oauthConfig?.available && oauthConfig.providers) {
					providers = Object.entries(oauthConfig.providers)
						.filter(([_, config]) => config.enabled)
						.map(([providerId, config]) => ({
							id: providerId,
							...config,
							...providerConfigs[providerId],
							// Merge server config with client config
							available: config.available !== false,
							configured: config.configured !== false
						}));
				} else {
					providers = [];
				}
			} else {
				error = data.error || 'Failed to load OAuth providers';
			}
		} catch (err) {
			error = err.message || 'Network error loading OAuth providers';
		} finally {
			loading = false;
		}
	}

	/**
	 * Handle provider selection
	 */
	function handleProviderSelect(providerId) {
		dispatch('providerSelected', { providerId, returnTo });
	}

	/**
	 * Handle OAuth authentication error
	 */
	function handleOAuthError(event) {
		dispatch('error', {
			error: event.detail.error,
			provider: event.detail.provider
		});
	}

	/**
	 * Get provider availability status
	 */
	function getProviderStatus(provider) {
		if (!provider.configured) {
			return {
				status: 'not-configured',
				message: 'Not configured by administrator',
				severity: 'error'
			};
		}
		if (!provider.available) {
			return {
				status: 'unavailable',
				message: 'Temporarily unavailable',
				severity: 'warning'
			};
		}
		return {
			status: 'available',
			message: 'Ready to use',
			severity: 'success'
		};
	}

	/**
	 * Check if any providers are available
	 */
	let hasAvailableProviders = $derived.by(() => {
		return providers.some((p) => p.configured && p.available);
	});

	/**
	 * Get security context message
	 */
	let securityMessage = $derived.by(() => {
		if (!authConfig?.security) return null;

		const { isSecure, isTunnel } = authConfig.security;

		if (isTunnel) {
			return {
				type: 'tunnel',
				message: 'Using tunnel URL - OAuth redirects may have limitations',
				severity: 'warning'
			};
		}

		if (!isSecure) {
			return {
				type: 'insecure',
				message: 'Using HTTP - OAuth requires HTTPS in production',
				severity: 'warning'
			};
		}

		return null;
	});

	// Load providers on mount
	$effect(() => {
		if (browser) {
			loadProviders();
		}
	});

	onMount(() => {
		if (browser) {
			loadProviders();
		}
	});
</script>

<div class="oauth-selector" class:compact data-testid="oauth-provider-selector">
	{#if showTitle && !compact}
		<div class="selector-header">
			<h3>{title}</h3>
			{#if subtitle}
				<p class="subtitle">{subtitle}</p>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="loading-state">
			<LoadingSpinner size={compact ? 'sm' : 'md'} />
			<p>Loading authentication providers...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<div class="error-content">
				<span class="error-icon">⚠️</span>
				<div class="error-text">
					<h4>Failed to Load Providers</h4>
					<p>{error}</p>
				</div>
			</div>
			<Button variant="secondary" size="sm" onclick={loadProviders}>Retry</Button>
		</div>
	{:else if providers.length === 0}
		<div class="no-providers-state">
			<div class="icon">🔒</div>
			<h4>No OAuth Providers Available</h4>
			<p>
				OAuth authentication is not currently configured. Contact your administrator for assistance.
			</p>
		</div>
	{:else}
		<div class="providers-container">
			<!-- Security Context Warning -->
			{#if securityMessage}
				<div class="security-notice" class:warning={securityMessage.severity === 'warning'}>
					<span class="notice-icon">
						{#if securityMessage.type === 'tunnel'}🌐
						{:else if securityMessage.type === 'insecure'}🔓
						{:else}ℹ️{/if}
					</span>
					<span class="notice-text">{securityMessage.message}</span>
				</div>
			{/if}

			<!-- Available Providers -->
			<div class="providers-list" class:compact>
				{#each providers as provider (provider.id)}
					{@const status = getProviderStatus(provider)}
					<div
						class="provider-item"
						class:disabled={!provider.configured || !provider.available || disabled}
					>
						{#if status.status === 'available'}
							<OAuthLoginButton
								provider={provider.id}
								{returnTo}
								{disabled}
								data-testid="oauth-provider-{provider.id}"
								on:error={handleOAuthError}
							/>
						{:else}
							<div class="provider-unavailable">
								<div class="provider-info">
									<div class="provider-icon" style="color: {provider.color}">
										{provider.icon}
									</div>
									<div class="provider-details">
										<div class="provider-name">{provider.name}</div>
										<div
											class="provider-status"
											class:error={status.severity === 'error'}
											class:warning={status.severity === 'warning'}
										>
											{status.message}
										</div>
									</div>
								</div>
								{#if !compact}
									<div class="provider-description">
										{provider.description || `Sign in with ${provider.name}`}
									</div>
								{/if}
							</div>
						{/if}

						{#if !compact && provider.features}
							<div class="provider-features">
								{#each provider.features as feature}
									<span class="feature-tag">{feature}</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if !hasAvailableProviders}
				<div class="no-available-notice">
					<span class="notice-icon">⚠️</span>
					<span class="notice-text">
						No OAuth providers are currently available. Please check your configuration or try again
						later.
					</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.oauth-selector {
		width: 100%;
	}

	.oauth-selector.compact {
		--spacing: 0.5rem;
	}

	.selector-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.selector-header h3 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
	}

	.loading-state p {
		margin: 0;
		color: var(--color-text-secondary);
	}

	/* Error State */
	.error-state {
		text-align: center;
		padding: 1.5rem;
	}

	.error-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.error-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.error-text h4 {
		margin: 0 0 0.25rem 0;
		color: var(--color-error);
		font-size: 1rem;
	}

	.error-text p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* No Providers State */
	.no-providers-state {
		text-align: center;
		padding: 2rem;
	}

	.no-providers-state .icon {
		font-size: 2rem;
		margin-bottom: 0.75rem;
	}

	.no-providers-state h4 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
		font-size: 1.125rem;
	}

	.no-providers-state p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Security Notice */
	.security-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 1rem;
		background: var(--color-info-bg);
		border: 1px solid var(--color-info);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-info);
	}

	.security-notice.warning {
		background: var(--color-warning-bg);
		border-color: var(--color-warning);
		color: var(--color-warning);
	}

	.notice-icon {
		flex-shrink: 0;
		font-size: 1rem;
	}

	.notice-text {
		flex: 1;
	}

	/* Providers Container */
	.providers-container {
		width: 100%;
	}

	.providers-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.providers-list.compact {
		gap: 0.5rem;
	}

	/* Provider Items */
	.provider-item {
		position: relative;
	}

	.provider-item.disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	.provider-unavailable {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-bg-secondary);
	}

	.provider-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.provider-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.provider-details {
		flex: 1;
	}

	.provider-name {
		font-weight: 500;
		color: var(--color-text);
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
	}

	.provider-status {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.provider-status.error {
		color: var(--color-error);
	}

	.provider-status.warning {
		color: var(--color-warning);
	}

	.provider-description {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
	}

	.provider-features {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.feature-tag {
		padding: 0.125rem 0.375rem;
		background: var(--color-primary-alpha);
		color: var(--color-primary);
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	/* No Available Notice */
	.no-available-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		margin-top: 1rem;
		background: var(--color-warning-bg);
		border: 1px solid var(--color-warning);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-warning);
	}

	/* Responsive Design */
	@media (max-width: 480px) {
		.selector-header {
			margin-bottom: 1rem;
		}

		.selector-header h3 {
			font-size: 1.125rem;
		}

		.loading-state {
			padding: 1.5rem;
		}

		.error-state,
		.no-providers-state {
			padding: 1rem;
		}

		.provider-info {
			gap: 0.5rem;
		}

		.provider-features {
			gap: 0.125rem;
		}

		.feature-tag {
			font-size: 0.65rem;
		}
	}

	/* Dark Mode Support */
	@media (prefers-color-scheme: dark) {
		.provider-unavailable {
			background: var(--color-bg-tertiary, #1a1a1a);
		}
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.security-notice,
		.no-available-notice,
		.provider-unavailable {
			border-width: 2px;
		}
	}
</style>
