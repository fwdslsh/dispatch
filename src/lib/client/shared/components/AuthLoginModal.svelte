<!--
  AuthLoginModal.svelte

  Dynamic authentication modal that adapts to available auth methods
  Supports local access codes, WebAuthn, and OAuth providers
-->

<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import OAuthLoginButton from './OAuthLoginButton.svelte';
	import WebAuthnButton from './WebAuthnButton.svelte';

	const dispatch = createEventDispatcher();

	// Props
	let {
		open = $bindable(false),
		returnTo = '/',
		title = 'Sign In',
		subtitle = 'Choose your preferred authentication method'
	} = $props();

	// State
	let authConfig = $state(null);
	let loading = $state(true);
	let error = $state(null);
	let localAuthForm = $state({
		accessCode: '',
		loading: false,
		error: null
	});

	// Auth method visibility flags
	let availableMethods = $state({
		local: false,
		webauthn: false,
		oauth: false
	});

	// OAuth providers
	let oauthProviders = $state([]);

	/**
	 * Load authentication configuration from server
	 */
	async function loadAuthConfig() {
		if (!browser) return;

		loading = true;
		error = null;

		try {
			const response = await fetch('/api/auth/config');
			const data = await response.json();

			if (data.success) {
				authConfig = data;

				// Set available methods
				availableMethods = {
					local: data.methods.local?.available || false,
					webauthn: data.methods.webauthn?.available || false,
					oauth: data.methods.oauth?.available || false
				};

				// Set OAuth providers
				oauthProviders = Object.entries(data.methods.oauth?.providers || {})
					.map(([key, provider]) => ({
						id: key,
						...provider
					}))
					.filter(provider => provider.enabled);

			} else {
				error = data.error || 'Failed to load authentication configuration';
			}
		} catch (err) {
			error = err.message || 'Network error loading authentication configuration';
		} finally {
			loading = false;
		}
	}

	/**
	 * Handle local authentication form submission
	 */
	async function handleLocalAuth(event) {
		event?.preventDefault();

		if (!localAuthForm.accessCode.trim()) {
			localAuthForm.error = 'Please enter your access code';
			return;
		}

		localAuthForm.loading = true;
		localAuthForm.error = null;

		try {
			const response = await fetch('/api/auth/local', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					accessCode: localAuthForm.accessCode,
					returnTo
				})
			});

			const data = await response.json();

			if (data.success) {
				dispatch('authenticated', {
					method: 'local',
					user: data.user,
					returnTo
				});
				open = false;
			} else {
				localAuthForm.error = data.error || 'Authentication failed';
			}
		} catch (err) {
			localAuthForm.error = err.message || 'Network error during authentication';
		} finally {
			localAuthForm.loading = false;
		}
	}

	/**
	 * Handle WebAuthn authentication success
	 */
	function handleWebAuthnSuccess(event) {
		dispatch('authenticated', {
			method: 'webauthn',
			user: event.detail.user,
			returnTo
		});
		open = false;
	}

	/**
	 * Handle WebAuthn authentication error
	 */
	function handleWebAuthnError(event) {
		// WebAuthn errors are handled internally by the component
		console.warn('WebAuthn authentication error:', event.detail.error);
	}

	/**
	 * Handle OAuth authentication (redirects to provider)
	 */
	function handleOAuthError(event) {
		error = `OAuth error: ${event.detail.error}`;
	}

	/**
	 * Get method count for UI layout
	 */
	let methodCount = $derived.by(() => {
		let count = 0;
		if (availableMethods.local) count++;
		if (availableMethods.webauthn) count++;
		if (availableMethods.oauth && oauthProviders.length > 0) count += oauthProviders.length;
		return count;
	});

	/**
	 * Check if only one method is available
	 */
	let singleMethodAvailable = $derived.by(() => methodCount === 1);

	/**
	 * Get primary authentication message
	 */
	let authMessage = $derived.by(() => {
		if (loading) return 'Loading authentication options...';
		if (error) return 'Authentication configuration error';
		if (methodCount === 0) return 'No authentication methods available';
		if (singleMethodAvailable) return 'Sign in to continue';
		return subtitle;
	});

	// Load configuration when modal opens or on mount
	$effect(() => {
		if (open && browser) {
			loadAuthConfig();
		}
	});

	onMount(() => {
		if (browser) {
			loadAuthConfig();
		}
	});
</script>

<Modal
	bind:open
	title={loading ? 'Loading...' : title}
	size="medium"
	closeOnBackdrop={false}
	closeOnEscape={true}
	showCloseButton={false}
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet children()}
		<div class="auth-modal-content" data-testid="auth-modal">
			{#if loading}
				<div class="loading-state">
					<LoadingSpinner size="lg" />
					<p>Loading authentication options...</p>
				</div>
			{:else if error}
				<div class="error-state">
					<div class="error-icon">⚠️</div>
					<h3>Authentication Error</h3>
					<p>{error}</p>
					<Button variant="secondary" onclick={loadAuthConfig}>
						Retry
					</Button>
				</div>
			{:else if methodCount === 0}
				<div class="no-methods-state">
					<div class="warning-icon">🔒</div>
					<h3>Access Restricted</h3>
					<p>No authentication methods are currently available. Please contact your administrator.</p>
				</div>
			{:else}
				<div class="auth-methods">
					<div class="auth-header">
						<h3>{authMessage}</h3>
						{#if authConfig?.security?.isTunnel}
							<div class="tunnel-warning">
								<span class="warning-icon">⚠️</span>
								<span class="warning-text">Using tunnel URL - some authentication methods may have limitations</span>
							</div>
						{/if}
					</div>

					<div class="methods-container" class:single-method={singleMethodAvailable}>
						<!-- Local Authentication -->
						{#if availableMethods.local}
							<div class="auth-method local-auth" data-testid="auth-local">
								<div class="method-header">
									<h4>
										<span class="method-icon">🔑</span>
										Access Code
									</h4>
									<p>Enter your local access code</p>
								</div>

								<form on:submit={handleLocalAuth} class="local-auth-form">
									<div class="input-group">
										<input
											type="password"
											bind:value={localAuthForm.accessCode}
											placeholder="Enter access code"
											disabled={localAuthForm.loading}
											data-testid="access-code-input"
											aria-label="Access code"
											autocomplete="current-password"
										/>
									</div>

									{#if localAuthForm.error}
										<div class="error-message" role="alert" data-testid="auth-error">
											<span class="error-icon">⚠️</span>
											{localAuthForm.error}
										</div>
									{/if}

									<Button
										type="submit"
										variant="primary"
										disabled={localAuthForm.loading || !localAuthForm.accessCode.trim()}
										data-testid="auth-local-submit"
										aria-label="Sign in with access code"
									>
										{#if localAuthForm.loading}
											<LoadingSpinner size="sm" />
											<span data-testid="auth-loading">Signing in...</span>
										{:else}
											Sign In
										{/if}
									</Button>
								</form>
							</div>
						{/if}

						<!-- WebAuthn Authentication -->
						{#if availableMethods.webauthn}
							<div class="auth-method webauthn-auth" data-testid="auth-webauthn">
								<div class="method-header">
									<h4>
										<span class="method-icon">🔐</span>
										Passkey
									</h4>
									<p>Use your biometric authentication or security key</p>
								</div>

								<WebAuthnButton
									mode="authenticate"
									variant="primary"
									data-testid="webauthn-signin-btn"
									on:success={handleWebAuthnSuccess}
									on:error={handleWebAuthnError}
								/>

								{#if authConfig?.methods?.webauthn?.warnings?.length > 0}
									<div class="method-warnings">
										{#each authConfig.methods.webauthn.warnings as warning}
											<div class="warning-message">
												<span class="warning-icon">⚠️</span>
												{warning}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<!-- OAuth Providers -->
						{#if availableMethods.oauth && oauthProviders.length > 0}
							<div class="auth-method oauth-auth">
								<div class="method-header">
									<h4>
										<span class="method-icon">🌐</span>
										Social Sign In
									</h4>
									<p>Sign in with your social account</p>
								</div>

								<div class="oauth-providers">
									{#each oauthProviders as provider}
										<OAuthLoginButton
											provider={provider.id}
											{returnTo}
											data-testid="auth-oauth-{provider.id}"
											on:error={handleOAuthError}
										/>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					{#if authConfig?.security && !authConfig.security.isSecure}
						<div class="security-notice">
							<span class="info-icon">ℹ️</span>
							<span class="notice-text">
								For enhanced security, use HTTPS in production environments.
							</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}
</Modal>

<style>
	.auth-modal-content {
		padding: 1rem;
		min-height: 200px;
		max-width: 500px;
		margin: 0 auto;
	}

	/* Mobile responsive styles */
	@media (max-width: 768px) {
		.auth-modal-content {
			padding: 0.75rem;
			min-height: 150px;
		}

		.auth-methods {
			gap: 1rem;
		}

		.auth-method {
			padding: 1rem;
			border-radius: 6px;
		}

		.loading-state,
		.error-state,
		.no-methods-state {
			padding: 1.5rem;
		}

		.tunnel-warning {
			font-size: 0.8125rem;
			padding: 0.375rem 0.5rem;
		}
	}

	@media (max-width: 640px) {
		.auth-modal-content {
			padding: 0.5rem;
		}

		.auth-methods {
			gap: 0.75rem;
		}

		.auth-method {
			padding: 0.75rem;
			border-radius: 4px;
		}

		.loading-state,
		.error-state,
		.no-methods-state {
			padding: 1rem;
			gap: 0.75rem;
		}

		.method-header h4 {
			font-size: 0.9375rem;
		}

		.method-description {
			font-size: 0.8125rem;
		}
	}

	@media (max-width: 480px) {
		.auth-modal-content {
			padding: 0.375rem;
		}

		.auth-method {
			padding: 0.625rem;
		}

		.error-icon,
		.warning-icon {
			font-size: 1.5rem;
		}

		.auth-header h3 {
			font-size: 1.125rem;
		}
	}

	/* Landscape mobile adjustments */
	@media (max-height: 600px) and (orientation: landscape) {
		.loading-state,
		.error-state,
		.no-methods-state {
			padding: 1rem;
		}

		.auth-methods {
			gap: 0.75rem;
		}

		.auth-method {
			padding: 0.75rem;
		}
	}

	/* Touch-friendly button sizing */
	@media (pointer: coarse) {
		button,
		.oauth-button,
		.webauthn-button {
			min-height: 44px; /* iOS/Android touch target minimum */
			min-width: 44px;
		}
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}

	/* Error State */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}

	.error-icon,
	.warning-icon {
		font-size: 2rem;
	}

	.error-state h3,
	.no-methods-state h3 {
		margin: 0;
		color: var(--color-error);
	}

	/* No Methods State */
	.no-methods-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}

	/* Auth Methods */
	.auth-methods {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.auth-header {
		text-align: center;
		margin-bottom: 1rem;
	}

	.auth-header h3 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
	}

	.tunnel-warning {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--color-warning-bg);
		border: 1px solid var(--color-warning);
		border-radius: 4px;
		font-size: 0.875rem;
		color: var(--color-warning);
		margin-top: 0.5rem;
	}

	.methods-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.methods-container.single-method .auth-method {
		border: none;
		padding: 0;
		background: none;
	}

	/* Authentication Method */
	.auth-method {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		background: var(--color-bg-secondary);
	}

	.method-header {
		margin-bottom: 1rem;
	}

	.method-header h4 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		color: var(--color-text);
	}

	.method-icon {
		font-size: 1.25rem;
	}

	.method-header p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Local Auth Form */
	.local-auth-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.input-group {
		position: relative;
	}

	.input-group input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	.input-group input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
	}

	.input-group input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Error Messages */
	.error-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-error-bg);
		color: var(--color-error);
		border: 1px solid var(--color-error);
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.error-icon {
		flex-shrink: 0;
	}

	/* Method Warnings */
	.method-warnings {
		margin-top: 1rem;
	}

	.warning-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--color-warning-bg);
		color: var(--color-warning);
		border: 1px solid var(--color-warning);
		border-radius: 4px;
		font-size: 0.875rem;
	}

	/* OAuth Providers */
	.oauth-providers {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Security Notice */
	.security-notice {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-info-bg);
		border: 1px solid var(--color-info);
		border-radius: 4px;
		font-size: 0.875rem;
		color: var(--color-info);
		margin-top: 1rem;
		text-align: center;
	}

	.info-icon {
		flex-shrink: 0;
	}

	/* Mobile Responsiveness */
	@media (max-width: 480px) {
		.auth-modal-content {
			padding: 0.75rem;
		}

		.auth-method {
			padding: 1rem;
		}

		.method-header h4 {
			font-size: 1rem;
		}

		.input-group input {
			padding: 0.625rem 0.75rem;
		}
	}

	/* Focus Management */
	.auth-modal-content:focus {
		outline: none;
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.auth-method {
			border-width: 2px;
		}

		.input-group input {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.input-group input {
			transition: none;
		}
	}
</style>