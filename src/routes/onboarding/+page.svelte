<script>
	/**
	 * Onboarding page - Progressive first-time user setup
	 * Manages the complete onboarding workflow including:
	 * - Authentication setup
	 * - Workspace creation
	 * - Basic settings configuration
	 * - Completion and redirection
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import OnboardingFlow from '$lib/client/onboarding/OnboardingFlow.svelte';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '$lib/client/onboarding/OnboardingViewModel.svelte.js';
	import Shell from '$lib/client/shared/components/Shell.svelte';

	// State management
	let onboardingViewModel = $state(null);
	let isLoading = $state(true);
	let error = $state(null);

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

			// Check if onboarding is already complete
			const status = await apiClient.getSystemStatus();
			if (status.onboarding.isComplete) {
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
			// OnboardingFlow already submitted the data and redirected
			// This is just a fallback handler
			console.log('Onboarding complete:', event.detail);
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

	/* Responsive design */
	@media (max-width: 640px) {
		.onboarding-page {
			padding: 1rem;
		}

		.error-container {
			padding: 2rem;
		}
	}
</style>
