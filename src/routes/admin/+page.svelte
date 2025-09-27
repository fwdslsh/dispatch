<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AuthModeConfig from '$lib/client/shared/components/AuthModeConfig.svelte';
	import OAuthAccountManager from '$lib/client/shared/components/OAuthAccountManager.svelte';
	import WebAuthnManager from '$lib/client/shared/components/WebAuthnManager.svelte';
	import AuthStatusIndicator from '$lib/client/shared/components/AuthStatusIndicator.svelte';

	let currentUser = $state(null);
	let authConfig = $state(null);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			// Check if user is authenticated and is admin
			const authResponse = await fetch('/api/auth/status');
			if (!authResponse.ok) {
				goto('/');
				return;
			}

			const authData = await authResponse.json();
			if (!authData.authenticated || !authData.user?.isAdmin) {
				goto('/');
				return;
			}

			currentUser = authData.user;

			// Get authentication configuration
			const configResponse = await fetch('/api/auth/config');
			if (configResponse.ok) {
				authConfig = await configResponse.json();
			}

		} catch (err) {
			error = 'Failed to load admin interface';
			console.error('Admin page error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Admin - dispatch</title>
</svelte:head>

{#if loading}
	<div class="loading">Loading admin interface...</div>
{:else if error}
	<div class="error">{error}</div>
{:else}
	<main class="admin-container">
		<header class="admin-header">
			<h1>Authentication Administration</h1>
			<AuthStatusIndicator user={currentUser} />
		</header>

		<div class="admin-sections">
			<section class="auth-section">
				<h2>Authentication Configuration</h2>
				<AuthModeConfig config={authConfig} />
			</section>

			<section class="oauth-section">
				<h2>OAuth Providers</h2>
				<OAuthAccountManager />
			</section>

			<section class="webauthn-section">
				<h2>WebAuthn / Passkeys</h2>
				<WebAuthnManager />
			</section>
		</div>
	</main>
{/if}

<style>
	.admin-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: var(--space-6);
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-8);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--surface-border);
	}

	.admin-header h1 {
		font-size: var(--font-size-6);
		color: var(--primary);
		margin: 0;
	}

	.admin-sections {
		display: grid;
		gap: var(--space-8);
	}

	.admin-sections section {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		padding: var(--space-6);
	}

	.admin-sections h2 {
		margin: 0 0 var(--space-4) 0;
		color: var(--text);
		font-size: var(--font-size-4);
	}

	.loading, .error {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		font-size: var(--font-size-3);
	}

	.error {
		color: var(--destructive);
	}
</style>