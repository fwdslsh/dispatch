<script>
	/**
	 * Onboarding page - Progressive first-time user setup
	 * Manages the complete onboarding workflow including:
	 * - Authentication setup
	 * - Workspace creation
	 * - Basic settings configuration
	 * - API key display (shown ONCE)
	 * - Completion and redirection
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import OnboardingFlow from '$lib/client/onboarding/OnboardingFlow.svelte';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '$lib/client/onboarding/OnboardingViewModel.svelte.js';
	import Shell from '$lib/client/shared/components/Shell.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';

	// Server load data
	export let data;
	export let form; // SvelteKit form action response

	// State management
	let onboardingViewModel = $state(null);
	let isLoading = $state(true);
	let error = $state(null);
	let showApiKey = $state(false);
	let apiKeyCopied = $state(false);
	let canContinue = $state(false);

	onMount(async () => {
		await initializeOnboarding();
	});

	/**
	 * Initialize onboarding system
	 */
	async function initializeOnboarding() {
		try {
			const container = useServiceContainer();
			const apiClientPromise = container.get('sessionApi');

			// Wait for API client to be available
			const apiClient = await (typeof apiClientPromise?.then === 'function'
				? apiClientPromise
				: Promise.resolve(apiClientPromise));

			if (!apiClient) {
				throw new Error('API client not available');
			}

			// Check if onboarding is already complete (from server load)
			if (data?.onboardingStatus?.isComplete) {
				// Redirect to main app if already completed
				await goto('/', { replaceState: true });
				return;
			}

			// Initialize onboarding ViewModel (no API call - just local state)
			onboardingViewModel = new OnboardingViewModel(apiClient);

			error = null;
		} catch (err) {
			console.error('Failed to initialize onboarding:', err);
			error = err.message || 'Failed to load onboarding system';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Handle onboarding completion
	 * @param {CustomEvent} event - Completion event with result details
	 */
	async function handleOnboardingComplete(event) {
		try {
			// Check if we got an API key from the form action
			if (form?.success && form?.apiKey) {
				showApiKey = true;
			} else {
				// If no form response, check event detail
				const result = event.detail;
				if (result?.apiKey) {
					showApiKey = true;
				} else {
					// No API key in response - redirect to main app
					await goto('/');
				}
			}
		} catch (err) {
			console.error('Failed to handle onboarding completion:', err);
			error = err.message || 'Failed to complete onboarding';
		}
	}

	/**
	 * Handle onboarding errors
	 * @param {CustomEvent} event - Error event
	 */
	function handleOnboardingError(event) {
		const { error: errorMessage } = event.detail;
		error = errorMessage;
	}

	/**
	 * Copy API key to clipboard
	 */
	async function copyApiKey() {
		const key = form?.apiKey?.key;
		if (!key) return;

		try {
			await navigator.clipboard.writeText(key);
			apiKeyCopied = true;
			canContinue = true; // Allow continue after copying

			// Reset copied state after 2 seconds
			setTimeout(() => {
				apiKeyCopied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy API key:', err);
			error = 'Failed to copy to clipboard';
		}
	}

	/**
	 * Navigate to main app
	 */
	async function continueToApp() {
		await goto('/', { replaceState: true });
	}

	/**
	 * Allow user to continue without copying (checkbox confirmation)
	 */
	function confirmWithoutCopy() {
		canContinue = true;
	}
</script>

<svelte:head>
	<title>Welcome to Dispatch - Get Started</title>
	<meta
		name="description"
		content="Set up your Dispatch development environment with our guided onboarding process."
	/>
</svelte:head>

<Shell>
	<div class="onboarding-page">
		{#if isLoading}
			<div class="loading-container">
				<div class="spinner"></div>
				<p>Loading onboarding system...</p>
			</div>
		{:else if error}
			<div class="error-container">
				<h1>Onboarding Error</h1>
				<p class="error-message">{error}</p>
				<button class="retry-button" onclick={initializeOnboarding}> Try Again </button>
			</div>
		{:else if showApiKey && form?.apiKey}
			<!-- API Key Display (shown ONCE) -->
			<div class="api-key-display-container">
				<div class="api-key-card">
					<h1>Your API Key</h1>
					<p class="subtitle">Save this key securely - it will not be shown again!</p>

					<div class="warning-box">
						<div class="warning-icon">⚠️</div>
						<div class="warning-content">
							<strong>Important:</strong>
							This is the only time you will see this API key. Copy it now and store it in a secure location.
							You will need this key to log in to Dispatch.
						</div>
					</div>

					<div class="key-display-box">
						<code class="api-key-text">{form.apiKey.key}</code>
					</div>

					<div class="key-actions">
						<Button variant="primary" onclick={copyApiKey} fullWidth={true}>
							{apiKeyCopied ? '✓ Copied to Clipboard!' : 'Copy API Key'}
						</Button>
					</div>

					<div class="key-info">
						<p><strong>Key Label:</strong> {form.apiKey.label}</p>
						<p><strong>Key ID:</strong> {form.apiKey.id}</p>
						{#if form.workspace}
							<p><strong>Workspace:</strong> {form.workspace.name}</p>
						{/if}
					</div>

					{#if !canContinue}
						<div class="confirmation-box">
							<label class="checkbox-label">
								<input type="checkbox" onchange={confirmWithoutCopy} />
								<span>I have saved my API key in a secure location</span>
							</label>
						</div>
					{/if}

					<div class="continue-actions">
						<Button
							variant="primary"
							onclick={continueToApp}
							disabled={!canContinue}
							fullWidth={true}
						>
							Continue to Dispatch
						</Button>
					</div>
				</div>
			</div>
		{:else if onboardingViewModel}
			<OnboardingFlow viewModel={onboardingViewModel} onComplete={handleOnboardingComplete} />
		{/if}
	</div>
</Shell>

<style>
	.onboarding-page {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		padding: 2rem;
		box-sizing: border-box;
	}

	.loading-container {
		text-align: center;
		justify-content: center;
		align-self: center;
	}

	.loading-container p {
		margin-top: 1rem;
		font-size: 1.125rem;
		opacity: 0.9;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top: 3px solid white;
		border-radius: var(--radius-full);
		animation: spin 1s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-container {
		background: white;
		border-radius: var(--radius-lg);
		padding: 3rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
		text-align: center;
		max-width: 500px;
		width: 100%;
	}

	.error-container h1 {
		margin: 0 0 1rem 0;
		color: #dc2626;
		font-size: 1.5rem;
	}

	.error-message {
		color: #6b7280;
		margin-bottom: 2rem;
		line-height: 1.6;
	}

	.retry-button {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.retry-button:hover {
		background: #2563eb;
	}

	/* API Key Display Styles */
	.api-key-display-container {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		max-width: 600px;
	}

	.api-key-card {
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		padding: var(--space-6);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.api-key-card h1 {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 600;
		text-align: center;
	}

	.subtitle {
		margin: 0 0 var(--space-5) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		text-align: center;
	}

	.warning-box {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-4);
		background: color-mix(in oklab, var(--warning) 15%, transparent);
		border: 2px solid var(--warning);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-5);
	}

	.warning-icon {
		font-size: var(--font-size-4);
		flex-shrink: 0;
	}

	.warning-content {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.6;
	}

	.key-display-box {
		padding: var(--space-5);
		background: var(--surface-primary-98);
		border: 2px solid var(--primary);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-4);
		text-align: center;
	}

	.api-key-text {
		display: block;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
		word-break: break-all;
		user-select: all;
		letter-spacing: 0.05em;
	}

	.key-actions {
		margin-bottom: var(--space-5);
	}

	.key-info {
		padding: var(--space-4);
		background: var(--surface-primary-98);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-4);
	}

	.key-info p {
		margin: var(--space-2) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.confirmation-box {
		padding: var(--space-4);
		background: var(--surface-primary-98);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-4);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		cursor: pointer;
		user-select: none;
	}

	.checkbox-label input[type='checkbox'] {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.continue-actions {
		margin-top: var(--space-4);
	}

	/* Responsive design */
	@media (max-width: 640px) {
		.onboarding-page {
			padding: 1rem;
		}

		.api-key-card {
			padding: var(--space-4);
		}

		.api-key-card h1 {
			font-size: var(--font-size-3);
		}

		.api-key-text {
			font-size: var(--font-size-1);
		}

		.error-container {
			padding: 2rem;
		}
	}
</style>
