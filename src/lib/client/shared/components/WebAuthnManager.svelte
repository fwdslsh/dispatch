<script>
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import WebAuthnButton from './WebAuthnButton.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';
	import { checkWebAuthnAvailability } from '../utils/webauthn.js';

	export let userId;
	export let username;

	const dispatch = createEventDispatcher();

	let credentials = [];
	let loading = true;
	let error = null;
	let availability = null;
	let showRegisterForm = false;
	let showDeleteConfirm = false;
	let credentialToDelete = null;
	let deviceName = '';

	onMount(async () => {
		await Promise.all([loadCredentials(), checkAvailability()]);
		loading = false;
	});

	async function loadCredentials() {
		try {
			const response = await fetch(`/api/webauthn/credentials?userId=${userId}`);
			const data = await response.json();

			if (data.success) {
				credentials = data.credentials;
			} else {
				error = data.details || 'Failed to load credentials';
			}
		} catch (err) {
			error = err.message;
		}
	}

	async function checkAvailability() {
		availability = await checkWebAuthnAvailability();
	}

	function handleRegistrationSuccess(event) {
		const { message } = event.detail;
		dispatch('success', { message });
		loadCredentials();
		showRegisterForm = false;
		deviceName = '';
	}

	function handleRegistrationError(event) {
		const { error } = event.detail;
		dispatch('error', { error });
	}

	function confirmDelete(credential) {
		credentialToDelete = credential;
		showDeleteConfirm = true;
	}

	async function deleteCredential() {
		if (!credentialToDelete) return;

		try {
			const response = await fetch('/api/webauthn/credentials', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					credentialId: credentialToDelete.id,
					userId
				})
			});

			const data = await response.json();
			if (data.success) {
				dispatch('success', { message: 'Credential removed successfully' });
				loadCredentials();
			} else {
				dispatch('error', { error: data.details || 'Failed to remove credential' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		} finally {
			showDeleteConfirm = false;
			credentialToDelete = null;
		}
	}

	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString();
	}

	function getDeviceIcon(deviceName) {
		const name = deviceName.toLowerCase();
		if (name.includes('touch') || name.includes('face')) return '📱';
		if (name.includes('windows') || name.includes('hello')) return '💻';
		if (name.includes('yubikey') || name.includes('security')) return '🔑';
		return '🔐';
	}
</script>

<div class="webauthn-manager">
	<h3>WebAuthn / Passkeys</h3>

	{#if loading}
		<div class="loading">
			<LoadingSpinner />
			<p>Loading WebAuthn credentials...</p>
		</div>
	{:else if error}
		<div class="error">
			<p>Error: {error}</p>
			<Button variant="secondary" on:click={loadCredentials}>Retry</Button>
		</div>
	{:else}
		<!-- Availability Status -->
		{#if availability}
			<div class="availability">
				<div class="status {availability.overall ? 'available' : 'unavailable'}">
					{#if availability.overall}
						✅ WebAuthn Available
					{:else}
						❌ WebAuthn Unavailable
					{/if}
				</div>

				{#if availability.warnings.length > 0}
					<div class="warnings">
						{#each availability.warnings as warning}
							<div class="warning {warning.severity}">
								{warning.message}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Credentials List -->
		<div class="credentials-section">
			<div class="section-header">
				<h4>Your Passkeys ({credentials.length})</h4>
				{#if availability?.overall}
					<Button
						variant="primary"
						size="sm"
						on:click={() => (showRegisterForm = !showRegisterForm)}
					>
						{showRegisterForm ? 'Cancel' : 'Add Passkey'}
					</Button>
				{/if}
			</div>

			{#if showRegisterForm && availability?.overall}
				<div class="register-form">
					<h5>Register New Passkey</h5>
					<label>
						Device Name:
						<input
							type="text"
							bind:value={deviceName}
							placeholder="e.g., iPhone Touch ID, YubiKey"
						/>
					</label>
					<WebAuthnButton
						mode="register"
						{userId}
						{deviceName}
						on:success={handleRegistrationSuccess}
						on:error={handleRegistrationError}
					/>
				</div>
			{/if}

			{#if credentials.length === 0}
				<div class="no-credentials">
					<p>No passkeys registered</p>
					{#if availability?.overall}
						<p>Click "Add Passkey" to register your first passkey</p>
					{:else}
						<p>WebAuthn must be available to register passkeys</p>
					{/if}
				</div>
			{:else}
				<div class="credentials-list">
					{#each credentials as credential}
						<div class="credential-item">
							<div class="credential-info">
								<div class="device-icon">
									{getDeviceIcon(credential.deviceName)}
								</div>
								<div class="details">
									<div class="device-name">{credential.deviceName}</div>
									<div class="metadata">
										Created: {formatDate(credential.createdAt)}
										{#if credential.lastUsedAt}
											• Last used: {formatDate(credential.lastUsedAt)}
										{/if}
									</div>
								</div>
							</div>
							<Button variant="danger" size="sm" on:click={() => confirmDelete(credential)}>
								Remove
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm && credentialToDelete}
	<ConfirmationDialog
		title="Remove Passkey"
		message="Are you sure you want to remove the passkey '{credentialToDelete.deviceName}'? This action cannot be undone."
		confirmText="Remove"
		confirmVariant="danger"
		on:confirm={deleteCredential}
		on:cancel={() => {
			showDeleteConfirm = false;
			credentialToDelete = null;
		}}
	/>
{/if}

<style>
	.webauthn-manager {
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
	}

	.error {
		text-align: center;
		padding: 1rem;
		color: var(--color-error);
	}

	.availability {
		margin-bottom: 1rem;
	}

	.status {
		padding: 0.5rem;
		border-radius: 4px;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.status.available {
		background: var(--color-success-bg);
		color: var(--color-success);
		border: 1px solid var(--color-success);
	}

	.status.unavailable {
		background: var(--color-error-bg);
		color: var(--color-error);
		border: 1px solid var(--color-error);
	}

	.warnings {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.warning {
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.warning.error {
		background: var(--color-error-bg);
		color: var(--color-error);
		border: 1px solid var(--color-error);
	}

	.warning.warning {
		background: var(--color-warning-bg);
		color: var(--color-warning);
		border: 1px solid var(--color-warning);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.register-form {
		background: var(--color-bg-secondary);
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.register-form label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	.register-form input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.no-credentials {
		text-align: center;
		padding: 2rem;
		color: var(--color-text-secondary);
	}

	.credentials-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.credential-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.credential-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.device-icon {
		font-size: 1.5rem;
	}

	.device-name {
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.metadata {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}
</style>
