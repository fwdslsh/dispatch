<!--
	Login Page - Cookie-Based Authentication
	Handles API key login with session cookie creation
-->

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { AuthViewModel } from '$lib/client/shared/state/AuthViewModel.svelte.js';
	import Button from '$lib/client/shared/components/Button.svelte';

	// SvelteKit form action response
	/** @type {{ form: import('./$types').ActionData }} */
	let { form } = $props();

	// Initialize AuthViewModel
	const authViewModel = new AuthViewModel();

	// Component state
	let apiKey = $state('');
	let isSubmitting = $state(false);
	let showError = $state(true); // Controls whether to display form error
	let initialApiKey = $state(''); // Track initial value after error

	// Clear error when apiKey changes after an error is shown
	$effect(() => {
		// If we have an error showing and apiKey changed from initial value, clear error
		if (showError && apiKey !== initialApiKey) {
			showError = false;
		}
	});

	onMount(async () => {
		// Check if already authenticated
		const initResult = await authViewModel.initialize();
		if (initResult.redirectToWorkspace) {
			/* eslint-disable svelte/no-navigation-without-resolve */
			await goto('/');
			/* eslint-enable svelte/no-navigation-without-resolve */
		}
	});

	// Handle form submission with progressive enhancement
	const handleEnhance = ({ formData: _formData, cancel: _cancel, submitter: _submitter }) => {
		isSubmitting = true;

		// Let SvelteKit handle the submission
		return async ({ result, update }) => {
			isSubmitting = false;

			if (result.type === 'redirect') {
				// Successful login - redirect handled by SvelteKit
				/* eslint-disable svelte/no-navigation-without-resolve */
				await goto(result.location);
				/* eslint-enable svelte/no-navigation-without-resolve */
			} else if (result.type === 'failure') {
				// Error handled via form.error below
				initialApiKey = apiKey; // Capture current value before showing error
				showError = true; // Show the new error message
				await update();
			} else {
				// For any other result type, reset state
				await update();
			}
		};
	};
</script>

<svelte:head>
	<title>Login - Dispatch</title>
	<meta name="description" content="Log in to your Dispatch development environment" />
</svelte:head>

<div class="login-page">
	<div class="login-container">
		<div class="login-card">
			<!-- Header -->
			<div class="login-header">
				<h1>Welcome to Dispatch</h1>
				<p class="login-subtitle">Log in to access your development environment</p>
			</div>

			<!-- API Key Login Form -->
			<form method="POST" action="?/login" use:enhance={handleEnhance} class="login-form">
				<div class="form-group">
					<input
						id="api-key"
						name="key"
						type="password"
						placeholder="Enter your API key"
						autocomplete="off"
						bind:value={apiKey}
						disabled={isSubmitting}
						required
						class="form-input"
						aria-describedby={form?.error && showError ? 'login-error' : undefined}
					/>
				</div>

				{#if form?.error && showError}
					<div id="login-error" class="error-message" role="alert">
						{form.error}
					</div>
				{/if}

				<Button
					type="submit"
					variant="primary"
					disabled={isSubmitting || !apiKey.trim()}
					loading={isSubmitting}
					fullWidth={true}
				>
					{#if isSubmitting}
						Logging in...
					{:else}
						Log In
					{/if}
				</Button>
			</form>

			<!-- OAuth Options (if configured) -->
			{#if authViewModel.hasOAuthAuth}
				<div class="divider">
					<span>or</span>
				</div>

				<div class="oauth-buttons">
					<button
						type="button"
						class="oauth-button oauth-github"
						onclick={() => authViewModel.loginWithOAuth('github')}
						disabled={isSubmitting}
					>
						<svg class="oauth-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
							/>
						</svg>
						Log in with GitHub
					</button>

					<button
						type="button"
						class="oauth-button oauth-google"
						onclick={() => authViewModel.loginWithOAuth('google')}
						disabled={isSubmitting}
					>
						<svg class="oauth-icon" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								fill="#4285F4"
							/>
							<path
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								fill="#34A853"
							/>
							<path
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								fill="#FBBC05"
							/>
							<path
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								fill="#EA4335"
							/>
						</svg>
						Log in with Google
					</button>
				</div>
			{/if}

			<!-- Footer Links -->
			<div class="login-footer">
				<p class="footer-text">
					First time here?
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href="/onboarding" class="footer-link">Get started</a>
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-4);
		background: var(--surface);
	}

	.login-container {
		width: 100%;
		max-width: 420px;
	}

	.login-card {
		background: var(--surface-primary-98);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		padding: var(--space-6);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.login-header {
		text-align: center;
		margin-bottom: var(--space-6);
	}

	.login-header h1 {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 600;
	}

	.login-subtitle {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-input {
		width: 100%;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		transition: all 0.2s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-15);
	}

	.form-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		padding: var(--space-3);
		background: color-mix(in oklab, var(--error) 10%, transparent);
		border: 1px solid var(--error);
		border-radius: var(--radius-sm);
		color: var(--error);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-5) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}

	.oauth-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.oauth-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.oauth-button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--primary) 5%, var(--surface));
		border-color: var(--primary);
	}

	.oauth-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.oauth-icon {
		width: 20px;
		height: 20px;
		fill: currentColor;
	}

	.login-footer {
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
		text-align: center;
	}

	.footer-text {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.footer-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 500;
		transition: opacity 0.2s ease;
	}

	.footer-link:hover {
		opacity: 0.8;
	}

	/* Responsive Design */
	@media (max-width: 480px) {
		.login-card {
			padding: var(--space-4);
		}

		.login-header h1 {
			font-size: var(--font-size-3);
		}
	}

	/* Accessibility */
	.form-input:focus-visible,
	.oauth-button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.form-input,
		.oauth-button,
		.footer-link {
			transition: none;
		}
	}
</style>
 
