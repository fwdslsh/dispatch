<script>
	import { goto } from '$app/navigation';
	import PublicUrlDisplay from '$lib/client/shared/components/PublicUrlDisplay.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	
	let error = $state('');
	let loading = $state(false);
	let authMethod = $state('ssh'); // 'ssh', 'oauth'
	let selectedSSHKeyFile = $state(null);
	let setupRequired = $state(false);

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

		// Check if already authenticated via HTTP (more robust than socket for login)
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
					// Token expired or invalid, clear it
					document.cookie = 'dispatch-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
				}
			} catch {
				// Ignore; user can try manual login
			}
			return;
		}
	});

	function getCookie(name) {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop().split(';').shift();
		return null;
	}

	async function handleSSHKeyFileSelect(event) {
		const file = event.target.files[0];
		if (!file) return;

		selectedSSHKeyFile = file;
	}

	async function readSSHKeyFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = e => resolve(e.target.result);
			reader.onerror = reject;
			reader.readAsText(file);
		});
	}

	async function handleLogin(e) {
		e.preventDefault();

		// In PWA mode, check if URL needs to be changed first
		if (isPWA && urlInput && urlInput !== currentUrl) {
			window.location.href = urlInput;
			return;
		}

		loading = true;
		error = '';
		
		try {
			let authPayload;
			let endpoint = '/api/auth/ssh';
			
			if (authMethod === 'ssh' && selectedSSHKeyFile) {
				const sshKeyContent = await readSSHKeyFile(selectedSSHKeyFile);
				authPayload = { publicKey: sshKeyContent };
			} else {
				error = 'Please select an SSH key file';
				loading = false;
				return;
			}

			const r = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(authPayload)
			});
			
			loading = false;
			
			if (r.ok) {
				// Cookie is already set by the server
				goto('/workspace');
			} else {
				const j = await r.json().catch(() => ({}));
				error = j?.error || 'Authentication failed';
			}
		} catch (err) {
			loading = false;
			error = 'Unable to reach server';
		}
	}

	function handleOAuth(provider) {
		// Redirect to OAuth provider
		window.location.href = `/api/auth/oauth?provider=${provider}`;
	}

	function goToSetup() {
		goto('/setup');
	}
</script>

<svelte:head>
	<title>dispatch</title>
</svelte:head>

<main class="login-container">
	<div class="container">
		<div class="login-content">
			<h1 class="glow">dispatch</h1>
			<p>terminal access via web</p>

			{#if setupRequired}
				<!-- Setup Required -->
				<div class="card aug" data-augmented-ui="tl-clip br-clip both">
					<div class="setup-prompt">
						<h3>Setup Required</h3>
						<p>This appears to be a new dispatch instance. Complete the initial setup to configure authentication.</p>
						<Button onclick={goToSetup} class="button primary aug">
							Start Setup
						</Button>
					</div>
				</div>
			{:else}
				<!-- Authentication Methods -->
				<div class="card aug" data-augmented-ui="tl-clip br-clip both">
					<!-- Auth Method Tabs -->
					<div class="auth-tabs">
						<button 
							class="auth-tab" 
							class:active={authMethod === 'ssh'}
							onclick={() => authMethod = 'ssh'}
						>
							SSH Key
						</button>
						<button 
							class="auth-tab" 
							class:active={authMethod === 'oauth'}
							onclick={() => authMethod = 'oauth'}
						>
							OAuth
						</button>
					</div>

					<!-- SSH Key Auth -->
					{#if authMethod === 'ssh'}
						<form onsubmit={handleLogin}>
							{#if isPWA}
								<Input
									bind:value={urlInput}
									type="url"
									placeholder="server URL"
									required
									disabled={loading}
								/>
							{/if}
							<div class="ssh-file-input">
								<label for="ssh-key-file" class="file-input-label">
									Select SSH Public Key File
								</label>
								<input
									id="ssh-key-file"
									type="file"
									accept=".pub,.txt"
									onchange={handleSSHKeyFileSelect}
									disabled={loading}
									class="file-input"
								/>
								{#if selectedSSHKeyFile}
									<div class="selected-file">
										Selected: {selectedSSHKeyFile.name}
									</div>
								{/if}
							</div>
							<Button 
								class="button primary aug" 
								type="submit" 
								disabled={loading || !selectedSSHKeyFile}
							>
								{loading ? 'authenticating...' : 'authenticate with ssh key'}
							</Button>
						</form>
					{/if}

					<!-- OAuth Auth -->
					{#if authMethod === 'oauth'}
						<div class="oauth-options">
							{#if isPWA}
								<Input
									bind:value={urlInput}
									type="url"
									placeholder="server URL"
									required
									disabled={loading}
								/>
							{/if}
							<div class="oauth-buttons">
								<Button 
									onclick={() => handleOAuth('github')}
									class="oauth-button github"
									disabled={loading}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
									</svg>
									Continue with GitHub
								</Button>
								<Button 
									onclick={() => handleOAuth('google')}
									class="oauth-button google"
									disabled={loading}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
										<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
										<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
										<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
									</svg>
									Continue with Google
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<PublicUrlDisplay />
			{#if error}
				<ErrorDisplay {error} />
			{/if}
		</div>
	</div>
</main>

<style>
	.login-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		position: relative;
		overflow: hidden;

		/* Animated matrix background */
		background:
			linear-gradient(
				135deg,
				color-mix(in oklab, var(--bg) 95%, var(--primary) 5%) 0%,
				var(--bg) 50%,
				color-mix(in oklab, var(--bg) 98%, var(--accent-cyan) 2%) 100%
			),
			url('/bg.svg');
		background-size:
			100% 100%,
			64px 64px;
		background-position:
			0 0,
			0 0;
		background-attachment: fixed, local;
		animation: matrixFlow 120s linear infinite;

		h1,
		p {
			margin: 0;
		}
	}

	/* Subtle matrix flow animation */
	@keyframes matrixFlow {
		0% {
			background-position:
				0 0,
				0 0;
		}
		100% {
			background-position:
				0 0,
				-64px -64px;
		}
	}

	/* Enhanced atmospheric overlay */
	.login-container::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background:
			radial-gradient(
				circle at 30% 20%,
				color-mix(in oklab, var(--primary) 8%, transparent) 0%,
				transparent 50%
			),
			radial-gradient(
				circle at 70% 80%,
				color-mix(in oklab, var(--accent-cyan) 6%, transparent) 0%,
				transparent 50%
			),
			radial-gradient(
				circle at 50% 50%,
				color-mix(in oklab, var(--accent-amber) 4%, transparent) 0%,
				transparent 60%
			);
		pointer-events: none;
		animation: atmosphericShift 40s ease-in-out infinite;
	}

	@keyframes atmosphericShift {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		33% {
			opacity: 0.8;
			transform: scale(1.02);
		}
		66% {
			opacity: 0.4;
			transform: scale(0.98);
		}
	}

	/* Scanning line effect */
	.login-container::after {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 2px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in oklab, var(--primary) 5%, transparent) 20%,
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
		transform: translateY(20px) scale(0.95);
	}

	@keyframes contentAppear {
		0% {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.login-content > * + * {
		margin-top: var(--space-5);
	}

	/* Enhanced title styling */
	.login-content h1 {
		font-family: var(--font-accent);
		font-size: clamp(2.5rem, 5vw, 4rem);
		font-weight: 400;
		background: linear-gradient(
			135deg,
			var(--primary) 0%,
			var(--primary-bright) 50%,
			var(--accent-cyan) 100%
		);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow:
			0 0 20px var(--primary-glow),
			0 0 40px var(--primary-glow),
			0 0 60px color-mix(in oklab, var(--primary) 20%, transparent);
		animation: titlePulse 3s ease-in-out infinite;
		letter-spacing: 0.05em;
		position: relative;
	}

	@keyframes titlePulse {
		0%,
		100% {
			filter: brightness(1);
			text-shadow:
				0 0 20px var(--primary-glow),
				0 0 40px var(--primary-glow);
		}
		50% {
			filter: brightness(1.1);
			text-shadow:
				0 0 25px var(--primary-glow),
				0 0 50px var(--primary-glow),
				0 0 75px color-mix(in oklab, var(--primary) 30%, transparent);
		}
	}

	/* Enhanced subtitle */
	.login-content p {
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		color: var(--muted);
		letter-spacing: 0.1em;
		text-transform: lowercase;
		opacity: 0.8;
		animation: subtitleFade 1.5s ease-in-out 0.3s forwards;
		transform: translateY(10px);
	}

	@keyframes subtitleFade {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Enhanced form card */
	.card {
		position: relative;
		background: color-mix(in oklab, var(--surface) 90%, transparent);
		backdrop-filter: blur(12px);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 8px;
		padding: var(--space-6);
		animation: cardMaterialize 1s ease-out 0.6s forwards;
		opacity: 0;
		transform: translateY(30px) scale(0.9);
		box-shadow:
			0 8px 32px color-mix(in oklab, var(--bg) 80%, transparent),
			0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent),
			inset 0 1px 0 color-mix(in oklab, var(--primary) 5%, transparent);
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 3%, transparent) 0%,
			transparent 50%,
			color-mix(in oklab, var(--accent-cyan) 2%, transparent) 100%
		);
		border-radius: inherit;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.card:hover::before {
		opacity: 1;
	}

	.card:hover {
		transform: translateY(-2px) scale(1.01);
		border-color: color-mix(in oklab, var(--primary) 30%, transparent);
		box-shadow:
			0 12px 48px color-mix(in oklab, var(--bg) 70%, transparent),
			0 0 0 1px color-mix(in oklab, var(--primary) 20%, transparent),
			0 0 20px color-mix(in oklab, var(--primary) 15%, transparent),
			inset 0 1px 0 color-mix(in oklab, var(--primary) 8%, transparent);
	}

	@keyframes cardMaterialize {
		0% {
			opacity: 0;
			transform: translateY(30px) scale(0.9);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: center;
		min-width: 320px;
		position: relative;
	}

	/* Enhanced form animations */
	form :global(.input-group) {
		animation: inputSlideIn 0.6s ease-out forwards;
		opacity: 0;
		transform: translateX(-20px);
	}

	form :global(.input-group:nth-child(1)) {
		animation-delay: 0.8s;
	}

	form :global(.input-group:nth-child(2)) {
		animation-delay: 1s;
	}

	@keyframes inputSlideIn {
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	form :global(button) {
		width: 100%;
		animation: buttonMaterialize 0.8s ease-out 1.2s forwards;
		opacity: 0;
		transform: translateY(20px) scale(0.9);
		position: relative;
		overflow: hidden;
	}

	@keyframes buttonMaterialize {
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Enhanced button hover effects */
	/* form :global(button:hover) {
		animation: buttonPulse 0.6s ease-in-out;
	}

	@keyframes buttonPulse {
		0%, 100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.02);
			opacity: 1;
		}
	}
 */
	/* Floating particles effect */
	.login-content::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background-image:
			radial-gradient(
				circle at 20% 30%,
				color-mix(in oklab, var(--primary) 5%, transparent) 1px,
				transparent 1px
			),
			radial-gradient(
				circle at 80% 70%,
				color-mix(in oklab, var(--accent-cyan) 4%, transparent) 1px,
				transparent 1px
			),
			radial-gradient(
				circle at 40% 80%,
				color-mix(in oklab, var(--accent-amber) 3%, transparent) 1px,
				transparent 1px
			);
		background-size:
			100px 100px,
			150px 150px,
			120px 120px;
		animation: particleDrift 60s linear infinite;
		pointer-events: none;
		z-index: -1;
	}

	@keyframes particleDrift {
		0% {
			transform: translateX(0) translateY(0) rotate(0deg);
		}
		100% {
			transform: translateX(-100px) translateY(-100px) rotate(360deg);
		}
	}

	/* Error and loading state enhancements */
	:global(.error-display) {
		animation:
			errorSlideIn 0.4s ease-out,
			errorShake 0.5s ease-in-out 0.4s;
	}

	@keyframes errorSlideIn {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Enhanced loading states */
	.card:has(:global(button[disabled])) {
		border-color: color-mix(in oklab, var(--accent-cyan) 30%, transparent);
		animation: loadingPulse 2s ease-in-out infinite;
	}

	@keyframes loadingPulse {
		0%,
		100% {
			box-shadow:
				0 8px 32px color-mix(in oklab, var(--bg) 80%, transparent),
				0 0 0 1px color-mix(in oklab, var(--accent-cyan) 10%, transparent);
		}
		50% {
			box-shadow:
				0 12px 40px color-mix(in oklab, var(--bg) 70%, transparent),
				0 0 0 1px color-mix(in oklab, var(--accent-cyan) 20%, transparent),
				0 0 20px color-mix(in oklab, var(--accent-cyan) 10%, transparent);
		}
	}

	.setup-prompt {
		text-align: center;
	}

	.setup-prompt h3 {
		margin-bottom: 1rem;
		color: var(--text);
	}

	.setup-prompt p {
		margin-bottom: 1.5rem;
		color: var(--text-muted);
	}

	.auth-tabs {
		display: flex;
		border-bottom: 1px solid var(--surface-border);
		margin-bottom: 1.5rem;
	}

	.auth-tab {
		flex: 1;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
		border-bottom: 2px solid transparent;
	}

	.auth-tab:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.auth-tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
	}

	.ssh-input textarea {
		width: 100%;
		min-height: 100px;
		padding: 0.75rem;
		border: 1px solid var(--surface-border);
		border-radius: 0.375rem;
		background: var(--surface);
		color: var(--text);
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		resize: vertical;
		margin-bottom: 1rem;
	}

	.ssh-input textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 20%, transparent 80%);
	}

	.ssh-file-input {
		margin-bottom: 1rem;
	}

	.file-input-label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--text);
	}

	.file-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed var(--surface-border);
		border-radius: 0.375rem;
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
		transition: all 0.2s;
	}

	.file-input:hover:not(:disabled) {
		border-color: var(--primary);
		background: var(--surface-hover);
	}

	.file-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 20%, transparent 80%);
	}

	.selected-file {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: var(--surface-elevated);
		border: 1px solid var(--surface-border);
		border-radius: 0.25rem;
		color: var(--text);
		font-size: 0.875rem;
	}

	.oauth-options {
		text-align: center;
	}

	.oauth-buttons {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.oauth-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem 1.5rem;
		border: 1px solid var(--surface-border);
		border-radius: 0.5rem;
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
		transition: all 0.2s;
		cursor: pointer;
	}

	.oauth-button:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--primary);
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

	.oauth-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Responsive enhancements */
	@media (max-width: 480px) {
		.login-container {
			padding: var(--space-4);
		}

		.login-content h1 {
			font-size: clamp(3rem, 8vw, 4.5rem);
		}

		form {
			min-width: 280px;
		}

		.card {
			padding: var(--space-5);
		}
	}

	/* Accessibility enhancements */
	@media (prefers-reduced-motion: reduce) {
		.login-container {
			animation: none;
		}

		.login-container::before,
		.login-container::after,
		.login-content::before {
			animation: none;
		}

		.login-content h1 {
			animation: none;
		}

		.card {
			animation: none;
			opacity: 1;
			transform: none;
		}

		form :global(.input-group),
		form :global(button) {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
