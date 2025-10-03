<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '$lib/client/shared/styles/index.css';
	import { getStoredAuthToken } from '$lib/client/shared/socket-auth.js';
	import {
		useServiceContainer,
		provideServiceContainer
	} from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '$lib/client/onboarding/OnboardingViewModel.svelte.js';

	let { data, children } = $props();
	let onboardingViewModel = $state(null);

	// Provide service container for dependency injection
	provideServiceContainer();

	onMount(async () => {
		// Set body class based on whether TERMINAL_KEY is configured OR user has stored auth token
		const hasStoredAuth = !!getStoredAuthToken();
		const hasAuth = data?.hasTerminalKey || hasStoredAuth;

		if (!hasAuth) {
			document.body.classList.add('no-key');
		} else {
			document.body.classList.remove('no-key');
		}

		await checkOnboardingStatus();
	});

	/**
	 * Check if user needs onboarding and redirect accordingly
	 */
	async function checkOnboardingStatus() {
		try {
			const container = useServiceContainer();
			const apiClientPromise = container.get('sessionApi');

			// Wait for API client
			const apiClient = await (typeof apiClientPromise?.then === 'function'
				? apiClientPromise
				: Promise.resolve(apiClientPromise));

			if (!apiClient) {
				console.warn('API client not available for onboarding check');
				return;
			}

			// Check system status (includes onboarding completion)
			const status = await apiClient.getSystemStatus();

			console.log('[Layout] System status loaded:', {
				onboardingComplete: status.onboarding.isComplete,
				authConfigured: status.authentication.configured
			});

			// Check if we need to redirect to onboarding
			const currentPath = page.url.pathname;
			const isOnOnboardingPage = currentPath.startsWith('/onboarding');
			const shouldOnboard = !status.onboarding.isComplete;

			console.log('[Layout] Redirect logic:', {
				currentPath,
				isOnOnboardingPage,
				shouldOnboard,
				isComplete: status.onboarding.isComplete
			});

			if (shouldOnboard && !isOnOnboardingPage) {
				// User needs onboarding and isn't on onboarding page
				/* eslint-disable svelte/no-navigation-without-resolve */
				goto('/onboarding', { replaceState: true });
				/* eslint-enable svelte/no-navigation-without-resolve */
			} else if (!shouldOnboard && isOnOnboardingPage) {
				// User completed onboarding but is still on onboarding page
				/* eslint-disable svelte/no-navigation-without-resolve */
				goto('/', { replaceState: true });
				/* eslint-enable svelte/no-navigation-without-resolve */
			}
		} catch (error) {
			console.error('Failed to check onboarding status:', error);
		}
	}
</script>

{@render children()}
