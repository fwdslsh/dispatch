<!--
	OAuthSettings Section
	Handles OAuth configuration including client ID, redirect URI, and scope settings
-->

<script>
	import { SettingsViewModel } from '../SettingsViewModel.svelte.js';
	import { OAuthProviders, generateExampleRedirectUri } from '../OAuthProviderModel.js';
	import SettingField from '$lib/client/shared/components/SettingField.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';

	/**
	 * @type {SettingsViewModel}
	 */
	let { settingsViewModel } = $props();

	// Get OAuth settings using getter methods
	let oauthClientIdSetting = $derived.by(() => {
		return settingsViewModel.getSetting('oauth_client_id');
	});

	let oauthClientSecretSetting = $derived.by(() => {
		return settingsViewModel.getSetting('oauth_client_secret');
	});

	let oauthRedirectUriSetting = $derived.by(() => {
		return settingsViewModel.getSetting('oauth_redirect_uri');
	});

	let oauthScopeSetting = $derived.by(() => {
		return settingsViewModel.getSetting('oauth_scope');
	});

	// Current values with pending changes
	let clientIdValue = $derived.by(() => {
		if (!oauthClientIdSetting) return '';
		return settingsViewModel.getCurrentValue('oauth_client_id');
	});

	let clientSecretValue = $derived.by(() => {
		if (!oauthClientSecretSetting) return '';
		return settingsViewModel.getCurrentValue('oauth_client_secret');
	});

	let redirectUriValue = $derived.by(() => {
		if (!oauthRedirectUriSetting) return '';
		return settingsViewModel.getCurrentValue('oauth_redirect_uri');
	});

	let scopeValue = $derived.by(() => {
		if (!oauthScopeSetting) return '';
		return settingsViewModel.getCurrentValue('oauth_scope');
	});

	// Validation errors
	let clientIdErrors = $derived.by(() => {
		return settingsViewModel.getValidationErrors('oauth_client_id');
	});

	let clientSecretErrors = $derived.by(() => {
		return settingsViewModel.getValidationErrors('oauth_client_secret');
	});

	let redirectUriErrors = $derived.by(() => {
		return settingsViewModel.getValidationErrors('oauth_redirect_uri');
	});

	let scopeErrors = $derived.by(() => {
		return settingsViewModel.getValidationErrors('oauth_scope');
	});

	// Check if any OAuth settings have errors
	let hasErrors = $derived.by(() => {
		return (
			clientIdErrors.length > 0 ||
			clientSecretErrors.length > 0 ||
			redirectUriErrors.length > 0 ||
			scopeErrors.length > 0
		);
	});

	// Check if any OAuth settings have changes
	let hasChanges = $derived.by(() => {
		return (
			settingsViewModel.hasChanges('oauth_client_id') ||
			settingsViewModel.hasChanges('oauth_client_secret') ||
			settingsViewModel.hasChanges('oauth_redirect_uri') ||
			settingsViewModel.hasChanges('oauth_scope')
		);
	});

	// Handle input changes
	function handleInput(settingKey, event) {
		const value = event.target.value;
		settingsViewModel.updateSetting(settingKey, value);
	}

	// Set default redirect URI using Model utility
	function useDefaultRedirectUri() {
		const defaultUri = generateExampleRedirectUri();
		settingsViewModel.updateSetting('oauth_redirect_uri', defaultUri);
	}

	// OAuth provider selection
	let selectedProvider = $state('custom');

	// Get current provider configuration from Model
	let providerConfig = $derived.by(() => {
		return OAuthProviders[selectedProvider];
	});

	// Set common scope
	function setCommonScope(scope) {
		settingsViewModel.updateSetting('oauth_scope', scope);
	}

	// Use provider default scope
	function useProviderDefaultScope() {
		if (providerConfig.defaultScopes) {
			settingsViewModel.updateSetting('oauth_scope', providerConfig.defaultScopes);
		}
	}

	// Handle provider change
	function handleProviderChange(event) {
		selectedProvider = event.target.value;
		// Optionally set default scope for the provider
		if (providerConfig.defaultScopes && !scopeValue) {
			useProviderDefaultScope();
		}
	}
</script>

<div class="oauth-settings">
	<div class="setting-group">
		<!-- OAuth Provider Selection -->
		<div class="setting-item provider-selection">
			<label for="oauth-provider" class="setting-label">
				OAuth Provider
			</label>

			<div class="setting-description">
				Select your OAuth provider for pre-configured settings and helpful guidance. Choose "Custom Provider" for other OAuth providers.
			</div>

			<select
				id="oauth-provider"
				class="setting-input provider-select"
				bind:value={selectedProvider}
				onchange={handleProviderChange}
				data-testid="oauth-provider-select"
			>
				<option value="google">Google</option>
				<option value="github">GitHub</option>
				<option value="custom">Custom Provider</option>
			</select>

			<!-- Provider-specific setup instructions -->
			{#if providerConfig.setupInstructions}
				<div class="provider-info">
					<div class="info-icon">📋</div>
					<div class="info-content">
						<strong>Setup Instructions:</strong><br />
						{providerConfig.setupInstructions}
						{#if providerConfig.docsUrl}
							<br />
							<a href={providerConfig.docsUrl} target="_blank" rel="noopener noreferrer" class="docs-link">
								View documentation ↗
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- OAuth Client ID -->
		{#if oauthClientIdSetting}
			<SettingField
				setting={oauthClientIdSetting}
				value={clientIdValue}
				errors={clientIdErrors}
				hasChanges={settingsViewModel.hasChanges('oauth_client_id')}
				onInput={(e) => handleInput('oauth_client_id', e)}
				placeholder="Enter OAuth client ID"
				testId="oauth-client-id-input"
			/>
		{/if}

		<!-- OAuth Client Secret -->
		{#if oauthClientSecretSetting}
			<SettingField
				setting={oauthClientSecretSetting}
				value={clientSecretValue}
				errors={clientSecretErrors}
				hasChanges={settingsViewModel.hasChanges('oauth_client_secret')}
				onInput={(e) => handleInput('oauth_client_secret', e)}
				type="password"
				placeholder="Enter OAuth client secret"
				autocomplete="new-password"
				testId="oauth-client-secret-input"
			/>
		{/if}

		<!-- OAuth Redirect URI -->
		{#if oauthRedirectUriSetting}
			<div class="redirect-uri-field">
				<SettingField
					setting={oauthRedirectUriSetting}
					value={redirectUriValue}
					errors={redirectUriErrors}
					hasChanges={settingsViewModel.hasChanges('oauth_redirect_uri')}
					onInput={(e) => handleInput('oauth_redirect_uri', e)}
					type="url"
					placeholder="https://your-domain.com/auth/callback"
					testId="oauth-redirect-uri-input"
				/>

				<div class="field-actions">
					<Button
						type="button"
						variant="secondary"
						onclick={useDefaultRedirectUri}
						ariaLabel="Use default redirect URI for this domain"
						text="Use Default"
					/>
				</div>

				<div class="setting-helper">
					<span class="helper-text">
						Example: <code>{generateExampleRedirectUri()}</code>
					</span>
				</div>
			</div>
		{/if}

		<!-- OAuth Scope -->
		{#if oauthScopeSetting}
			<div class="scope-field">
				<SettingField
					setting={oauthScopeSetting}
					value={scopeValue}
					errors={scopeErrors}
					hasChanges={settingsViewModel.hasChanges('oauth_scope')}
					onInput={(e) => handleInput('oauth_scope', e)}
					placeholder="read write"
					testId="oauth-scope-input"
				/>

				<!-- Provider-specific Scopes Helper -->
				<div class="setting-helper">
					<span class="helper-label">{providerConfig.name} scopes:</span>
					<div class="scope-buttons">
						{#each providerConfig.scopeOptions as scope}
							<Button
								type="button"
								variant="ghost"
								size="small"
								onclick={() => setCommonScope(scope.value)}
								ariaLabel="Set scope to: {scope.value}"
								text={scope.label}
								augmented="none"
								data-testid="scope-button-{scope.label}"
							/>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- OAuth Configuration Notice -->
		<div class="oauth-notice">
			<div class="notice-icon">ℹ️</div>
			<div class="notice-content">
				<strong>OAuth Configuration:</strong>
				These settings configure OAuth authentication for your application. Make sure the client ID
				and redirect URI match your OAuth provider configuration exactly.
			</div>
		</div>
	</div>
</div>

<style>
	@import '$lib/client/shared/styles/settings.css';

	.oauth-settings {
		padding: var(--space-4);
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.redirect-uri-field,
	.scope-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.field-actions {
		display: flex;
		justify-content: flex-end;
	}

	.provider-info {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: color-mix(in oklab, var(--accent) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
		border-radius: 8px;
		font-size: var(--font-size-1);
		margin-top: var(--space-2);
	}

	.info-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.info-content {
		line-height: 1.6;
	}

	.info-content strong {
		font-weight: 600;
	}

	.docs-link {
		text-decoration: underline;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: 6px;
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		white-space: nowrap;
		background: var(--bg);
		color: var(--text);
		min-height: 44px; /* WCAG touch target */
	}

	.btn:hover {
		background: var(--surface);
		border-color: var(--primary-glow-40);
	}

	.btn:focus-visible {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-25);
	}

	.btn-scope {
		font-size: var(--font-size-0);
		padding: var(--space-1) var(--space-2);
	}

	.setting-helper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--font-size-1);
		color: var(--muted);
	}

	.helper-text {
		font-style: italic;
		font-family: var(--font-mono);
	}

	.helper-text code {
		background: color-mix(in oklab, var(--accent) 15%, transparent);
		padding: 0 var(--space-1);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	.helper-label {
		font-weight: 500;
		margin-bottom: var(--space-1);
		font-family: var(--font-mono);
	}

	.scope-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.oauth-notice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: color-mix(in oklab, var(--accent) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
		border-radius: 8px;
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
	}

	.notice-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.notice-content strong {
		font-weight: 600;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.oauth-settings {
			padding: var(--space-3);
		}

		.scope-buttons {
			justify-content: flex-start;
		}

		.btn-scope {
			flex: 0 0 auto;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.provider-info,
		.oauth-notice {
			border-width: 2px;
		}
	}
</style>