<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import PublicUrlDisplay from '$lib/client/shared/components/PublicUrlDisplay.svelte';
	import AuthLoginModal from '$lib/client/shared/components/AuthLoginModal.svelte';

	let showAuth = $state(true);
	let loading = $state(true);
	let needsSetup = $state(false);

	onMount(async () => {
		try {
			// Check if user is already authenticated
			const authResponse = await fetch('/api/auth/status');
			if (authResponse.ok) {
				const authData = await authResponse.json();
				if (authData.authenticated) {
					goto('/workspace');
					return;
				}
			}

			// Check if setup is needed
			const setupResponse = await fetch('/api/admin/setup/complete');
			const setupData = await setupResponse.json();
			if (!setupData.setupComplete) {
				goto('/setup');
				return;
			}

		} catch (err) {
			console.error('Auth check failed:', err);
		} finally {
			loading = false;
		}
	});

	function handleAuthSuccess() {
		goto('/workspace');
	}

	function handleAuthError(event) {
		console.error('Authentication failed:', event.detail);
	}
</script>

<svelte:head>
	<title>dispatch</title>
</svelte:head>

{#if loading}
	<main class="login-container">
		<div class="loading">Loading dispatch...</div>
	</main>
{:else}
	<main class="login-container">
		<div class="container">
			<div class="login-content">
				<h1 class="glow">dispatch</h1>
				<p>terminal access via web</p>
				<PublicUrlDisplay />
			</div>
		</div>
	</main>

	<AuthLoginModal
		bind:open={showAuth}
		onsuccess={handleAuthSuccess}
		onerror={handleAuthError}
	/>
{/if}

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

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--font-size-3);
		color: var(--muted);
	}
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
