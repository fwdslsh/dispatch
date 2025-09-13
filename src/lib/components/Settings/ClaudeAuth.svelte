<script>
	import { onMount } from 'svelte';
	import { Button, Input, LoadingSpinner, ErrorDisplay } from '$lib/shared/components';
	import { IconCloudCheck, IconCloudX, IconKey, IconExternalLink } from '@tabler/icons-svelte';

	/**
	 * Claude Authentication Component
	 * Manages Claude (Anthropic) API authentication using OAuth flow
	 */

	// Authentication state
	let isAuthenticated = $state(false);
	let authStatus = $state('checking'); // 'checking' | 'authenticated' | 'not_authenticated' | 'error'
	let authError = $state('');
	let loading = $state(false);

	// OAuth flow state
	let oauthUrl = $state('');
	let authCode = $state('');
	let showCodeInput = $state(false);
	let sessionId = $state('');

	// Manual API key state
	let showManualAuth = $state(false);
	let apiKey = $state('');

	// Status messages
	let statusMessage = $state('');

	onMount(async () => {
		await checkAuthStatus();
	});

	// Check current authentication status
	async function checkAuthStatus() {
		authStatus = 'checking';
		try {
			const response = await fetch('/api/claude/auth');
			const data = await response.json();

			if (response.ok) {
				isAuthenticated = data.authenticated;
				authStatus = data.authenticated ? 'authenticated' : 'not_authenticated';
				if (data.hint && !data.authenticated) {
					statusMessage = data.hint;
				}
			} else {
				authStatus = 'error';
				authError = data.error || 'Failed to check authentication status';
			}
		} catch (error) {
			console.error('Auth check failed:', error);
			authStatus = 'error';
			authError = 'Unable to connect to authentication service';
		}
	}

	// Start OAuth authentication flow
	async function startOAuthFlow() {
		if (loading) return;

		loading = true;
		authError = '';
		statusMessage = '';

		try {
			const response = await fetch('/api/claude/setup-token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const data = await response.json();

			if (response.ok && data.success) {
				oauthUrl = data.authUrl;
				sessionId = data.sessionId;
				showCodeInput = true;
				statusMessage =
					'Authorization URL generated. Please complete authentication in the new tab.';

				// Open OAuth URL in new tab
				window.open(oauthUrl, '_blank', 'width=600,height=700');
			} else {
				authError = data.error || 'Failed to initiate OAuth flow';
			}
		} catch (error) {
			console.error('OAuth setup failed:', error);
			authError = 'Failed to start authentication process';
		} finally {
			loading = false;
		}
	}

	// Complete OAuth authentication with authorization code
	async function completeAuth() {
		if (!authCode.trim() || loading) return;

		loading = true;
		authError = '';
		statusMessage = '';

		try {
			const response = await fetch('/api/claude/complete-auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					authCode: authCode.trim()
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				statusMessage = 'Authentication completed successfully!';
				showCodeInput = false;
				authCode = '';
				oauthUrl = '';
				sessionId = '';
				await checkAuthStatus();
			} else {
				authError = data.error || 'Invalid authorization code';
			}
		} catch (error) {
			console.error('Auth completion failed:', error);
			authError = 'Failed to complete authentication';
		} finally {
			loading = false;
		}
	}

	// Manual API key authentication (fallback)
	async function authenticateWithApiKey() {
		if (!apiKey.trim() || loading) return;

		loading = true;
		authError = '';
		statusMessage = '';

		try {
			const response = await fetch('/api/claude/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					apiKey: apiKey.trim()
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				statusMessage = 'API key authentication successful!';
				apiKey = '';
				showManualAuth = false;
				await checkAuthStatus();
			} else {
				authError = data.error || 'Invalid API key';
			}
		} catch (error) {
			console.error('API key auth failed:', error);
			authError = 'Failed to authenticate with API key';
		} finally {
			loading = false;
		}
	}

	// Sign out
	async function signOut() {
		if (loading) return;

		loading = true;
		authError = '';
		statusMessage = '';

		try {
			const response = await fetch('/api/claude/auth', {
				method: 'DELETE'
			});

			if (response.ok) {
				statusMessage = 'Signed out successfully';
				await checkAuthStatus();
			} else {
				const data = await response.json();
				authError = data.error || 'Failed to sign out';
			}
		} catch (error) {
			console.error('Sign out failed:', error);
			authError = 'Failed to sign out';
		} finally {
			loading = false;
		}
	}

	// Cancel current flow
	function cancelFlow() {
		showCodeInput = false;
		showManualAuth = false;
		authCode = '';
		apiKey = '';
		oauthUrl = '';
		sessionId = '';
		authError = '';
		statusMessage = '';
	}
</script>

<div class="claude-auth">
	<header class="settings-header">
		<h3 class="settings-title">Claude Authentication</h3>
		<p class="settings-description">
			Connect your Claude (Anthropic) account to enable AI-powered coding sessions.
		</p>
	</header>

	<div class="auth-content">
		{#if authStatus === 'checking'}
			<div class="status-card checking">
				<LoadingSpinner size="small" />
				<span>Checking authentication status...</span>
			</div>
		{:else if authStatus === 'authenticated'}
			<!-- Authenticated State -->
			<div class="status-card authenticated">
				<IconCloudCheck size={24} class="status-icon success" />
				<div class="status-info">
					<h4>Connected to Claude</h4>
					<p>Your Claude account is authenticated and ready to use.</p>
				</div>
				<Button onclick={signOut} variant="ghost" size="small" disabled={loading}>Sign Out</Button>
			</div>
		{:else if authStatus === 'not_authenticated'}
			<!-- Not Authenticated State -->
			<div class="status-card not-authenticated">
				<IconCloudX size={24} class="status-icon warning" />
				<div class="status-info">
					<h4>Claude Not Connected</h4>
					<p>Connect your Claude account to access AI-powered features.</p>
					{#if statusMessage}
						<p class="status-hint">{statusMessage}</p>
					{/if}
				</div>
			</div>

			{#if !showCodeInput && !showManualAuth}
				<!-- Authentication Options -->
				<div class="auth-options">
					<div class="auth-method">
						<h5>Recommended: OAuth Authentication</h5>
						<p>Secure authentication through Anthropic's official OAuth flow.</p>
						<Button onclick={startOAuthFlow} variant="primary" disabled={loading} {loading}>
							<IconExternalLink size={16} />
							Login with Claude
						</Button>
					</div>

					<div class="auth-divider">
						<span>or</span>
					</div>

					<div class="auth-method">
						<h5>Manual: API Key</h5>
						<p>Enter your Claude API key directly (less secure).</p>
						<Button onclick={() => (showManualAuth = true)} variant="ghost" size="small">
							<IconKey size={16} />
							Use API Key
						</Button>
					</div>
				</div>
			{:else if showCodeInput}
				<!-- OAuth Code Input -->
				<div class="auth-flow">
					<h4>Complete Authentication</h4>
					<p>After authorizing in the popup window, paste the authorization code below:</p>

					<div class="code-input">
						<Input
							bind:value={authCode}
							placeholder="Paste authorization code here"
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
						/>
					</div>

					<div class="flow-actions">
						<Button onclick={cancelFlow} variant="ghost" size="small">Cancel</Button>
						<Button
							onclick={completeAuth}
							variant="primary"
							disabled={!authCode.trim() || loading}
							{loading}
						>
							Complete Authentication
						</Button>
					</div>

					{#if oauthUrl}
						<div class="oauth-url">
							<p>
								If the popup was blocked, <a
									href={oauthUrl}
									target="_blank"
									rel="noopener noreferrer">click here to open manually</a
								>.
							</p>
						</div>
					{/if}
				</div>
			{:else if showManualAuth}
				<!-- Manual API Key Input -->
				<div class="auth-flow">
					<h4>API Key Authentication</h4>
					<p>
						Enter your Claude API key. You can find this in your
						<a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
							>Anthropic Console</a
						>.
					</p>

					<div class="key-input">
						<Input
							bind:value={apiKey}
							type="password"
							placeholder="sk-ant-..."
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
						/>
					</div>

					<div class="flow-actions">
						<Button onclick={cancelFlow} variant="ghost" size="small">Cancel</Button>
						<Button
							onclick={authenticateWithApiKey}
							variant="primary"
							disabled={!apiKey.trim() || loading}
							{loading}
						>
							Authenticate
						</Button>
					</div>
				</div>
			{/if}
		{:else if authStatus === 'error'}
			<!-- Error State -->
			<ErrorDisplay error={authError} />
			<Button onclick={checkAuthStatus} variant="ghost" size="small">Retry</Button>
		{/if}

		<!-- Status Messages -->
		{#if statusMessage}
			<div class="status-message success">
				{statusMessage}
			</div>
		{/if}

		{#if authError}
			<div class="status-message error">
				{authError}
			</div>
		{/if}
	</div>
</div>

<style>
	.claude-auth {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		height: 100%;
	}

	.settings-header {
		border-bottom: 1px solid var(--primary-dim);
		padding-bottom: var(--space-4);
	}

	.settings-title {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.settings-description {
		color: var(--text-muted);
		margin: 0;
		font-size: 0.9rem;
	}

	.auth-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.status-card {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		background: rgba(46, 230, 107, 0.02);
	}

	.status-card.checking {
		justify-content: center;
		gap: var(--space-3);
		color: var(--text-muted);
	}

	.status-card.authenticated {
		border-color: var(--primary);
		background: rgba(46, 230, 107, 0.05);
	}

	.status-card.not-authenticated {
		border-color: var(--accent-amber);
		background: rgba(255, 187, 0, 0.05);
	}

	.status-icon.success {
		color: var(--primary);
	}

	.status-icon.warning {
		color: var(--accent-amber);
	}

	.status-info {
		flex: 1;
	}

	.status-info h4 {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		margin: 0 0 var(--space-2) 0;
		color: var(--text-primary);
	}

	.status-info p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.status-hint {
		margin-top: var(--space-2) !important;
		font-style: italic;
		color: var(--accent-amber);
	}

	.auth-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.auth-method {
		padding: var(--space-4);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		background: rgba(46, 230, 107, 0.02);
	}

	.auth-method h5 {
		font-family: var(--font-mono);
		font-size: 1rem;
		margin: 0 0 var(--space-2) 0;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.auth-method p {
		margin: 0 0 var(--space-3) 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.auth-divider {
		text-align: center;
		position: relative;
		color: var(--text-muted);
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.auth-divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--primary-dim);
		z-index: 0;
	}

	.auth-divider span {
		background: var(--bg);
		padding: 0 var(--space-3);
		position: relative;
		z-index: 1;
	}

	.auth-flow {
		padding: var(--space-4);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		background: rgba(46, 230, 107, 0.02);
	}

	.auth-flow h4 {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		margin: 0 0 var(--space-3) 0;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.auth-flow p {
		margin: 0 0 var(--space-4) 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.code-input,
	.key-input {
		margin-bottom: var(--space-4);
	}

	.flow-actions {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}

	.oauth-url {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--primary-dim);
	}

	.oauth-url p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.oauth-url a {
		color: var(--primary);
		text-decoration: underline;
	}

	.oauth-url a:hover {
		color: var(--primary);
		text-shadow: 0 0 4px var(--primary-glow);
	}

	.status-message {
		padding: var(--space-3);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		margin-top: var(--space-2);
	}

	.status-message.success {
		background: rgba(46, 230, 107, 0.1);
		border: 1px solid var(--primary);
		color: var(--primary);
	}

	.status-message.error {
		background: rgba(255, 59, 74, 0.1);
		border: 1px solid var(--accent-red);
		color: var(--accent-red);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.status-card {
			flex-direction: column;
			text-align: center;
			gap: var(--space-3);
		}

		.flow-actions {
			flex-direction: column;
		}
	}
</style>
