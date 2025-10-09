<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '$lib/client/shared/styles/index.css';
	import {
		useServiceContainer,
		provideServiceContainer
	} from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '$lib/client/onboarding/OnboardingViewModel.svelte.js';
	import {
		deriveUIColors,
		deriveRgbVariables,
		validateThemeColors
	} from '$lib/client/shared/utils/color-utils.js';

	let { data, children } = $props();
	let onboardingViewModel = $state(null);

	// Provide service container for dependency injection
	provideServiceContainer();

	// Get service container at component initialization (MUST be at top level)
	const serviceContainer = useServiceContainer();

	/**
	 * Apply theme CSS variables to document root
	 * Applies both terminal theme colors and derived UI colors
	 * @param {Object} theme - Theme object with cssVariables
	 */
	function applyThemeVariables(theme) {
		if (!theme?.cssVariables) return;

		const root = document.documentElement;

		// 1. Apply terminal theme colors (--theme-*)
		Object.entries(theme.cssVariables).forEach(([key, value]) => {
			root.style.setProperty(key, value);
		});

		// 2. Derive and apply UI colors from terminal theme
		// Note: variables.css already derives these via CSS var() with fallbacks,
		// but we also apply them here for immediate effect and to support
		// potential runtime theme switching without page reload
		const uiColors = deriveUIColors(theme.cssVariables);
		Object.entries(uiColors).forEach(([key, value]) => {
			root.style.setProperty(key, value);
		});

		// 3. Extract and apply RGB values for rgba() usage
		const rgbVars = deriveRgbVariables(theme.cssVariables);
		Object.entries(rgbVars).forEach(([key, value]) => {
			root.style.setProperty(key, value);
		});

		// 4. Add theme metadata for debugging (data-theme-id, data-theme-source)
		if (theme.id) {
			root.dataset.themeId = theme.id;
		}
		if (theme.source) {
			root.dataset.themeSource = theme.source;
		}

		// 5. Validate theme has required colors (log warning if missing)
		const validation = validateThemeColors(theme.cssVariables);
		if (!validation.valid) {
			console.warn('[Layout] Theme is missing required colors:', validation.missing);
		}
	}

	/**
	 * Load and apply active theme based on workspace context
	 */
	async function loadAndApplyTheme() {
		if (typeof window === 'undefined') return;

		try {
			// Get current workspace if available (use container from top level)
			let currentWorkspace = null;
			try {
				const workspaceStatePromise = serviceContainer.get('workspaceState');
				const workspaceState = await (typeof workspaceStatePromise?.then === 'function'
					? workspaceStatePromise
					: Promise.resolve(workspaceStatePromise));
				currentWorkspace = workspaceState?.selectedWorkspace;
			} catch (err) {
				// workspaceState may not be registered yet, continue without it
				console.debug('[Layout] WorkspaceState not available yet');
			}

			// Fetch active theme
			const url = new URL('/api/themes/active', window.location.origin);
			if (currentWorkspace) {
				url.searchParams.set('workspaceId', currentWorkspace);
			}

			const response = await fetch(url, {
				credentials: 'include' // Send session cookie
			});

			if (!response.ok) return;

			const { theme } = await response.json();

			// Apply CSS variables to :root
			applyThemeVariables(theme);

			// Store in localStorage for next page load
			localStorage.setItem('dispatch-active-theme', JSON.stringify(theme));
		} catch (error) {
			console.error('[Layout] Failed to load theme:', error);
			// Fallback: use cached theme from localStorage
			const cached = localStorage.getItem('dispatch-active-theme');
			if (cached) {
				try {
					const theme = JSON.parse(cached);
					applyThemeVariables(theme);
				} catch (parseError) {
					console.error('[Layout] Failed to parse cached theme:', parseError);
				}
			}
		}
	}

	onMount(async () => {
		// Apply cached theme immediately for instant visual feedback (no flash)
		if (typeof window !== 'undefined') {
			const cached = localStorage.getItem('dispatch-active-theme');
			if (cached) {
				try {
					const theme = JSON.parse(cached);
					applyThemeVariables(theme);
				} catch (error) {
					console.error('[Layout] Failed to apply cached theme:', error);
				}
			}
		}

		// Then load fresh theme from server
		await loadAndApplyTheme();

		// Set body class based on whether TERMINAL_KEY is configured
		// Authentication is now handled via session cookies server-side
		const hasAuth = data?.hasTerminalKey;

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
			// Use container from top level (already retrieved during component init)
			const apiClientPromise = serviceContainer.get('sessionApi');

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
