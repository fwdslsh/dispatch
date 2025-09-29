<!--
	OAuthSettings Section
	Handles OAuth configuration including client ID, redirect URI, and scope settings
-->

<script>
	import { SettingsViewModel } from '../SettingsViewModel.svelte.js';

	/**
	 * @type {SettingsViewModel}
	 */
	let { settingsViewModel } = $props();

	// Get OAuth settings
	let oauthClientIdSetting = $derived.by(() => {
		return settingsViewModel.oauthClientIdSetting;
	});

	let oauthClientSecretSetting = $derived.by(() => {
		return settingsViewModel.oauthClientSecretSetting;
	});

	let oauthRedirectUriSetting = $derived.by(() => {
		return settingsViewModel.oauthRedirectUriSetting;
	});

	let oauthScopeSetting = $derived.by(() => {
		return settingsViewModel.oauthScopeSetting;
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

	// Generate example redirect URI based on current domain
	function generateExampleRedirectUri() {
		const protocol = window.location.protocol;
		const host = window.location.host;
		return `${protocol}//${host}/auth/callback`;
	}

	// Set default redirect URI
	function useDefaultRedirectUri() {
		const defaultUri = generateExampleRedirectUri();
		settingsViewModel.updateSetting('oauth_redirect_uri', defaultUri);
	}

	// OAuth provider selection
	let selectedProvider = $state('custom');

	// Provider-specific configurations
	const oauthProviders = {
		google: {
			name: 'Google',
			authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
			tokenUrl: 'https://oauth2.googleapis.com/token',
			defaultScopes: 'openid profile email',
			scopeOptions: [
				{ value: 'openid profile email', label: 'Basic profile and email' },
				{ value: 'openid profile email https://www.googleapis.com/auth/drive.readonly', label: 'Profile + Drive read' },
				{ value: 'openid profile email https://www.googleapis.com/auth/calendar.readonly', label: 'Profile + Calendar read' }
			],
			setupInstructions: 'Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID',
			docsUrl: 'https://developers.google.com/identity/protocols/oauth2'
		},
		github: {
			name: 'GitHub',
			authUrl: 'https://github.com/login/oauth/authorize',
			tokenUrl: 'https://github.com/login/oauth/access_token',
			defaultScopes: 'read:user user:email',
			scopeOptions: [
				{ value: 'read:user user:email', label: 'Read user profile and email' },
				{ value: 'repo read:user user:email', label: 'Repository access + profile' },
				{ value: 'repo read:user user:email workflow', label: 'Full repository and workflow access' }
			],
			setupInstructions: 'Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App',
			docsUrl: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps'
		},
		custom: {
			name: 'Custom Provider',
			defaultScopes: 'read write',
			scopeOptions: [
				{ value: 'read', label: 'Read access' },
				{ value: 'write', label: 'Write access' },
				{ value: 'admin', label: 'Admin access' },
				{ value: 'openid profile email', label: 'OpenID Connect' }
			]
		}
	};

	// Get current provider configuration
	let providerConfig = $derived.by(() => {
		return oauthProviders[selectedProvider];
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
			<div class="setting-item">
				<label for="oauth-client-id" class="setting-label">
					OAuth Client ID
					{#if oauthClientIdSetting.is_required}
						<span class="required-indicator" aria-label="Required">*</span>
					{/if}
				</label>

				<div class="setting-description" data-testid="oauth-client-id-help">
					The client ID provided by your OAuth provider. This is used to identify your application
					during the OAuth flow.
				</div>

				<input
					id="oauth-client-id"
					type="text"
					class="setting-input"
					class:input-error={clientIdErrors.length > 0}
					placeholder="Enter OAuth client ID"
					value={clientIdValue}
					oninput={(e) => handleInput('oauth_client_id', e)}
					autocomplete="off"
					spellcheck="false"
					data-testid="oauth-client-id-input"
					aria-describedby={clientIdErrors.length > 0 ? 'oauth-client-id-error' : 'oauth-client-id-help'}
				/>

				<!-- Validation Errors -->
				{#if clientIdErrors.length > 0}
					<div class="error-message" id="oauth-client-id-error" data-testid="oauth-client-id-error">
						{#each clientIdErrors as error}
							<div class="error-item">{error}</div>
						{/each}
					</div>
				{/if}

				<!-- Environment Variable Fallback Info -->
				{#if oauthClientIdSetting.env_var_name && !settingsViewModel.hasChanges('oauth_client_id')}
					<div class="env-fallback" data-testid="oauth-client-id-env-fallback">
						<div class="env-icon">🔧</div>
						<div class="env-content">
							<strong>Environment Variable:</strong>
							Currently using value from <code>{oauthClientIdSetting.env_var_name}</code> environment variable.
							Set a value here to override the environment setting.
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- OAuth Client Secret -->
		{#if oauthClientSecretSetting}
			<div class="setting-item">
				<label for="oauth-client-secret" class="setting-label">
					OAuth Client Secret
					{#if oauthClientSecretSetting.is_required}
						<span class="required-indicator" aria-label="Required">*</span>
					{/if}
				</label>

				<div class="setting-description" data-testid="oauth-client-secret-help">
					The client secret provided by your OAuth provider. This value is sensitive and will be
					stored securely. Never share this secret publicly.
				</div>

				<input
					id="oauth-client-secret"
					type="password"
					class="setting-input"
					class:input-error={clientSecretErrors.length > 0}
					placeholder="Enter OAuth client secret"
					value={clientSecretValue}
					oninput={(e) => handleInput('oauth_client_secret', e)}
					autocomplete="new-password"
					spellcheck="false"
					data-testid="oauth-client-secret-input"
					aria-describedby={clientSecretErrors.length > 0
						? 'oauth-client-secret-error'
						: 'oauth-client-secret-help'}
				/>

				<!-- Validation Errors -->
				{#if clientSecretErrors.length > 0}
					<div
						class="error-message"
						id="oauth-client-secret-error"
						data-testid="oauth-client-secret-error"
					>
						{#each clientSecretErrors as error}
							<div class="error-item">{error}</div>
						{/each}
					</div>
				{/if}

				<!-- Environment Variable Fallback Info -->
				{#if oauthClientSecretSetting.env_var_name && !settingsViewModel.hasChanges('oauth_client_secret')}
					<div class="env-fallback" data-testid="oauth-client-secret-env-fallback">
						<div class="env-icon">🔧</div>
						<div class="env-content">
							<strong>Environment Variable:</strong>
							Currently using value from <code>{oauthClientSecretSetting.env_var_name}</code> environment
							variable. Set a value here to override the environment setting.
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- OAuth Redirect URI -->
		{#if oauthRedirectUriSetting}
			<div class="setting-item">
				<label for="oauth-redirect-uri" class="setting-label">
					OAuth Redirect URI
					{#if oauthRedirectUriSetting.is_required}
						<span class="required-indicator" aria-label="Required">*</span>
					{/if}
				</label>

				<div class="setting-description" data-testid="oauth-redirect-uri-help">
					The URI where users will be redirected after OAuth authentication. This must match the
					redirect URI configured in your OAuth provider.
				</div>

				<div class="input-group">
					<input
						id="oauth-redirect-uri"
						type="url"
						class="setting-input"
						class:input-error={redirectUriErrors.length > 0}
						placeholder="https://your-domain.com/auth/callback"
						value={redirectUriValue}
						oninput={(e) => handleInput('oauth_redirect_uri', e)}
						autocomplete="off"
						spellcheck="false"
						data-testid="oauth-redirect-uri-input"
						aria-describedby={redirectUriErrors.length > 0 ? 'oauth-redirect-uri-error' : 'oauth-redirect-uri-help'}
					/>

					<button
						type="button"
						class="button"
						onclick={useDefaultRedirectUri}
						title="Use default redirect URI for this domain"
						aria-label="Use default redirect URI for this domain"
					>
						Use Default
					</button>
				</div>

				<div class="setting-helper">
					<span class="helper-text">
						Example: <code>{generateExampleRedirectUri()}</code>
					</span>
				</div>

				<!-- Validation Errors -->
				{#if redirectUriErrors.length > 0}
					<div class="error-message" id="oauth-redirect-uri-error" data-testid="oauth-redirect-uri-error">
						{#each redirectUriErrors as error}
							<div class="error-item">{error}</div>
						{/each}
					</div>
				{/if}

				<!-- Environment Variable Fallback Info -->
				{#if oauthRedirectUriSetting.env_var_name && !settingsViewModel.hasChanges('oauth_redirect_uri')}
					<div class="env-fallback" data-testid="oauth-redirect-uri-env-fallback">
						<div class="env-icon">🔧</div>
						<div class="env-content">
							<strong>Environment Variable:</strong>
							Currently using value from <code>{oauthRedirectUriSetting.env_var_name}</code> environment variable.
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- OAuth Scope -->
		{#if oauthScopeSetting}
			<div class="setting-item">
				<label for="oauth-scope" class="setting-label">
					OAuth Scope
					{#if oauthScopeSetting.is_required}
						<span class="required-indicator" aria-label="Required">*</span>
					{/if}
				</label>

				<div class="setting-description" data-testid="oauth-scope-help">
					The permissions your application requests from the OAuth provider. Multiple scopes should
					be separated by spaces.
				</div>

				<input
					id="oauth-scope"
					type="text"
					class="setting-input"
					class:input-error={scopeErrors.length > 0}
					placeholder="read write"
					value={scopeValue}
					oninput={(e) => handleInput('oauth_scope', e)}
					autocomplete="off"
					spellcheck="false"
					data-testid="oauth-scope-input"
					aria-describedby={scopeErrors.length > 0 ? 'oauth-scope-error' : 'oauth-scope-help'}
				/>

				<!-- Provider-specific Scopes Helper -->
				<div class="setting-helper">
					<span class="helper-label">{providerConfig.name} scopes:</span>
					<div class="scope-buttons">
						{#each providerConfig.scopeOptions as scope}
							<button
								type="button"
								class="btn btn-scope"
								onclick={() => setCommonScope(scope.value)}
								title="Set scope to: {scope.value}"
								data-testid="scope-button-{scope.label}"
							>
								{scope.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Validation Errors -->
				{#if scopeErrors.length > 0}
					<div class="error-message" id="oauth-scope-error" data-testid="oauth-scope-error">
						{#each scopeErrors as error}
							<div class="error-item">{error}</div>
						{/each}
					</div>
				{/if}

				<!-- Environment Variable Fallback Info -->
				{#if oauthScopeSetting.env_var_name && !settingsViewModel.hasChanges('oauth_scope')}
					<div class="env-fallback" data-testid="oauth-scope-env-fallback">
						<div class="env-icon">🔧</div>
						<div class="env-content">
							<strong>Environment Variable:</strong>
							Currently using value from <code>{oauthScopeSetting.env_var_name}</code> environment variable.
						</div>
					</div>
				{/if}
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
	.oauth-settings {
		padding: 1.5rem;
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-label {
		font-weight: 600;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.required-indicator {
		color: var(--error-color, #dc3545);
		font-weight: bold;
	}

	.setting-description {
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.input-group {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.setting-input {
		flex: 1;
		padding: 0.75rem;
		border-radius: 6px;
		font-size: 0.875rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		min-height: 44px; /* Touch target */
	}

	.setting-input:focus {
		outline: none;
	}

	.setting-input.input-error {
		border-color: var(--error-color, #dc3545);
	}

	.setting-input.input-error:focus {
		border-color: var(--error-color, #dc3545);
		box-shadow: 0 0 0 3px var(--error-shadow, rgba(220, 53, 69, 0.25));
	}



	.provider-info {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;

		font-size: 0.8125rem;
		margin-top: 0.5rem;
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
		color: var(--info-text, #0c5460);
	}

	.docs-link {
		text-decoration: underline;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}



	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		white-space: nowrap;
	}

	.btn-link {
		background: transparent;
		border: none;
		padding: 0.5rem;
		text-decoration: underline;
	}

	.btn-scope {
		background: var(--bg-secondary);
		color: var(--text-secondary);
		border-color: var(--border-color);
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}

	.btn-scope:hover {
		background: var(--hover-bg);
		color: var(--text-primary);
	}

	.setting-helper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.helper-text {
		font-style: italic;
	}

	.helper-text code {
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.helper-label {
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.scope-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.error-message {
		padding: 0.75rem;
		font-size: 0.8125rem;
	}

	.error-item {
		margin-bottom: 0.25rem;
	}

	.error-item:last-child {
		margin-bottom: 0;
	}

	.env-fallback {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
	}

	.env-icon {
		flex-shrink: 0;
	}

	.env-content code {
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.oauth-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 4px;
		font-size: 0.8125rem;
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
			padding: 1rem;
		}

		.input-group {
			flex-direction: column;
			align-items: stretch;
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
		.setting-input {
			border-width: 2px;
		}

		.error-message,
		.env-fallback,
		.oauth-notice {
			border-width: 2px;
		}
	}
</style>