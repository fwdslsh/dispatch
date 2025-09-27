<script>
	import { onMount } from 'svelte';
	import Button from '../Button.svelte';
	import Input from '../Input.svelte';
	import ErrorDisplay from '../ErrorDisplay.svelte';

	let loading = $state(false);
	let error = $state('');
	let success = $state('');

	let oauthConfig = $state({
		github: { enabled: false, clientId: '', clientSecret: '' },
		google: { enabled: false, clientId: '', clientSecret: '' }
	});

	let originalConfig = $state({});
	let hasChanges = $derived(JSON.stringify(oauthConfig) !== JSON.stringify(originalConfig));

	onMount(() => {
		loadOAuthConfig();
	});

	function getAuthHeaders() {
		const token = typeof sessionStorage !== 'undefined'
			? sessionStorage.getItem('dispatch-auth-token')
			: null;
		return token ? { Authorization: `Bearer ${token}` } : {};
	}

	async function loadOAuthConfig() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/admin/oauth', {
				headers: getAuthHeaders()
			});

			if (response.ok) {
				const data = await response.json();
				oauthConfig = data.oauthConfig || {
					github: { enabled: false, clientId: '', clientSecret: '' },
					google: { enabled: false, clientId: '', clientSecret: '' }
				};
				originalConfig = JSON.parse(JSON.stringify(oauthConfig));
			} else {
				const data = await response.json();
				error = data.error || 'Failed to load OAuth configuration';
			}
		} catch (err) {
			error = 'Failed to load OAuth configuration';
		} finally {
			loading = false;
		}
	}

	async function saveOAuthConfig() {
		loading = true;
		error = '';
		success = '';

		try {
			const response = await fetch('/api/admin/oauth', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify(oauthConfig)
			});

			if (response.ok) {
				originalConfig = JSON.parse(JSON.stringify(oauthConfig));
				success = 'OAuth configuration saved successfully';
				// Clear success message after 3 seconds
				setTimeout(() => success = '', 3000);
			} else {
				const data = await response.json();
				error = data.error || 'Failed to save OAuth configuration';
			}
		} catch (err) {
			error = 'Failed to save OAuth configuration';
		} finally {
			loading = false;
		}
	}

	function resetChanges() {
		oauthConfig = JSON.parse(JSON.stringify(originalConfig));
		error = '';
		success = '';
	}

	async function generateSSHKeyPair() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/auth/generate-ssh-key', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify({
					name: 'Admin Generated Key',
					type: 'ed25519'
				})
			});

			if (response.ok) {
				const data = await response.json();

				// Download private key
				const privateBlob = new Blob([data.privateKey], { type: 'text/plain' });
				const privateUrl = URL.createObjectURL(privateBlob);
				const privateLink = document.createElement('a');
				privateLink.href = privateUrl;
				privateLink.download = 'id_ed25519';
				document.body.appendChild(privateLink);
				privateLink.click();
				document.body.removeChild(privateLink);
				URL.revokeObjectURL(privateUrl);

				// Download public key
				const publicBlob = new Blob([data.publicKey], { type: 'text/plain' });
				const publicUrl = URL.createObjectURL(publicBlob);
				const publicLink = document.createElement('a');
				publicLink.href = publicUrl;
				publicLink.download = 'id_ed25519.pub';
				document.body.appendChild(publicLink);
				publicLink.click();
				document.body.removeChild(publicLink);
				URL.revokeObjectURL(publicUrl);

				success = 'SSH key pair generated and downloaded successfully';
				setTimeout(() => success = '', 5000);
			} else {
				const data = await response.json();
				error = data.error || 'Failed to generate SSH key pair';
			}
		} catch (err) {
			error = 'Failed to generate SSH key pair';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-settings">
	<div class="section-header">
		<h3>Authentication Settings</h3>
	</div>

	{#if error}
		<ErrorDisplay {error} />
	{/if}

	{#if success}
		<div class="success-message">
			{success}
		</div>
	{/if}

	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else}
		<div class="settings-sections">
			<!-- OAuth Configuration -->
			<div class="card aug oauth-section" data-augmented-ui="tl-clip br-clip both">
				<h4>OAuth Providers</h4>
				<p class="section-description">
					Configure OAuth authentication with GitHub and Google for user login.
				</p>

				<!-- GitHub OAuth -->
				<div class="oauth-provider">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={oauthConfig.github.enabled} />
						<span class="provider-name">GitHub OAuth</span>
					</label>

					{#if oauthConfig.github.enabled}
						<div class="oauth-config">
							<div class="form-group">
								<label>GitHub Client ID</label>
								<Input
									bind:value={oauthConfig.github.clientId}
									placeholder="Your GitHub OAuth App Client ID"
								/>
								<small class="field-help">
									Create a GitHub OAuth App in your GitHub settings and copy the Client ID here.
								</small>
							</div>
							<div class="form-group">
								<label>GitHub Client Secret</label>
								<Input
									bind:value={oauthConfig.github.clientSecret}
									type="password"
									placeholder="Your GitHub OAuth App Client Secret"
								/>
								<small class="field-help">
									Copy the Client Secret from your GitHub OAuth App. This will be encrypted when stored.
								</small>
							</div>
						</div>
					{/if}
				</div>

				<!-- Google OAuth -->
				<div class="oauth-provider">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={oauthConfig.google.enabled} />
						<span class="provider-name">Google OAuth</span>
					</label>

					{#if oauthConfig.google.enabled}
						<div class="oauth-config">
							<div class="form-group">
								<label>Google Client ID</label>
								<Input
									bind:value={oauthConfig.google.clientId}
									placeholder="Your Google OAuth Client ID"
								/>
								<small class="field-help">
									Create a Google OAuth application in Google Cloud Console and copy the Client ID.
								</small>
							</div>
							<div class="form-group">
								<label>Google Client Secret</label>
								<Input
									bind:value={oauthConfig.google.clientSecret}
									type="password"
									placeholder="Your Google OAuth Client Secret"
								/>
								<small class="field-help">
									Copy the Client Secret from your Google OAuth application. This will be encrypted when stored.
								</small>
							</div>
						</div>
					{/if}
				</div>

				<div class="oauth-actions">
					{#if hasChanges}
						<Button onclick={resetChanges} variant="ghost" size="small">
							Reset Changes
						</Button>
					{/if}
					<Button onclick={saveOAuthConfig} disabled={!hasChanges || loading} {loading}>
						Save OAuth Settings
					</Button>
				</div>
			</div>

			<!-- SSH Key Management -->
			<div class="card aug ssh-section" data-augmented-ui="tl-clip br-clip both">
				<h4>SSH Key Management</h4>
				<p class="section-description">
					Generate SSH key pairs for secure authentication. Keys are used for both web interface and direct SSH access.
				</p>

				<div class="ssh-actions">
					<Button onclick={generateSSHKeyPair} disabled={loading} {loading}>
						Generate New SSH Key Pair
					</Button>
				</div>

				<div class="ssh-help">
					<h5>SSH Key Usage:</h5>
					<ul>
						<li>Generated keys work for both web authentication and direct SSH access</li>
						<li>Private keys are downloaded automatically and should be kept secure</li>
						<li>Public keys are automatically added to the system's authorized_keys</li>
						<li>Keys use modern Ed25519 encryption for maximum security</li>
					</ul>
				</div>
			</div>

			<!-- Authentication Info -->
			<div class="card aug info-section" data-augmented-ui="tl-clip br-clip both">
				<h4>Authentication Overview</h4>
				<p class="section-description">
					Dispatch uses a dual-token authentication system for maximum security and functionality.
				</p>

				<div class="auth-info">
					<div class="info-item">
						<h5>HTTP-Only Cookies</h5>
						<p>Secure API requests against XSS attacks. Automatically included in HTTP requests.</p>
					</div>

					<div class="info-item">
						<h5>SessionStorage Tokens</h5>
						<p>Enable WebSocket authentication for real-time features. Cleared when browser tab closes.</p>
					</div>

					<div class="info-item">
						<h5>SSH Key Authentication</h5>
						<p>File-based authentication with system integration. Same keys work for web and SSH access.</p>
					</div>

					<div class="info-item">
						<h5>OAuth Integration</h5>
						<p>Social login with GitHub and Google. Automatic user profile retrieval and account creation.</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.auth-settings {
		margin-bottom: var(--space-6);
	}

	.section-header {
		margin-bottom: var(--space-5);
	}

	.section-header h3 {
		margin: 0;
		color: var(--text);
	}

	.loading-state {
		text-align: center;
		padding: var(--space-6);
		color: var(--muted);
	}

	.success-message {
		background: var(--ok);
		color: var(--bg);
		padding: var(--space-3) var(--space-4);
		border-radius: 6px;
		margin-bottom: var(--space-4);
		font-weight: 600;
	}

	.settings-sections {
		display: grid;
		gap: var(--space-5);
	}

	.oauth-section,
	.ssh-section,
	.info-section {
		padding: var(--space-5);
	}

	.oauth-section h4,
	.ssh-section h4,
	.info-section h4 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
	}

	.section-description {
		margin: 0 0 var(--space-4) 0;
		color: var(--muted);
	}

	.oauth-provider {
		margin-bottom: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--surface);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
		cursor: pointer;
		font-weight: 600;
		color: var(--text);
	}

	.provider-name {
		font-size: var(--font-size-1);
	}

	.oauth-config {
		margin-left: var(--space-6);
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}

	.form-group {
		margin-bottom: var(--space-4);
	}

	.form-group label {
		display: block;
		margin-bottom: var(--space-2);
		font-weight: 600;
		color: var(--text);
	}

	.field-help {
		display: block;
		margin-top: var(--space-1);
		font-size: var(--font-size--1);
		color: var(--muted);
		line-height: 1.4;
	}

	.oauth-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	.ssh-actions {
		margin-bottom: var(--space-4);
	}

	.ssh-help {
		padding: var(--space-4);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 6px;
		margin-top: var(--space-4);
	}

	.ssh-help h5 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
	}

	.ssh-help ul {
		margin: 0;
		padding-left: var(--space-4);
		color: var(--muted);
	}

	.ssh-help li {
		margin-bottom: var(--space-1);
		line-height: 1.4;
	}

	.auth-info {
		display: grid;
		gap: var(--space-4);
	}

	.info-item {
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--surface);
	}

	.info-item h5 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
		font-size: var(--font-size-0);
	}

	.info-item p {
		margin: 0;
		color: var(--muted);
		font-size: var(--font-size--1);
		line-height: 1.4;
	}

	@media (max-width: 768px) {
		.oauth-config {
			margin-left: 0;
			margin-top: var(--space-3);
		}

		.oauth-actions {
			flex-direction: column;
		}
	}
</style>