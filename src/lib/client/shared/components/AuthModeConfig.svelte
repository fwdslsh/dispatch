<script>
	import { onMount } from 'svelte';

	// Props
	let {
		apiClient,
		isVisible = false
	} = $props();

	// State
	let authConfig = $state({
		methods: {
			local: { enabled: true },
			webauthn: { enabled: false },
			oauth: {
				enabled: false,
				providers: {
					google: { enabled: false },
					github: { enabled: false }
				}
			}
		},
		security: {
			rateLimiting: { enabled: true },
			csrfProtection: { enabled: true },
			sessionTimeout: 24 * 60 * 60 * 1000
		}
	});

	let loading = $state(false);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');
	let unsavedChanges = $state(false);

	// Track original config to detect changes
	let originalConfig = null;

	// Load configuration when component becomes visible
	$effect(() => {
		if (isVisible) {
			loadAuthConfiguration();
		}
	});

	// Watch for changes to detect unsaved modifications
	$effect(() => {
		if (originalConfig) {
			unsavedChanges = JSON.stringify(authConfig) !== JSON.stringify(originalConfig);
		}
	});

	async function loadAuthConfiguration() {
		loading = true;
		error = '';

		try {
			const response = await apiClient.post('/api/admin/auth/config');

			if (response.ok) {
				const data = await response.json();
				authConfig = data.config;
				originalConfig = JSON.parse(JSON.stringify(data.config));
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to load authentication configuration';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function saveConfiguration() {
		saving = true;
		error = '';
		success = '';

		try {
			const response = await apiClient.post('/api/admin/auth/config/update', {
				updates: authConfig.methods
			});

			const data = await response.json();

			if (data.success) {
				success = 'Authentication configuration saved successfully';
				originalConfig = JSON.parse(JSON.stringify(authConfig));
				unsavedChanges = false;
			} else {
				error = data.error || 'Failed to save configuration';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			saving = false;
		}
	}

	async function resetConfiguration() {
		if (!confirm('Are you sure you want to reset all changes? This will discard all unsaved modifications.')) {
			return;
		}

		authConfig = JSON.parse(JSON.stringify(originalConfig));
		unsavedChanges = false;
		success = '';
		error = '';
	}

	async function testOAuthProvider(provider) {
		try {
			const response = await apiClient.post('/api/admin/auth/oauth/test', {
				provider
			});

			const data = await response.json();

			if (data.success) {
				success = `${provider} OAuth configuration is valid`;
			} else {
				error = data.error || `Failed to test ${provider} OAuth configuration`;
			}
		} catch (err) {
			error = `Network error testing ${provider}: ` + err.message;
		}
	}

	function closeMessages() {
		error = '';
		success = '';
	}

	function getSessionTimeoutHours() {
		return Math.round(authConfig.security.sessionTimeout / (60 * 60 * 1000));
	}

	function setSessionTimeoutHours(hours) {
		authConfig.security.sessionTimeout = hours * 60 * 60 * 1000;
	}

	function getEnabledMethodsCount() {
		let count = 0;
		if (authConfig.methods.local.enabled) count++;
		if (authConfig.methods.webauthn.enabled) count++;
		if (authConfig.methods.oauth.enabled) count++;
		return count;
	}

	function canDisableMethod(method) {
		if (method === 'local' && authConfig.methods.local.enabled) {
			return getEnabledMethodsCount() > 1;
		}
		return true;
	}
</script>

{#if isVisible}
	<div class="auth-config">
		<div class="auth-config-header">
			<h3>Authentication Configuration</h3>
			<div class="header-actions">
				{#if unsavedChanges}
					<span class="unsaved-indicator">Unsaved changes</span>
					<button class="btn btn-secondary" onclick={resetConfiguration}>
						Reset
					</button>
				{/if}
				<button
					class="btn btn-primary"
					onclick={saveConfiguration}
					disabled={saving || !unsavedChanges}
				>
					{saving ? 'Saving...' : 'Save Configuration'}
				</button>
			</div>
		</div>

		<!-- Messages -->
		{#if error}
			<div class="alert alert-error">
				{error}
				<button class="btn-close" onclick={closeMessages}>&times;</button>
			</div>
		{/if}

		{#if success}
			<div class="alert alert-success">
				{success}
				<button class="btn-close" onclick={closeMessages}>&times;</button>
			</div>
		{/if}

		<!-- Loading State -->
		{#if loading}
			<div class="loading">Loading authentication configuration...</div>
		{/if}

		{#if !loading}
			<div class="config-sections">
				<!-- Local Authentication -->
				<div class="config-section">
					<div class="section-header">
						<div class="method-info">
							<h4>
								Local Authentication
								{#if authConfig.methods.local.enabled}
									<span class="status-badge enabled">Enabled</span>
								{:else}
									<span class="status-badge disabled">Disabled</span>
								{/if}
							</h4>
							<p>Access code-based authentication using secure local credentials</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								bind:checked={authConfig.methods.local.enabled}
								disabled={!canDisableMethod('local')}
							/>
							<span class="slider"></span>
						</label>
					</div>

					{#if !canDisableMethod('local')}
						<div class="method-warning">
							<strong>Note:</strong> Local authentication cannot be disabled as it's the only enabled method.
							Enable another authentication method first.
						</div>
					{/if}
				</div>

				<!-- WebAuthn/Passkeys -->
				<div class="config-section">
					<div class="section-header">
						<div class="method-info">
							<h4>
								WebAuthn / Passkeys
								{#if authConfig.methods.webauthn.enabled}
									<span class="status-badge enabled">Enabled</span>
								{:else}
									<span class="status-badge disabled">Disabled</span>
								{/if}
							</h4>
							<p>Hardware-backed authentication using FIDO2/WebAuthn standard</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								bind:checked={authConfig.methods.webauthn.enabled}
							/>
							<span class="slider"></span>
						</label>
					</div>

					{#if authConfig.methods.webauthn.enabled}
						<div class="method-details">
							<div class="detail-item">
								<span class="icon">🔐</span>
								<div>
									<strong>Security Level:</strong> Very High
									<br>
									<small>Hardware-backed cryptographic authentication</small>
								</div>
							</div>
							<div class="detail-item">
								<span class="icon">📱</span>
								<div>
									<strong>Supported Devices:</strong> Modern browsers, mobile devices, security keys
									<br>
									<small>Requires HTTPS and compatible hardware</small>
								</div>
							</div>
						</div>
					{:else}
						<div class="method-disabled-info">
							WebAuthn provides the highest level of security through hardware-backed authentication.
							Requires HTTPS connection and compatible devices.
						</div>
					{/if}
				</div>

				<!-- OAuth Providers -->
				<div class="config-section">
					<div class="section-header">
						<div class="method-info">
							<h4>
								OAuth Providers
								{#if authConfig.methods.oauth.enabled}
									<span class="status-badge enabled">Enabled</span>
								{:else}
									<span class="status-badge disabled">Disabled</span>
								{/if}
							</h4>
							<p>Third-party authentication through trusted providers</p>
						</div>
						<label class="toggle-switch">
							<input
								type="checkbox"
								bind:checked={authConfig.methods.oauth.enabled}
							/>
							<span class="slider"></span>
						</label>
					</div>

					{#if authConfig.methods.oauth.enabled}
						<div class="oauth-providers">
							<!-- Google OAuth -->
							<div class="provider-config">
								<div class="provider-header">
									<div class="provider-info">
										<span class="provider-icon">🔵</span>
										<div>
											<strong>Google</strong>
											{#if authConfig.methods.oauth.providers.google.enabled}
												<span class="status-badge enabled small">Active</span>
											{:else}
												<span class="status-badge disabled small">Inactive</span>
											{/if}
										</div>
									</div>
									<div class="provider-actions">
										{#if authConfig.methods.oauth.providers.google.enabled}
											<button
												class="btn btn-sm"
												onclick={() => testOAuthProvider('google')}
											>
												Test
											</button>
										{/if}
										<label class="toggle-switch small">
											<input
												type="checkbox"
												bind:checked={authConfig.methods.oauth.providers.google.enabled}
											/>
											<span class="slider"></span>
										</label>
									</div>
								</div>
							</div>

							<!-- GitHub OAuth -->
							<div class="provider-config">
								<div class="provider-header">
									<div class="provider-info">
										<span class="provider-icon">⚫</span>
										<div>
											<strong>GitHub</strong>
											{#if authConfig.methods.oauth.providers.github.enabled}
												<span class="status-badge enabled small">Active</span>
											{:else}
												<span class="status-badge disabled small">Inactive</span>
											{/if}
										</div>
									</div>
									<div class="provider-actions">
										{#if authConfig.methods.oauth.providers.github.enabled}
											<button
												class="btn btn-sm"
												onclick={() => testOAuthProvider('github')}
											>
												Test
											</button>
										{/if}
										<label class="toggle-switch small">
											<input
												type="checkbox"
												bind:checked={authConfig.methods.oauth.providers.github.enabled}
											/>
											<span class="slider"></span>
										</label>
									</div>
								</div>
							</div>

							{#if !authConfig.methods.oauth.providers.google.enabled && !authConfig.methods.oauth.providers.github.enabled}
								<div class="no-providers">
									No OAuth providers are currently enabled. Enable at least one provider to use OAuth authentication.
								</div>
							{/if}
						</div>
					{:else}
						<div class="method-disabled-info">
							OAuth authentication allows users to sign in using their existing accounts with trusted providers.
							Configure provider credentials in the OAuth settings section.
						</div>
					{/if}
				</div>

				<!-- Security Settings -->
				<div class="config-section">
					<div class="section-header">
						<div class="method-info">
							<h4>Security Settings</h4>
							<p>Additional security controls and policies</p>
						</div>
					</div>

					<div class="security-settings">
						<div class="setting-group">
							<h5>Rate Limiting</h5>
							<label class="setting-item">
								<input
									type="checkbox"
									bind:checked={authConfig.security.rateLimiting.enabled}
								/>
								<div>
									<strong>Enable Rate Limiting</strong>
									<br>
									<small>Prevent brute force attacks by limiting authentication attempts</small>
								</div>
							</label>
						</div>

						<div class="setting-group">
							<h5>CSRF Protection</h5>
							<label class="setting-item">
								<input
									type="checkbox"
									bind:checked={authConfig.security.csrfProtection.enabled}
								/>
								<div>
									<strong>Enable CSRF Protection</strong>
									<br>
									<small>Protect against cross-site request forgery attacks</small>
								</div>
							</label>
						</div>

						<div class="setting-group">
							<h5>Session Timeout</h5>
							<div class="session-timeout">
								<label for="sessionTimeout">Session timeout (hours):</label>
								<input
									type="number"
									id="sessionTimeout"
									min="1"
									max="168"
									value={getSessionTimeoutHours()}
									onchange={(e) => setSessionTimeoutHours(parseInt(e.target.value))}
								/>
								<small>Sessions will automatically expire after this period of inactivity</small>
							</div>
						</div>
					</div>
				</div>

				<!-- Configuration Summary -->
				<div class="config-section">
					<div class="section-header">
						<div class="method-info">
							<h4>Configuration Summary</h4>
							<p>Overview of current authentication setup</p>
						</div>
					</div>

					<div class="config-summary">
						<div class="summary-item">
							<strong>Enabled Methods:</strong>
							<div class="enabled-methods">
								{#if authConfig.methods.local.enabled}
									<span class="method-chip">Local Authentication</span>
								{/if}
								{#if authConfig.methods.webauthn.enabled}
									<span class="method-chip">WebAuthn</span>
								{/if}
								{#if authConfig.methods.oauth.enabled}
									<span class="method-chip">OAuth</span>
								{/if}
							</div>
						</div>

						{#if authConfig.methods.oauth.enabled}
							<div class="summary-item">
								<strong>OAuth Providers:</strong>
								<div class="enabled-providers">
									{#if authConfig.methods.oauth.providers.google.enabled}
										<span class="provider-chip">Google</span>
									{/if}
									{#if authConfig.methods.oauth.providers.github.enabled}
										<span class="provider-chip">GitHub</span>
									{/if}
									{#if !authConfig.methods.oauth.providers.google.enabled && !authConfig.methods.oauth.providers.github.enabled}
										<span class="no-providers-text">None configured</span>
									{/if}
								</div>
							</div>
						{/if}

						<div class="summary-item">
							<strong>Security Level:</strong>
							{#if authConfig.methods.webauthn.enabled}
								<span class="security-level high">Very High</span>
							{:else if authConfig.methods.oauth.enabled}
								<span class="security-level medium">High</span>
							{:else}
								<span class="security-level basic">Standard</span>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.auth-config {
		padding: 20px;
		background: #f5f5f5;
		border-radius: 8px;
		margin: 10px 0;
	}

	.auth-config-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.auth-config-header h3 {
		margin: 0;
		color: #333;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.unsaved-indicator {
		color: #ffc107;
		font-weight: 500;
		font-size: 14px;
	}

	.alert {
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 16px;
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.alert-error {
		background: #fee;
		border: 1px solid #fcc;
		color: #c33;
	}

	.alert-success {
		background: #efe;
		border: 1px solid #cfc;
		color: #383;
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: inherit;
		opacity: 0.7;
	}

	.btn-close:hover {
		opacity: 1;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.config-sections {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.config-section {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.method-info h4 {
		margin: 0 0 4px 0;
		color: #333;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.method-info p {
		margin: 0;
		color: #666;
		font-size: 14px;
	}

	.status-badge {
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		text-transform: uppercase;
		font-weight: 500;
	}

	.status-badge.enabled {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.disabled {
		background: #f8d7da;
		color: #721c24;
	}

	.status-badge.small {
		font-size: 9px;
		padding: 1px 4px;
	}

	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 50px;
		height: 24px;
	}

	.toggle-switch.small {
		width: 40px;
		height: 20px;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		transition: 0.3s;
		border-radius: 12px;
	}

	.slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.3s;
		border-radius: 50%;
	}

	.toggle-switch.small .slider:before {
		height: 14px;
		width: 14px;
	}

	input:checked + .slider {
		background-color: #007bff;
	}

	input:checked + .slider:before {
		transform: translateX(26px);
	}

	.toggle-switch.small input:checked + .slider:before {
		transform: translateX(20px);
	}

	input:disabled + .slider {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.method-warning {
		background: #fff3cd;
		border: 1px solid #ffeaa7;
		color: #856404;
		padding: 10px;
		border-radius: 4px;
		font-size: 13px;
	}

	.method-details {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 16px;
	}

	.detail-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px;
		background: #f8f9fa;
		border-radius: 6px;
	}

	.detail-item .icon {
		font-size: 18px;
		margin-top: 2px;
	}

	.detail-item strong {
		color: #333;
	}

	.detail-item small {
		color: #666;
	}

	.method-disabled-info {
		margin-top: 16px;
		padding: 12px;
		background: #f8f9fa;
		border-radius: 6px;
		color: #666;
		font-size: 14px;
	}

	.oauth-providers {
		margin-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.provider-config {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 12px;
		background: #fafafa;
	}

	.provider-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.provider-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.provider-icon {
		font-size: 20px;
	}

	.provider-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.no-providers {
		text-align: center;
		padding: 20px;
		color: #666;
		font-style: italic;
	}

	.security-settings {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.setting-group h5 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.setting-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		cursor: pointer;
		padding: 8px 0;
	}

	.setting-item input[type="checkbox"] {
		margin-top: 2px;
	}

	.session-timeout {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.session-timeout label {
		font-weight: 500;
		color: #555;
	}

	.session-timeout input {
		width: 80px;
		padding: 6px;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.session-timeout small {
		color: #666;
	}

	.config-summary {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.summary-item strong {
		color: #333;
	}

	.enabled-methods,
	.enabled-providers {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.method-chip,
	.provider-chip {
		background: #e3f2fd;
		color: #1976d2;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.provider-chip {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.no-providers-text {
		color: #999;
		font-style: italic;
		font-size: 12px;
	}

	.security-level {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
	}

	.security-level.high {
		background: #d4edda;
		color: #155724;
	}

	.security-level.medium {
		background: #fff3cd;
		color: #856404;
	}

	.security-level.basic {
		background: #f8d7da;
		color: #721c24;
	}

	.btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
	}

	.btn:hover {
		background: #f5f5f5;
	}

	.btn-primary {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.btn-primary:hover {
		background: #0056b3;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
		border-color: #6c757d;
	}

	.btn-secondary:hover {
		background: #545b62;
	}

	.btn-sm {
		padding: 4px 8px;
		font-size: 12px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>