<!--
	OAuthSettings Section
	Handles OAuth configuration including client ID, redirect URI, and scope settings
-->

<script>
	import { SettingsViewModel } from '../SettingsViewModel.svelte.js';
	import { OAuthProviders, generateExampleRedirectUri } from '../OAuthProviderModel.js';
	import SettingField from '$lib/client/shared/components/SettingField.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';

	let {
		/**
		 * @type {SettingsViewModel}
		 */
		settingsViewModel
	} = $props();

	// Get authentication category (reactive via $state proxy)
	let authCategory = $derived(settingsViewModel.categories.authentication || {});

	// Setting metadata for SettingField components
	const oauthClientIdSetting = {
		key: 'oauth_client_id',
		display_name: 'OAuth Client ID',
		description: 'Client ID from your OAuth provider',
		type: 'text',
		is_required: false
	};

	const oauthClientSecretSetting = {
		key: 'oauth_client_secret',
		display_name: 'OAuth Client Secret',
		description: 'Client secret from your OAuth provider',
		type: 'password',
		is_required: false
	};

	const oauthRedirectUriSetting = {
		key: 'oauth_redirect_uri',
		display_name: 'OAuth Redirect URI',
		description: 'Redirect URI registered with your OAuth provider',
		type: 'url',
		is_required: false
	};

	const oauthScopeSetting = {
		key: 'oauth_scope',
		display_name: 'OAuth Scope',
		description: 'Space-separated list of OAuth scopes',
		type: 'text',
		is_required: false
	};

	// Current values with pending changes
	let clientIdValue = $derived(authCategory.oauth_client_id || '');
	let clientSecretValue = $derived(authCategory.oauth_client_secret || '');
	let redirectUriValue = $derived(authCategory.oauth_redirect_uri || '');
	let scopeValue = $derived(authCategory.oauth_scope || '');

	// Validation errors
	let clientIdErrors = $derived(
		settingsViewModel.getFieldErrors('authentication', 'oauth_client_id')
	);
	let clientSecretErrors = $derived(
		settingsViewModel.getFieldErrors('authentication', 'oauth_client_secret')
	);
	let redirectUriErrors = $derived(
		settingsViewModel.getFieldErrors('authentication', 'oauth_redirect_uri')
	);
	let scopeErrors = $derived(settingsViewModel.getFieldErrors('authentication', 'oauth_scope'));

	// Check if any OAuth settings have errors
	let hasErrors = $derived(
		clientIdErrors.length > 0 ||
			clientSecretErrors.length > 0 ||
			redirectUriErrors.length > 0 ||
			scopeErrors.length > 0
	);

	// Check if category has changes
	let hasChanges = $derived(settingsViewModel.categoryHasChanges('authentication'));

	// Handle input changes
	function handleInput(settingKey, event) {
		const value = event.target.value;
		authCategory[settingKey] = value;
		settingsViewModel.validateField('authentication', settingKey, value);
	}

	// Set default redirect URI using Model utility
	function useDefaultRedirectUri() {
		const defaultUri = generateExampleRedirectUri();
		authCategory.oauth_redirect_uri = defaultUri;
		settingsViewModel.validateField('authentication', 'oauth_redirect_uri', defaultUri);
	}

	// OAuth provider selection
	let selectedProvider = $state('custom');

	// Get current provider configuration from Model
	let providerConfig = $derived(OAuthProviders[selectedProvider]);

	// Set common scope
	function setCommonScope(scope) {
		authCategory.oauth_scope = scope;
		settingsViewModel.validateField('authentication', 'oauth_scope', scope);
	}

	// Use provider default scope
	function useProviderDefaultScope() {
		if (providerConfig.defaultScopes) {
			authCategory.oauth_scope = providerConfig.defaultScopes;
			settingsViewModel.validateField(
				'authentication',
				'oauth_scope',
				providerConfig.defaultScopes
			);
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
			<label for="oauth-provider" class="setting-label"> OAuth Provider </label>

			<div class="setting-description">
				Select your OAuth provider for pre-configured settings and helpful guidance. Choose "Custom
				Provider" for other OAuth providers.
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
							<a
								href={providerConfig.docsUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="docs-link"
							>
								View documentation ↗
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- OAuth Client ID -->
		<SettingField
			setting={oauthClientIdSetting}
			value={clientIdValue}
			errors={clientIdErrors}
			{hasChanges}
			onInput={(e) => handleInput('oauth_client_id', e)}
			placeholder="Enter OAuth client ID"
			testId="oauth-client-id-input"
		/>

		<!-- OAuth Client Secret -->
		<SettingField
			setting={oauthClientSecretSetting}
			value={clientSecretValue}
			errors={clientSecretErrors}
			{hasChanges}
			onInput={(e) => handleInput('oauth_client_secret', e)}
			type="password"
			placeholder="Enter OAuth client secret"
			autocomplete="new-password"
			testId="oauth-client-secret-input"
		/>

		<!-- OAuth Redirect URI -->
		<div class="redirect-uri-field">
			<SettingField
				setting={oauthRedirectUriSetting}
				value={redirectUriValue}
				errors={redirectUriErrors}
				{hasChanges}
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

		<!-- OAuth Scope -->
		<div class="scope-field">
			<SettingField
				setting={oauthScopeSetting}
				value={scopeValue}
				errors={scopeErrors}
				{hasChanges}
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

		<!-- OAuth Configuration Notice -->
		<div class="oauth-notice">
			<div class="notice-icon">ℹ️</div>
			<div class="notice-content">
				<strong>OAuth Configuration:</strong>
				These settings configure OAuth authentication for your application. Make sure the client ID and
				redirect URI match your OAuth provider configuration exactly.
			</div>
		</div>
	</div>
</div>

<style>

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
		background: var(--info-box-bg);
		border: 1px solid var(--info-box-border);
		border-radius: var(--radius-md);
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
		background: var(--primary-glow-15);
		padding: 0 var(--space-1);
		border-radius: var(--radius-xs);
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
		background: var(--info-box-bg);
		border: 1px solid var(--info-box-border);
		border-radius: var(--radius-md);
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
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.provider-info,
		.oauth-notice {
			border-width: 2px;
		}
	}
</style>
