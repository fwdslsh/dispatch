<!-- KeysSettings.svelte: Settings section for API keys management -->
<script>
	import ApiKeyManager from '../../ApiKeyManager.svelte';
	import Button from '../../../shared/components/Button.svelte';

	let isLoggingOut = $state(false);

	async function handleLogout() {
		isLoggingOut = true;
		try {
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});

			if (response.redirected) {
				// Follow the redirect to login page
				window.location.href = response.url;
			} else {
				// Manually redirect to login if not automatically redirected
				window.location.href = '/login';
			}
		} catch (err) {
			console.error('Logout failed:', err);
			isLoggingOut = false;
		}
	}
</script>

<div class="settings-section-keys">
	<ApiKeyManager />

	<!-- Logout Section -->
	<div class="logout-section">
		<hr class="divider" />
		<div class="logout-container">
			<div>
				<h4>Session</h4>
				<p class="logout-description">Log out of your current session to clear authentication.</p>
			</div>
			<Button variant="secondary" onclick={handleLogout} disabled={isLoggingOut} loading={isLoggingOut}>
				{#if isLoggingOut}
					Logging out...
				{:else}
					Logout
				{/if}
			</Button>
		</div>
	</div>
</div>

<style>
	.settings-section-keys {
		padding: var(--space-4) 0;
	}

	.logout-section {
		margin-top: var(--space-6);
	}

	.divider {
		border: none;
		border-top: 1px solid var(--line);
		margin: var(--space-6) 0;
	}

	.logout-container {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-4);
	}

	.logout-container h4 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
	}

	.logout-description {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}
</style>
