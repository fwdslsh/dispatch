<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let loading = $state(true);
	let error = $state(null);

	onMount(async () => {
		try {
			// Get the OAuth code from URL parameters
			const code = $page.url.searchParams.get('code');
			const state = $page.url.searchParams.get('state');
			const error_param = $page.url.searchParams.get('error');

			if (error_param) {
				error = `OAuth error: ${error_param}`;
				loading = false;
				return;
			}

			if (!code) {
				error = 'No authorization code received';
				loading = false;
				return;
			}

			// Send the code to the server for token exchange
			const response = await fetch('/api/auth/callback', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ code, state })
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				error = result.error || 'Authentication failed';
				loading = false;
				return;
			}

			// Store authentication data
			if (result.session) {
				localStorage.setItem('authSessionId', result.session.sessionId);
				localStorage.setItem('authUserId', result.session.userId);
				localStorage.setItem('authProvider', result.session.provider);
				if (result.session.expiresAt) {
					localStorage.setItem('authExpiresAt', result.session.expiresAt);
				}
			}

			// Redirect to home page
			await goto('/', { replaceState: true });
		} catch (err) {
			console.error('OAuth callback error:', err);
			error = err.message || 'An unexpected error occurred';
			loading = false;
		}
	});
</script>

<div class="callback-container">
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Completing authentication...</p>
		</div>
	{:else if error}
		<div class="error">
			<h1>Authentication Failed</h1>
			<p>{error}</p>
			<button onclick={() => goto('/')}>Return to Home</button>
		</div>
	{/if}
</div>

<style>
	.callback-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-4);
	}

	.loading {
		text-align: center;
	}

	.spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto var(--space-3);
		border: 4px solid color-mix(in oklab, var(--accent) 20%, transparent);
		border-top: 4px solid var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error {
		text-align: center;
		max-width: 500px;
	}

	.error h1 {
		color: var(--danger);
		margin-bottom: var(--space-3);
	}

	.error p {
		margin-bottom: var(--space-4);
		color: var(--muted);
	}

	.error button {
		padding: var(--space-2) var(--space-4);
		background: var(--accent);
		color: var(--bg);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: var(--font-size-2);
	}

	.error button:hover {
		opacity: 0.9;
	}
</style>
