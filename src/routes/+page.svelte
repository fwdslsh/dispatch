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
	import Static from '$lib/client/shared/components/Static.svelte';
	// SvelteKit form action response
	/** @type {{ data: import('./$types').PageData, form: import('./$types').ActionData }} */
	let { data, form } = $props();

	// Create ViewModel instance
	const authViewModel = new AuthViewModel();
	const iconByProvider = {
		github: IconGitHub,
		google: IconGoogle
	};

	function toDisplayName(name) {
		return name
			.split(/[-_]/)
			.map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
			.join(' ')
			.trim();
	}

	const settings = $derived(data?.settings ?? {});
	const authenticationSettings = $derived(settings.authentication ?? {});
	const rawOAuthProviders = $derived(settings.oauth?.providers ?? {});
	const normalizedOAuthProviders = $derived(
		Object.entries(rawOAuthProviders).map(([name, config]) => {
			const enabled = config?.enabled === true;
			const clientId = config?.clientId ?? config?.clientID ?? '';
			const hasClientId = typeof clientId === 'string' && clientId.trim().length > 0;

			return {
				name,
				displayName: config?.displayName || toDisplayName(name) || name,
				enabled,
				hasClientId,
				available: enabled && hasClientId
			};
		})
	);
	const layoutAvailableOAuthProviders = $derived(
		normalizedOAuthProviders.filter(
			(provider) => provider.available && iconByProvider[provider.name]
		)
	);
	const fallbackAvailableOAuthProviders = $derived(
		(authViewModel.oauthProviders ?? []).filter(
			(provider) => provider.available && iconByProvider[provider.name]
		)
	);
	const availableOAuthProviders = $derived(
		layoutAvailableOAuthProviders.length
			? layoutAvailableOAuthProviders
			: fallbackAvailableOAuthProviders
	);
	const terminalKeySet = $derived(() => {
		const key = authenticationSettings.terminal_key;
		return typeof key === 'string' && key.trim().length > 0;
	});

	$effect(() => {
		const providers = normalizedOAuthProviders;

		authViewModel.oauthProviders = providers;
		authViewModel.authConfig = {
			terminal_key_set: terminalKeySet,
			oauth_configured: providers.some((provider) => provider.available),
			oauthProviders: providers
		};
	});
	// Component state
	let apiKey = $state('');
	let isSubmitting = $state(false);
	// Initialize on mount
	onMount(async () => {
		const isAuthenticated = await authViewModel.checkExistingAuth();

		if (isAuthenticated) {
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
<Static />
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
		--bg: #0a0a0abe;
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
			50px 50px;
		background-position:
			0 0,
			0 0;
		background-attachment: fixed, local;
		/* 
		animation: matrixFlow 360s linear infinite; */

		.container {
			max-width: 80x;
		}
		h1 {
			margin: 0;
		}
	}

	/* TV static flow animation - vertical only */
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
		animation: atmosphericShift 20s ease-in-out infinite;
		opacity: 1;
	}

	@keyframes atmosphericShift {
		0% {
			opacity: 0.5;
			transform: scale(1);
		}
		17% {
			opacity: 0.7;
			transform: scale(1.01);
		}
		34% {
			opacity: 0.4;
			transform: scale(0.99);
		}
		51% {
			opacity: 0.65;
			transform: scale(1.015);
		}
		68% {
			opacity: 0.45;
			transform: scale(0.985);
		}
		85% {
			opacity: 0.6;
			transform: scale(1.005);
		}
		100% {
			opacity: 0.5;
			transform: scale(1);
		}
	}

	/* CRT Scan lines - persistent horizontal lines */
	.login-container::after {
		/* content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: repeating-linear-gradient(
			0deg,
			rgba(0, 0, 0, 0) 0px,
			rgba(0, 0, 0, 0.03) 1px,
			rgba(0, 0, 0, 0) 2px,
			rgba(0, 0, 0, 0) 3px
		);
		pointer-events: none;
		z-index: 1; */

		/* content: '';
		position: fixed;
		display:none;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image:
			repeating-linear-gradient(
				0deg,
				transparent 0px,
				transparent 2px,
				color-mix(in oklab, var(--primary) 2%, transparent) 2px,
				transparent 3px
			),
			repeating-linear-gradient(
				90deg,
				transparent 0px,
				transparent 2px,
				color-mix(in oklab, var(--accent-cyan) 2%, transparent) 2px,
				transparent 3px
			);
		animation:
			tvNoise 0.2s steps(4) infinite,
			tvFlicker 3s ease-in-out infinite;
		pointer-events: none;
		opacity: 0.15;
		will-change: opacity; */
	}

	/* TV interference bands - horizontal bars that move down */
	.container::before {
		content: '';
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: repeating-linear-gradient(
			0deg,
			transparent 0px,
			transparent 2px,
			color-mix(in oklab, var(--primary) 15%, transparent) 2px,
			color-mix(in oklab, var(--primary) 15%, transparent) 5px,
			transparent 5px,
			transparent 10px,
			color-mix(in oklab, var(--accent-cyan) 12%, transparent) 10px,
			color-mix(in oklab, var(--accent-cyan) 12%, transparent) 12px,
			transparent 12px,
			transparent 100px
		);
		animation: tvInterference 8s linear infinite;
		pointer-events: none;
		opacity: 0;
		will-change: transform, opacity;
	}

	@keyframes tvInterference {
		0% {
			transform: translateY(-100vh);
			opacity: 0;
		}
		5% {
			opacity: 0.4;
		}
		20% {
			opacity: 0.6;
		}
		40% {
			opacity: 0.3;
		}
		60% {
			opacity: 0.5;
		}
		80% {
			opacity: 0.2;
			transform: translateY(100vh);
		}
		95% {
			opacity: 0;
		}
		100% {
			transform: translateY(100vh);
			opacity: 0;
		}
	}

	/* Flickering noise overlay */
	.login-content::after {
		content: '';
		position: fixed;
		display: none;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image:
			repeating-linear-gradient(
				0deg,
				transparent 0px,
				transparent 2px,
				color-mix(in oklab, var(--primary) 2%, transparent) 2px,
				transparent 3px
			),
			repeating-linear-gradient(
				90deg,
				transparent 0px,
				transparent 2px,
				color-mix(in oklab, var(--accent-cyan) 2%, transparent) 2px,
				transparent 3px
			);
		animation:
			tvNoise 0.2s steps(4) infinite,
			tvFlicker 3s ease-in-out infinite;
		pointer-events: none;
		opacity: 0.15;
		will-change: opacity;
	}

	@keyframes tvNoise {
		0%,
		100% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(-1px, 1px);
		}
		50% {
			transform: translate(1px, -1px);
		}
		75% {
			transform: translate(-1px, -1px);
		}
	}

	@keyframes tvFlicker {
		0%,
		100% {
			opacity: 0.12;
		}
		10% {
			opacity: 0.18;
		}
		20% {
			opacity: 0.1;
		}
		30% {
			opacity: 0.2;
		}
		40% {
			opacity: 0.14;
		}
		50% {
			opacity: 0.22;
		}
		60% {
			opacity: 0.11;
		}
		70% {
			opacity: 0.16;
		}
		80% {
			opacity: 0.19;
		}
		90% {
			opacity: 0.13;
		}
	}

	.login-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		animation: contentAppear 1.2s cubic-bezier(0.23, 1, 0.32, 1) forwards;
		position: relative;
		z-index: 2;
		background: transparent;
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
		animation:
			titleSlideIn 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards,
			titleGlow 4s ease-in-out 1.4s infinite;
		letter-spacing: 0.05em;
		position: relative;
		opacity: 0;
		transform: translateY(-60px);
	}

	@keyframes titleSlideIn {
		0% {
			opacity: 0;
			transform: translateY(-80px) scale(0.85);
			filter: blur(12px);
		}
		50% {
			opacity: 0.5;
			filter: blur(6px);
		}
		75% {
			opacity: 0.85;
			filter: blur(2px);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
			filter: blur(0);
		}
	}

	@keyframes titleGlow {
		0%,
		100% {
			text-shadow:
				0 0 20px var(--primary-glow),
				0 0 40px var(--primary-glow),
				0 0 60px color-mix(in oklab, var(--primary) 20%, transparent);
		}
		25% {
			text-shadow:
				0 0 25px var(--primary-glow),
				0 0 50px var(--primary-glow),
				0 0 75px color-mix(in oklab, var(--primary) 25%, transparent),
				0 0 100px color-mix(in oklab, var(--accent-cyan) 10%, transparent);
		}
		50% {
			text-shadow:
				0 0 30px var(--primary-glow),
				0 0 60px var(--primary-glow),
				0 0 90px color-mix(in oklab, var(--primary) 30%, transparent),
				0 0 120px color-mix(in oklab, var(--accent-cyan) 15%, transparent);
		}
		75% {
			text-shadow:
				0 0 25px var(--primary-glow),
				0 0 50px var(--primary-glow),
				0 0 75px color-mix(in oklab, var(--primary) 25%, transparent),
				0 0 100px color-mix(in oklab, var(--accent-cyan) 10%, transparent);
		}
	}

	.card {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		background: #00000062;
		backdrop-filter: blur(12px);
		padding: var(--space-6);
		animation: cardMaterialize 1s ease-out 0.6s forwards;
		opacity: 0;
		transform: translateY(30px) scale(0.9);
		box-shadow: 0 12px 32px color-mix(in oklab, var(--bg) 85%, transparent);
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
			filter: blur(8px);
		}
		60% {
			opacity: 0.9;
			filter: blur(2px);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
			filter: blur(0);
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
