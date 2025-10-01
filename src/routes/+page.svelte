<script>
	import { goto } from '$app/navigation';
	import PublicUrlDisplay from '$lib/client/shared/components/PublicUrlDisplay.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	let key = $state('');
	let error = $state('');
	let loading = $state(false);
	let authConfig = $state(null);

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

		// Load authentication configuration
		try {
			const r = await fetch('/api/auth/config');
			if (r.ok) {
				authConfig = await r.json();
			}
		} catch (err) {
			console.error('Failed to load auth config:', err);
		}

		// Check if already authenticated via HTTP (more robust than socket for login)
		const storedKey = localStorage.getItem('dispatch-auth-key');
		if (storedKey) {
			try {
				const r = await fetch(`/api/auth/check?key=${encodeURIComponent(storedKey)}`);
				if (r.ok) {
					goto('/workspace');
				} else {
					localStorage.removeItem('dispatch-auth-key');
				}
			} catch {
				// Ignore; user can try manual login
			}
			return;
		}
	});

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
			const r = await fetch('/api/auth/check', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key })
			});
			loading = false;
			if (r.ok) {
				localStorage.setItem('dispatch-auth-key', key);
				goto('/workspace');
			} else {
				const j = await r.json().catch(() => ({}));
				error = j?.error || 'Invalid key';
			}
		} catch {
			loading = false;
			error = 'Unable to reach server';
		}
	}

	function handleOAuthLogin() {
		if (!authConfig?.oauth_configured) return;

		// Redirect to OAuth authorization endpoint
		const redirectUri = authConfig.oauth_redirect_uri;
		const clientId = authConfig.oauth_client_id;
		const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
		window.location.href = authUrl;
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

			<div class="card aug" data-augmented-ui="tl-clip br-clip both">
				{#if authConfig}
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

						{#if authConfig.terminal_key_set}
							<Input
								bind:value={key}
								type="password"
								placeholder="terminal key"
								data-testid="terminal-key-input"
								required
								disabled={loading}
							/>
							<Button class="button primary aug" type="submit" disabled={loading}>
								{loading ? 'connecting...' : 'connect'}
							</Button>
						{/if}

						{#if authConfig.oauth_configured}
							{#if authConfig.terminal_key_set}
								<div class="auth-divider">
									<span>or</span>
								</div>
							{/if}
							<Button
								class="button oauth aug"
								type="button"
								onclick={handleOAuthLogin}
								disabled={loading}
							>
								<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
									<path d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"/>
								</svg>
								Sign in with GitHub
							</Button>
						{/if}

						{#if !authConfig.terminal_key_set && !authConfig.oauth_configured}
							<p class="auth-notice">No authentication methods configured. Please contact your administrator.</p>
						{/if}
					</form>
				{:else}
					<div class="loading-auth">
						<p>Loading authentication options...</p>
					</div>
				{/if}
			</div>

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

	/* Auth divider styling */
	.auth-divider {
		display: flex;
		align-items: center;
		text-align: center;
		margin: var(--space-4) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.auth-divider::before,
	.auth-divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--line);
	}

	.auth-divider span {
		padding: 0 var(--space-3);
	}

	/* OAuth button styling */
	:global(.button.oauth) {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--text);
	}

	:global(.button.oauth:hover) {
		background: color-mix(in oklab, var(--surface) 90%, var(--primary) 10%);
		border-color: var(--primary);
	}

	:global(.button.oauth svg) {
		flex-shrink: 0;
	}

	/* Auth notice styling */
	.auth-notice {
		color: var(--warn);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		text-align: center;
		margin: 0;
		padding: var(--space-4);
		background: color-mix(in oklab, var(--warn) 10%, transparent);
		border: 1px solid color-mix(in oklab, var(--warn) 30%, transparent);
		border-radius: var(--radius-sm);
	}

	/* Loading auth state */
	.loading-auth {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-6);
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
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
