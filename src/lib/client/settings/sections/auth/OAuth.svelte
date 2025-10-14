<!--
	OAuthSettings Component
	Configures OAuth providers (GitHub, Google) for authentication
	Follows Dispatch retro-terminal aesthetic with MVVM pattern
-->

<script>
	import { onMount } from 'svelte';
	import Button from '../../../shared/components/Button.svelte';
	import InfoBox from '../../../shared/components/InfoBox.svelte';

	// Component state
	let loading = $state(false);
	let saving = $state(false);
	let error = $state('');
	let successMessage = $state('');

	// OAuth provider configurations
	let providers = $state({
		github: {
			enabled: false,
			clientId: '',
			clientSecret: ''
		},
		google: {
			enabled: false,
			clientId: '',
			clientSecret: ''
		}
	});

	// Track original values for change detection
	let originalProviders = $state(null);

	// Derived state
	let hasChanges = $derived.by(() => {
		if (!originalProviders) return false;
		return JSON.stringify(providers) !== JSON.stringify(originalProviders);
	});

	let canSave = $derived.by(() => {
		return hasChanges && !saving && !loading;
	});

	// =================================================================
	// LIFECYCLE
	// =================================================================

	onMount(async () => {
		await loadOAuthSettings();
	});

	// =================================================================
	// LOAD SETTINGS
	// =================================================================

	async function loadOAuthSettings() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/settings/oauth', {
				method: 'GET',
				credentials: 'include'
			});

			if (response.ok) {
				const data = await response.json();
				providers = {
					github: {
						enabled: data.github?.enabled || false,
						clientId: data.github?.clientId || '',
						clientSecret: '' // Never sent from server
					},
					google: {
						enabled: data.google?.enabled || false,
						clientId: data.google?.clientId || '',
						clientSecret: '' // Never sent from server
					}
				};

				// Store original values
				originalProviders = JSON.parse(JSON.stringify(providers));
			} else {
				const data = await response.json().catch(() => ({}));
				error = data?.error || 'Failed to load OAuth settings';
			}
		} catch (_err) {
			error = 'Unable to reach server';
		} finally {
			loading = false;
		}
	}

	// =================================================================
	// SAVE SETTINGS
	// =================================================================

	async function handleSave() {
		saving = true;
		error = '';
		successMessage = '';

		try {
			const response = await fetch('/api/settings/oauth', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					providers: providers
				})
			});

			if (response.ok) {
				successMessage = 'OAuth settings saved successfully';

				// Reload to get updated state (without secrets)
				await loadOAuthSettings();

				// Clear success message after 3 seconds
				setTimeout(() => {
					successMessage = '';
				}, 3000);
			} else {
				const data = await response.json().catch(() => ({}));
				error = data?.error || 'Failed to save OAuth settings';
			}
		} catch (_err) {
			error = 'Unable to reach server';
		} finally {
			saving = false;
		}
	}

	// =================================================================
	// PROVIDER HANDLERS
	// =================================================================

	function toggleProvider(providerName) {
		providers[providerName].enabled = !providers[providerName].enabled;

		// Clear credentials if disabling
		if (!providers[providerName].enabled) {
			providers[providerName].clientId = '';
			providers[providerName].clientSecret = '';
		}
	}

	function updateClientId(providerName, value) {
		providers[providerName].clientId = value;
	}

	function updateClientSecret(providerName, value) {
		providers[providerName].clientSecret = value;
	}

	function handleDiscard() {
		if (originalProviders) {
			providers = JSON.parse(JSON.stringify(originalProviders));
		}
		error = '';
		successMessage = '';
	}

	function clearError() {
		error = '';
	}

	function clearSuccess() {
		successMessage = '';
	}

	// =================================================================
	// PROVIDER METADATA
	// =================================================================

	const providerMeta = {
		github: {
			name: 'GitHub',
			icon: 'github',
			docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps',
			description: 'Allow users to log in with their GitHub account'
		},
		google: {
			name: 'Google',
			icon: 'google',
			docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
			description: 'Allow users to log in with their Google account'
		}
	};
</script>

<div class="oauth-settings" data-testid="oauth-settings">
	<div class="settings-header">
		<h4>OAuth Provider Configuration</h4>
		<p class="settings-description">
			Enable and configure OAuth providers to allow users to authenticate using external services.
			Providers must be configured before users can log in via OAuth.
		</p>
	</div>

	<!-- Messages -->
	{#if error}
		<InfoBox variant="error">
			<strong>Error:</strong>
			{error}
			<button class="message-close" onclick={clearError} aria-label="Dismiss error">×</button>
		</InfoBox>
	{/if}

	{#if successMessage}
		<InfoBox variant="success">
			<strong>Success:</strong>
			{successMessage}
			<button class="message-close" onclick={clearSuccess} aria-label="Dismiss message">×</button>
		</InfoBox>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading OAuth settings...</p>
		</div>
	{:else}
		<!-- Provider Configurations -->
		<div class="providers-container">
			{#each Object.entries(providerMeta) as [providerKey, meta] (providerKey)}
				{@const config = providers[providerKey]}
				<div class="provider-card">
					<div class="provider-header">
						<div class="provider-info">
							<h5 class="provider-name">{meta.name}</h5>
							<p class="provider-description">{meta.description}</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								checked={config.enabled}
								onchange={() => toggleProvider(providerKey)}
								disabled={saving}
								aria-label="Enable {meta.name} OAuth"
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					{#if config.enabled}
						<div class="provider-config">
							<div class="form-group">
								<label for="{providerKey}-client-id" class="form-label">
									Client ID
									<!-- External documentation link (not a route) -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a
										href={meta.docsUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="docs-link"
										title="View {meta.name} OAuth documentation"
									>
										📖 Docs
									</a>
								</label>
								<input
									id="{providerKey}-client-id"
									type="text"
									class="form-input"
									placeholder="Enter {meta.name} Client ID"
									value={config.clientId}
									oninput={(e) =>
										updateClientId(providerKey, /** @type {HTMLInputElement} */ (e.target).value)}
									disabled={saving}
								/>
							</div>

							<div class="form-group">
								<label for="{providerKey}-client-secret" class="form-label">
									Client Secret
									{#if !config.clientSecret && originalProviders?.[providerKey]?.enabled}
										<span class="secret-hint">(unchanged)</span>
									{/if}
								</label>
								<input
									id="{providerKey}-client-secret"
									type="password"
									class="form-input"
									placeholder={config.clientSecret
										? 'Enter new secret to update'
										: 'Enter {meta.name} Client Secret'}
									value={config.clientSecret}
									oninput={(e) =>
										updateClientSecret(
											providerKey,
											/** @type {HTMLInputElement} */ (e.target).value
										)}
									disabled={saving}
									autocomplete="off"
								/>
								<p class="input-hint">
									Client secrets are encrypted and never displayed. Leave blank to keep existing
									secret.
								</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Action Buttons -->
		<div class="settings-actions">
			<Button
				type="button"
				variant="primary"
				onclick={handleSave}
				disabled={!canSave}
				loading={saving}
			>
				{#if saving}
					Saving...
				{:else}
					Save OAuth Settings
				{/if}
			</Button>

			{#if hasChanges}
				<Button type="button" variant="secondary" onclick={handleDiscard} disabled={saving}>
					Discard Changes
				</Button>
			{/if}
		</div>

		<!-- Security Notice -->
		<InfoBox variant="info">
			<strong>Security Notice:</strong>
			OAuth client secrets are encrypted at rest and never sent to the browser. Enabling OAuth providers
			requires valid redirect URIs to be configured in your OAuth application settings.
		</InfoBox>
	{/if}
</div>

<style>
	.oauth-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.settings-header h4 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
	}

	.settings-description {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-8);
		text-align: center;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--line);
		border-top-color: var(--primary);
		border-radius: var(--radius-full);
		animation: spin 0.8s linear infinite;
		margin-bottom: var(--space-3);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Provider Cards */
	.providers-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.provider-card {
		padding: var(--space-4);
		background: var(--surface-primary-98);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}

	.provider-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.provider-info {
		flex: 1;
	}

	.provider-name {
		margin: 0 0 var(--space-1) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
	}

	.provider-description {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	/* Toggle Switch */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 48px;
		height: 24px;
		flex-shrink: 0;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--line);
		transition: 0.3s;
		border-radius: var(--radius-full);
	}

	.toggle-slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: var(--surface);
		transition: 0.3s;
		border-radius: var(--radius-full);
	}

	.toggle-switch input:checked + .toggle-slider {
		background-color: var(--primary);
	}

	.toggle-switch input:checked + .toggle-slider:before {
		transform: translateX(24px);
	}

	.toggle-switch input:disabled + .toggle-slider {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Provider Config */
	.provider-config {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 500;
	}

	.docs-link {
		color: var(--primary);
		text-decoration: none;
		font-size: var(--font-size-0);
		transition: opacity 0.2s ease;
	}

	.docs-link:hover {
		opacity: 0.8;
	}

	.secret-hint {
		color: var(--muted);
		font-size: var(--font-size-0);
		font-weight: 400;
	}

	.input-hint {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	/* Action Buttons */
	.settings-actions {
		display: flex;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	.message-close {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		background: transparent;
		border: none;
		color: inherit;
		font-size: var(--space-5);
		line-height: 1;
		cursor: pointer;
		padding: var(--space-1);
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.message-close:hover {
		opacity: 1;
	}

	/* Responsive Design */
	@media (max-width: 640px) {
		.provider-header {
			flex-direction: column;
		}

		.settings-actions {
			flex-direction: column;
		}
	}
</style>
