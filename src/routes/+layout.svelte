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
		// Phase 4: Migrate old localStorage keys to new unified key
		migrateAuthStorage();

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
	 * Phase 4: Migrate old localStorage keys to new unified structure
	 * This ensures both old OAuth users and terminal key users transition smoothly
	 */
	function migrateAuthStorage() {
		if (typeof localStorage === 'undefined') return;

		const newKey = 'dispatch-auth-token';
		const oldTerminalKey = 'dispatch-auth-key';
		const oldSessionKey = 'authSessionId';

		// Skip if already migrated (new key exists)
		if (localStorage.getItem(newKey)) {
			return;
		}

		// Strategy 1: Migrate OAuth session (authSessionId → dispatch-auth-token)
		const oauthSession = localStorage.getItem(oldSessionKey);
		if (oauthSession) {
			localStorage.setItem(newKey, oauthSession);
			console.log('[Storage Migration] Migrated OAuth session to dispatch-auth-token');

			// Migrate provider info if available
			const oldProvider = localStorage.getItem('authProvider');
			if (oldProvider) {
				localStorage.setItem('dispatch-auth-provider', oldProvider);
			}

			// Keep old keys for backward compatibility during migration window
			// They will be removed in Phase 5 cleanup
			return;
		}

		// Strategy 2: Migrate terminal key (dispatch-auth-key → dispatch-auth-token)
		const terminalKey = localStorage.getItem(oldTerminalKey);
		if (terminalKey) {
			localStorage.setItem(newKey, terminalKey);
			console.log('[Storage Migration] Migrated terminal key to dispatch-auth-token');

			// Keep old key for backward compatibility during migration window
			// It will be removed in Phase 5 cleanup
			return;
		}

		// No migration needed - user has no stored auth
	}

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

			// Initialize onboarding ViewModel
			onboardingViewModel = new OnboardingViewModel(apiClient);
			await onboardingViewModel.loadState();

			console.log('[Layout] Onboarding state loaded:', {
				currentStep: onboardingViewModel.currentStep,
				completedSteps: onboardingViewModel.completedSteps,
				isComplete: onboardingViewModel.isComplete
			});

			// Check if we need to redirect to onboarding
			const currentPath = page.url.pathname;
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
