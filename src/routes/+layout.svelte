<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '$lib/client/shared/styles/index.css';
	import { getStoredAuthToken } from '$lib/client/shared/socket-auth.js';
	import { useServiceContainer, provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '$lib/client/state/OnboardingViewModel.svelte.js';

	let { data, children } = $props();
	let onboardingViewModel = $state(null);
	let hasCheckedOnboarding = $state(false);

	// Provide service container for dependency injection
	const serviceContainer = provideServiceContainer();

	onMount(async () => {
		// Set body class based on whether TERMINAL_KEY is configured OR user has stored auth token
		const hasStoredAuth = !!getStoredAuthToken();
		const hasAuth = data?.hasTerminalKey || hasStoredAuth;

		if (!hasAuth) {
			document.body.classList.add('no-key');
		} else {
			document.body.classList.remove('no-key');
		}

		// Check onboarding status if user is authenticated
		if (hasAuth) {
			await checkOnboardingStatus();
		}
	});

	/**
	 * Check if user needs onboarding and redirect accordingly
	 */
	async function checkOnboardingStatus() {
		try {
			const container = useServiceContainer();
			const apiClientPromise = container.get('sessionApi');

			// Wait for API client
			const apiClient = await (typeof apiClientPromise?.then === 'function' ?
				apiClientPromise : Promise.resolve(apiClientPromise));

			if (!apiClient) {
				console.warn('API client not available for onboarding check');
				hasCheckedOnboarding = true;
				return;
			}


			// Initialize onboarding ViewModel
			onboardingViewModel = new OnboardingViewModel(apiClient);
			await onboardingViewModel.loadState();

			console.log('[Layout] Onboarding state loaded:', {
				currentStep: onboardingViewModel.currentStep,
				completedSteps: onboardingViewModel.completedSteps,
				isComplete: onboardingViewModel.isComplete
			});

			// Check if we need to redirect to onboarding
			const currentPath = $page.url.pathname;
			const isOnOnboardingPage = currentPath.startsWith('/onboarding');
			const shouldOnboard = !onboardingViewModel.isComplete;

			console.log('[Layout] Redirect logic:', {
				currentPath,
				isOnOnboardingPage,
				shouldOnboard,
				isComplete: onboardingViewModel.isComplete
			});

			if (shouldOnboard && !isOnOnboardingPage) {
				// User needs onboarding and isn't on onboarding page
				await goto('/onboarding', { replaceState: true });
			} else if (!shouldOnboard && isOnOnboardingPage) {
				// User completed onboarding but is still on onboarding page
				await goto('/', { replaceState: true });
			}

			hasCheckedOnboarding = true;
		} catch (error) {
			console.error('Failed to check onboarding status:', error);
			hasCheckedOnboarding = true;
		}
	}
</script>

{@render children()}
