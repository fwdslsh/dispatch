<script>
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';

	export let userId;

	const dispatch = createEventDispatcher();

	let accounts = [];
	let loading = true;
	let error = null;
	let showUnlinkConfirm = false;
	let accountToUnlink = null;

	// Provider configurations
	const providers = {
		google: {
			name: 'Google',
			icon: '🔍',
			color: '#4285f4'
		},
		github: {
			name: 'GitHub',
			icon: '🐙',
			color: '#333333'
		}
	};

	onMount(async () => {
		await loadAccounts();
		loading = false;
	});

	async function loadAccounts() {
		try {
			const response = await fetch(`/api/auth/oauth/accounts?userId=${userId}`);
			const data = await response.json();

			if (data.success) {
				accounts = data.accounts;
			} else {
				error = data.error || 'Failed to load OAuth accounts';
			}
		} catch (err) {
			error = err.message;
		}
	}

	function confirmUnlink(account) {
		accountToUnlink = account;
		showUnlinkConfirm = true;
	}

	async function unlinkAccount() {
		if (!accountToUnlink) return;

		try {
			const response = await fetch('/api/auth/oauth/accounts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					accountId: accountToUnlink.id,
					userId
				})
			});

			const data = await response.json();
			if (data.success) {
				dispatch('success', { message: 'OAuth account unlinked successfully' });
				await loadAccounts();
			} else {
				dispatch('error', { error: data.error || 'Failed to unlink OAuth account' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		} finally {
			showUnlinkConfirm = false;
			accountToUnlink = null;
		}
	}

	async function refreshTokens(account) {
		try {
			const response = await fetch('/api/auth/oauth/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accountId: account.id })
			});

			const data = await response.json();
			if (data.success) {
				dispatch('success', { message: 'Tokens refreshed successfully' });
				await loadAccounts();
			} else {
				dispatch('error', { error: data.error || 'Failed to refresh tokens' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		}
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}

	function getProviderConfig(provider) {
		return providers[provider] || { name: provider, icon: '🌐', color: '#666666' };
	}
</script>

<div class="oauth-manager">
	<h3>Connected OAuth Accounts</h3>

	{#if loading}
		<div class="loading">
			<LoadingSpinner />
			<p>Loading OAuth accounts...</p>
		</div>
	{:else if error}
		<div class="error">
			<p>Error: {error}</p>
			<Button variant="secondary" on:click={loadAccounts}>Retry</Button>
		</div>
	{:else}
		<div class="accounts-section">
			{#if accounts.length === 0}
				<div class="no-accounts">
					<p>No OAuth accounts connected</p>
					<p>You can connect OAuth accounts during login or through your profile settings</p>
				</div>
			{:else}
				<div class="accounts-list">
					{#each accounts as account}
						<div class="account-item" class:expired={account.isExpired}>
							<div class="account-info">
								<div
									class="provider-icon"
									style="color: {getProviderConfig(account.provider).color}"
								>
									{getProviderConfig(account.provider).icon}
								</div>
								<div class="details">
									<div class="provider-name">
										{getProviderConfig(account.provider).name}
									</div>
									<div class="account-details">
										{#if account.providerEmail}
											<span class="email">{account.providerEmail}</span>
										{/if}
										{#if account.providerName}
											<span class="name">({account.providerName})</span>
										{/if}
									</div>
									<div class="metadata">
										Connected: {formatDate(account.createdAt)}
										{#if account.updatedAt !== account.createdAt}
											• Updated: {formatDate(account.updatedAt)}
										{/if}
									</div>
									{#if account.isExpired}
										<div class="status expired">⚠️ Token Expired</div>
									{/if}
								</div>
							</div>
							<div class="account-actions">
								{#if account.isExpired}
									<Button variant="primary" size="sm" on:click={() => refreshTokens(account)}>
										Refresh
									</Button>
								{/if}
								<Button variant="danger" size="sm" on:click={() => confirmUnlink(account)}>
									Unlink
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Unlink Confirmation Dialog -->
{#if showUnlinkConfirm && accountToUnlink}
	<ConfirmationDialog
		title="Unlink OAuth Account"
		message="Are you sure you want to unlink your {getProviderConfig(accountToUnlink.provider)
			.name} account? You will need to authenticate again to use this account."
		confirmText="Unlink"
		confirmVariant="danger"
		on:confirm={unlinkAccount}
		on:cancel={() => {
			showUnlinkConfirm = false;
			accountToUnlink = null;
		}}
	/>
{/if}

<style>
	.oauth-manager {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1rem;
		margin: 1rem 0;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 0;
		justify-content: center;
	}

	.error {
		text-align: center;
		padding: 1rem;
		color: var(--color-error);
	}

	.accounts-section {
		margin-top: 1rem;
	}

	.no-accounts {
		text-align: center;
		padding: 2rem;
		color: var(--color-text-secondary);
	}

	.accounts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.account-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		transition: border-color 0.2s ease;
	}

	.account-item.expired {
		border-color: var(--color-warning);
		background: var(--color-warning-bg);
	}

	.account-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
	}

	.provider-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.details {
		flex: 1;
	}

	.provider-name {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.account-details {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.email {
		color: var(--color-text-primary);
		font-size: 0.9rem;
	}

	.name {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.metadata {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.status {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.status.expired {
		color: var(--color-warning);
	}

	.account-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.account-item {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.account-actions {
			align-self: stretch;
			justify-content: flex-end;
		}
	}
</style>
