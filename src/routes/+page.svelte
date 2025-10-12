<script>
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import PublicUrlDisplay from '$lib/client/shared/components/PublicUrlDisplay.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import { AuthViewModel } from '$lib/client/shared/state/AuthViewModel.svelte.js';
	import IconButton from '$lib/client/shared/components/IconButton.svelte';
	import IconGitHub from '$lib/client/shared/components/Icons/IconGitHub.svelte';
	import IconGoogle from '$lib/client/shared/components/Icons/IconGoogle.svelte';
	// SvelteKit form action response
	/** @type {{ form: import('./$types').ActionData }} */
	let { form } = $props();

	// Create ViewModel instance
	const authViewModel = new AuthViewModel();
	const iconByProvider = {
		github: IconGitHub,
		google: IconGoogle
	};
	const availableOAuthProviders = $derived(() =>
		(authViewModel.oauthProviders ?? []).filter(
			(provider) => provider.available && iconByProvider[provider.name]
		)
	);
	const showOnboardingLink = $derived(() => authViewModel.onboardingComplete === false);
	// Component state
	let apiKey = $state('');
	let isSubmitting = $state(false);
	// Initialize on mount
	onMount(async () => {
		const result = await authViewModel.initialize();

		if (result.redirectToWorkspace) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- Internal app route for authenticated users
			goto('/workspace');
		}
	});

	// Handle form submission with progressive enhancement
	const handleEnhance = ({ formData: _formData, cancel: _cancel, submitter: _submitter }) => {
		isSubmitting = true;

		// Let SvelteKit handle the submission
		return async ({ result, update }) => {
			isSubmitting = false;

			if (result.type === 'redirect') {
				// Successful login - redirect handled by SvelteKit
				/* eslint-disable svelte/no-navigation-without-resolve */
				await goto(result.location);
				/* eslint-enable svelte/no-navigation-without-resolve */
			} else if (result.type === 'failure') {
				// Error handled via form.error below
				await update();
			} else {
				// For any other result type, reset state
				await update();
			}
		};
	};
</script>

<svelte:head>
	<title>Login - Dispatch</title>
	<meta name="description" content="Log in to your Dispatch development environment" />
</svelte:head>

<main class="login-container">
	<div class="container">
		<div class="login-content">
			<h1>dispatch</h1>

			<div class="card aug" data-augmented-ui="tl-clip br-clip both">
				<!-- API Key Login Form -->
				<form method="POST" action="?/login" use:enhance={handleEnhance} class="login-form">
					<div class="form-group">
						<label for="api-key" class="form-label">API Key</label>
						<Input
							id="api-key"
							name="key"
							type="password"
							placeholder="Enter your API key"
							autocomplete="off"
							bind:value={apiKey}
							disabled={isSubmitting}
							required
							class="form-input"
							aria-describedby={form?.error ? 'login-error' : undefined}
						/>
					</div>

					{#if form?.error}
						<div id="login-error" class="error-message" role="alert">
							{form.error}
						</div>
					{/if}

					<Button
						type="submit"
						variant="primary"
						disabled={isSubmitting || !apiKey.trim()}
						loading={isSubmitting}
						fullWidth={true}
					>
						{#if isSubmitting}
							Connecting...
						{:else}
							Connect
						{/if}
					</Button>
				</form>

				{#if availableOAuthProviders.length}
					<div class="divider">
						<span>or</span>
					</div>

					<div class="oauth-buttons">
						{#each availableOAuthProviders as provider (provider.name)}
							<IconButton
								type="button"
								class={`oauth-button oauth-${provider.name}`}
								onclick={() => authViewModel.loginWithOAuth(provider.name)}
								disabled={isSubmitting}
								aria-label={`Log in with ${provider.displayName || provider.name}`}
							>
								<svelte:component this={iconByProvider[provider.name]} />
							</IconButton>
						{/each}
					</div>
				{/if}

				{#if showOnboardingLink}
					<div class="login-footer">
						<p class="footer-text">
							First time here?
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href="/onboarding" class="footer-link">Get started</a>
						</p>
					</div>
				{/if}
			</div>

			<PublicUrlDisplay />
			{#if authViewModel.error}
				<ErrorDisplay error={authViewModel.error} />
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

		.container {
			max-width: 80x;
		}
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
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		animation: contentAppear 1.2s cubic-bezier(0.23, 1, 0.32, 1) forwards;
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



	.login-content h1 {
		font-family: var(--font-accent);
		font-size: clamp(2.5rem, 6vw, 4rem);
		font-weight: 400;
		letter-spacing: 0.08em;
		text-transform: lowercase;
		margin: 0;
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

	.login-content p {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		text-transform: lowercase;
	}

	.card {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		background: color-mix(in oklab, var(--surface) 92%, transparent);
		backdrop-filter: blur(12px);
		border: 1px solid color-mix(in oklab, var(--line) 70%, transparent);
		border-radius: var(--radius-md);
		padding: var(--space-6);
		animation: cardMaterialize 1s ease-out 0.6s forwards;
		opacity: 0;
		transform: translateY(30px) scale(0.9);
		box-shadow: 0 12px 32px color-mix(in oklab, var(--bg) 85%, transparent);
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		.login-footer {
			margin-top: var(--space-4);
		}
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
	.login-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: stretch;
	}

	.error-message {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		color: var(--warn);
		font-size: var(--font-size-1);
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in oklab, var(--warn) 30%, transparent);
		background: color-mix(in oklab, var(--warn) 12%, transparent);
		text-align: left;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		justify-content: center;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}

	.oauth-buttons {
		display: flex;
		justify-content: center;
		gap: var(--space-3);
	}

	.oauth-button {
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
		background: color-mix(in oklab, var(--surface) 95%, transparent);
		transition:
			transform 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.oauth-button:hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		box-shadow: 0 8px 16px color-mix(in oklab, var(--bg) 80%, transparent);
	}

	.oauth-button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.oauth-github,
	.oauth-google {
		color: var(--text);
	}

	.oauth-button svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	.login-footer {
		text-align: center;
	}

	.footer-text {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.footer-link {
		margin-left: var(--space-1);
		color: var(--primary);
		text-decoration: none;
	}

	.footer-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 480px) {
		.login-container {
			padding: var(--space-6) var(--space-3);
		}

		.card {
			padding: var(--space-5);
		}

		.oauth-buttons {
			flex-wrap: wrap;
			gap: var(--space-2);
		}
	}
</style>
