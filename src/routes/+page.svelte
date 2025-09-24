<script>
	import { goto } from '$app/navigation';
	import PublicUrlDisplay from '$lib/client/shared/components/PublicUrlDisplay.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
	
	let error = $state('');
	let loading = $state(false);
	let authMethod = $state('webauthn'); // 'webauthn', 'oauth'
	let setupRequired = $state(false);
	let setupData = $state({
		username: '',
		email: ''
	});

	// PWA state
	let isPWA = $state(false);
	let currentUrl = $state('');
	let urlInput = $state('');

	onMount(async () => {
		// Detect if running as PWA
		isPWA =
			window.matchMedia('(display-mode: standalone)').matches ||
			/** @type {any} */ (window.navigator).standalone === true ||
			document.referrer.includes('android-app://');

		// Initialize current URL and input
		currentUrl = window.location.href;
		urlInput = currentUrl;

		// Check if setup is required
		try {
			const setupResponse = await fetch('/api/auth/setup');
			if (setupResponse.ok) {
				const setupData = await setupResponse.json();
				if (setupData.isFirstUser) {
					setupRequired = true;
					return;
				}
			}
		} catch {
			// Continue with normal login flow
		}

		// Check if already authenticated
		const authToken = getCookie('dispatch-auth-token');
		if (authToken) {
			try {
				const r = await fetch('/api/auth/check', {
					headers: {
						'Authorization': `Bearer ${authToken}`
					}
				});
				if (r.ok) {
					goto('/workspace');
				} else {
					// Clear invalid token
					document.cookie = 'dispatch-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
				}
			} catch {
				// Ignore; user can try login
			}
		}
	});

	function getCookie(name) {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop().split(';').shift();
		return null;
	}

	async function handleWebAuthnLogin() {
		if (isPWA && urlInput && urlInput !== currentUrl) {
			window.location.href = urlInput;
			return;
		}

		loading = true;
		error = '';

		try {
			// Get authentication options
			const optionsResponse = await fetch('/api/auth/webauthn/authenticate/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (!optionsResponse.ok) {
				throw new Error('Failed to get authentication options');
			}

			const options = await optionsResponse.json();

			// Start WebAuthn authentication
			const authResponse = await startAuthentication(options);

			// Verify authentication
			const verifyResponse = await fetch('/api/auth/webauthn/authenticate/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					challengeId: options.challengeId,
					response: authResponse
				})
			});

			if (!verifyResponse.ok) {
				const errorData = await verifyResponse.json();
				throw new Error(errorData.error || 'Authentication failed');
			}

			// Success - redirect to workspace
			goto('/workspace');
		} catch (err) {
			error = err.message || 'WebAuthn authentication failed';
		} finally {
			loading = false;
		}
	}

	async function handleWebAuthnSetup() {
		if (!setupData.username.trim()) {
			error = 'Username is required';
			return;
		}

		loading = true;
		error = '';

		try {
			// Get registration options
			const optionsResponse = await fetch('/api/auth/webauthn/register/options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: setupData.username,
					userDisplayName: setupData.username
				})
			});

			if (!optionsResponse.ok) {
				throw new Error('Failed to get registration options');
			}

			const options = await optionsResponse.json();

			// Start WebAuthn registration
			const regResponse = await startRegistration(options);

			// Verify registration
			const verifyResponse = await fetch('/api/auth/webauthn/register/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					challengeId: options.challengeId,
					response: regResponse,
					credentialName: 'Primary WebAuthn Credential',
					userData: setupData
				})
			});

			if (!verifyResponse.ok) {
				const errorData = await verifyResponse.json();
				throw new Error(errorData.error || 'Registration failed');
			}

			// Success - redirect to workspace
			goto('/workspace');
		} catch (err) {
			error = err.message || 'WebAuthn setup failed';
		} finally {
			loading = false;
		}
	}

	async function handleOAuthLogin(provider) {
		if (isPWA && urlInput && urlInput !== currentUrl) {
			window.location.href = urlInput;
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch('/api/auth/oauth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `${provider} OAuth not configured`);
			}

			const data = await response.json();
			window.location.href = data.authUrl;
		} catch (err) {
			error = err.message;
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>dispatch</title>
	<meta name="description" content="Terminal access via web" />
</svelte:head>

<div class="login-page">
	<div class="background-effects">
		<div class="grid-overlay"></div>
		<div class="scan-line"></div>
	</div>

	<main class="login-content">
		<div class="logo-section">
			<h1>dispatch</h1>
			<p>terminal access via web</p>
		</div>

		<div class="auth-section">
			{#if isPWA}
				<PublicUrlDisplay />
				<div class="url-input-section">
					<Input 
						bind:value={urlInput}
						placeholder="Enter server URL"
						disabled={loading}
					/>
				</div>
			{/if}

			{#if error}
				<ErrorDisplay {error} />
			{/if}

			{#if setupRequired}
				<!-- First User Setup -->
				<div class="setup-form">
					<h2>Welcome to Dispatch</h2>
					<p class="setup-description">
						Set up your admin account using WebAuthn for secure, phish-resistant authentication.
					</p>

					<div class="form-group">
						<label for="username">Username</label>
						<Input 
							id="username"
							bind:value={setupData.username}
							placeholder="Your username"
							disabled={loading}
						/>
					</div>

					<div class="form-group">
						<label for="email">Email (optional)</label>
						<Input 
							id="email"
							bind:value={setupData.email}
							placeholder="your@email.com"
							type="email"
							disabled={loading}
						/>
					</div>

					<Button 
						onclick={handleWebAuthnSetup}
						variant="primary"
						disabled={!setupData.username.trim() || loading}
						loading={loading}
						class="setup-button"
					>
						Set Up Admin Account
					</Button>

					<p class="webauthn-info">
						WebAuthn uses your device's built-in security (fingerprint, face recognition, or security key) 
						for secure authentication without passwords.
					</p>
				</div>
			{:else}
				<!-- Normal Login -->
				<div class="auth-tabs">
					<button 
						class="tab-button" 
						class:active={authMethod === 'webauthn'}
						onclick={() => authMethod = 'webauthn'}
					>
						WebAuthn
					</button>
					<button 
						class="tab-button" 
						class:active={authMethod === 'oauth'}
						onclick={() => authMethod = 'oauth'}
					>
						OAuth
					</button>
				</div>

				<div class="auth-content">
					{#if authMethod === 'webauthn'}
						<div class="webauthn-section">
							<div class="auth-method-info">
								<h3>WebAuthn Login</h3>
								<p>Use your device's built-in security for phish-resistant authentication.</p>
							</div>

							<Button 
								onclick={handleWebAuthnLogin}
								variant="primary"
								disabled={loading}
								loading={loading}
								class="auth-button"
							>
								{#if loading}
									<LoadingSpinner size="small" />
									Authenticating...
								{:else}
									🔐 Sign in with WebAuthn
								{/if}
							</Button>

							<p class="webauthn-help">
								Click the button above and follow your device's prompts to authenticate 
								using fingerprint, face recognition, or security key.
							</p>
						</div>
					{:else if authMethod === 'oauth'}
						<div class="oauth-section">
							<div class="auth-method-info">
								<h3>OAuth Login</h3>
								<p>Sign in with your existing GitHub or Google account.</p>
							</div>

							<div class="oauth-buttons">
								<Button 
									onclick={() => handleOAuthLogin('github')}
									variant="ghost"
									disabled={loading}
									class="oauth-button github"
								>
									<div class="oauth-content">
										<img src="/icons/github.svg" alt="GitHub" width="20" height="20" />
										<span>Continue with GitHub</span>
									</div>
								</Button>

								<Button 
									onclick={() => handleOAuthLogin('google')}
									variant="ghost"
									disabled={loading}
									class="oauth-button google"
								>
									<div class="oauth-content">
										<img src="/icons/google.svg" alt="Google" width="20" height="20" />
										<span>Continue with Google</span>
									</div>
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="footer-section">
			<p class="footer-note">
				After logging in, visit <a href="/developer-ssh">Developer SSH Access</a> to set up terminal access.
			</p>
		</div>
	</main>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
		overflow: hidden;
	}

	.background-effects {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.grid-overlay {
		position: absolute;
		inset: 0;
		background-image: 
			linear-gradient(rgba(0, 255, 0, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0, 255, 0, 0.03) 1px, transparent 1px);
		background-size: 20px 20px;
		animation: gridShift 20s ease-in-out infinite;
	}

	@keyframes gridShift {
		0%, 100% { transform: translate(0, 0); }
		50% { transform: translate(10px, 10px); }
	}

	.scan-line {
		position: absolute;
		width: 100%;
		height: 2px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in oklab, var(--primary) 8%, transparent) 40%,
			color-mix(in oklab, var(--accent-cyan) 6%, transparent) 60%,
			color-mix(in oklab, var(--accent-cyan) 3%, transparent) 80%,
			transparent 100%
		);
		animation: scanLinePassage 8s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes scanLinePassage {
		0% {
			left: -100%;
			top: 20%;
		}
		50% {
			left: 100%;
			top: 60%;
		}
		100% {
			left: -100%;
			top: 80%;
		}
	}

	.login-content {
		text-align: center;
		position: relative;
		z-index: 2;
		animation: contentAppear 1.2s cubic-bezier(0.23, 1, 0.32, 1) forwards;
		opacity: 0;
		max-width: 420px;
		width: 100%;
		padding: 2rem 1rem;
	}

	@keyframes contentAppear {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.logo-section {
		margin-bottom: 3rem;
	}

	.logo-section h1 {
		font-size: 3.5rem;
		font-weight: 900;
		background: linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin-bottom: 0.5rem;
		text-shadow: 0 0 30px color-mix(in oklab, var(--primary) 30%, transparent);
		letter-spacing: -0.02em;
	}

	.logo-section p {
		color: var(--text-muted);
		font-size: 1.1rem;
		font-weight: 300;
		letter-spacing: 0.05em;
	}

	.auth-section {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 16px;
		padding: 2rem;
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		margin-bottom: 2rem;
	}

	.setup-form h2 {
		color: var(--primary);
		margin-bottom: 1rem;
		font-size: 1.5rem;
	}

	.setup-description {
		color: var(--text-muted);
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.form-group {
		margin-bottom: 1.5rem;
		text-align: left;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
		color: var(--text);
	}

	.setup-button {
		width: 100%;
		margin-bottom: 1rem;
	}

	.webauthn-info {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.auth-tabs {
		display: flex;
		margin-bottom: 2rem;
		background: var(--surface-hover);
		border-radius: 8px;
		padding: 4px;
	}

	.tab-button {
		flex: 1;
		padding: 0.75rem 1rem;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s ease;
		font-weight: 500;
	}

	.tab-button.active {
		background: var(--surface);
		color: var(--primary);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.tab-button:hover:not(.active) {
		color: var(--text);
		background: color-mix(in oklab, var(--surface) 50%, transparent);
	}

	.auth-method-info {
		margin-bottom: 2rem;
	}

	.auth-method-info h3 {
		color: var(--primary);
		margin-bottom: 0.5rem;
		font-size: 1.25rem;
	}

	.auth-method-info p {
		color: var(--text-muted);
		line-height: 1.5;
	}

	.auth-button {
		width: 100%;
		margin-bottom: 1rem;
		min-height: 48px;
	}

	.webauthn-help {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.oauth-buttons {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.oauth-button {
		width: 100%;
		min-height: 48px;
		border: 1px solid var(--surface-border);
	}

	.oauth-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.oauth-button.github:hover:not(:disabled) {
		background: #24292e;
		color: white;
		border-color: #24292e;
	}

	.oauth-button.google:hover:not(:disabled) {
		background: #4285f4;
		color: white;
		border-color: #4285f4;
	}

	.url-input-section {
		margin-bottom: 1.5rem;
	}

	.footer-section {
		text-align: center;
	}

	.footer-note {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.footer-note a {
		color: var(--primary);
		text-decoration: none;
	}

	.footer-note a:hover {
		text-decoration: underline;
	}

	@media (max-width: 480px) {
		.login-content {
			padding: 1rem;
		}

		.logo-section h1 {
			font-size: 2.5rem;
		}

		.auth-section {
			padding: 1.5rem;
		}

		.oauth-buttons {
			gap: 0.75rem;
		}
	}
</style>