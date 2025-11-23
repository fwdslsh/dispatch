/**
 * AuthViewModel.svelte.js
 *
 * Authentication ViewModel using Svelte 5 runes.
 * Handles authentication business logic for login page.
 *
 * ARCHITECTURE PRINCIPLES:
 * - Pure business logic (no UI concerns)
 * - Manages authentication state and operations
 * - Single responsibility (authentication only)
 * - Provides clean interface for login UI components
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('auth:viewmodel');

/**
 * @typedef {Object} OAuthProviderConfig
 * @property {string} name - Provider identifier (e.g. 'github', 'google')
 * @property {string} displayName - Human-friendly provider name
 * @property {boolean} enabled - Whether provider is enabled in settings
 * @property {boolean} hasClientId - Whether provider has a client ID configured
 * @property {boolean} available - Whether provider can be used for login
 */

/**
 * @typedef {Object} AuthConfig
 * @property {boolean} terminal_key_set - Whether terminal key is configured
 * @property {boolean} oauth_configured - Whether OAuth is configured
 * @property {string} [oauth_client_id] - OAuth client ID
 * @property {string} [oauth_redirect_uri] - OAuth redirect URI
 * @property {OAuthProviderConfig[]} [oauthProviders] - OAuth providers and availability
 */

/**
 * @typedef {Object} LoginResult
 * @property {boolean} success - Whether login was successful
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} InitResult
 * @property {boolean} redirectToWorkspace - Whether to redirect to workspace
 */

export class AuthViewModel {
	// =================================================================
	// REACTIVE STATE
	// =================================================================

	// Form input state
	key = $state('');
	urlInput = $state('');

	// Operation state
	error = $state('');
	loading = $state(false);

	// Configuration state
	/** @type {AuthConfig|null} */
	authConfig = $state(null);
	/** @type {OAuthProviderConfig[]} */
	oauthProviders = $state([]);

	// PWA state
	isPWA = $state(false);
	currentUrl = $state('');

	// Onboarding state
	/** @type {boolean|null} */
	onboardingComplete = $state(null);

	// =================================================================
	// DERIVED STATE
	// =================================================================

	/**
	 * API key authentication is always available (via database-backed API keys)
	 * NOTE: This used to check authConfig.terminal_key_set from TERMINAL_KEY env var,
	 * but that was the legacy single-key auth method. Now API keys are the primary
	 * auth method and are always available via ApiKeyManager.
	 * @type {boolean}
	 */
	hasTerminalKeyAuth = $derived.by(() => {
		// API key authentication is always available
		// The login form should always be visible regardless of TERMINAL_KEY env var
		return true;
	});

	/** @type {boolean} */
	hasOAuthAuth = $derived.by(() => {
		return this.oauthProviders.some((provider) => provider.available);
	});

	/** @type {boolean} */
	hasAnyAuth = $derived.by(() => {
		return this.hasTerminalKeyAuth || this.hasOAuthAuth;
	});

	/** @type {boolean} */
	needsUrlChange = $derived.by(() => {
		return this.isPWA && this.urlInput && this.urlInput !== this.currentUrl;
	});

	// =================================================================
	// INITIALIZATION
	// =================================================================

	/**
	 * Initialize authentication state
	 * - Detect PWA mode
	 * - Load auth configuration
	 * - Check for existing authentication
	 * @returns {Promise<InitResult>}
	 */
	async initialize() {
		log.info('Initializing authentication');

		// Detect PWA mode
		this.isPWA =
			window.matchMedia('(display-mode: standalone)').matches ||
			/** @type {any} */ (window.navigator).standalone === true ||
			document.referrer.includes('android-app://');

		// Initialize URL state
		this.currentUrl = window.location.href;
		this.urlInput = this.currentUrl;

		// Load authentication configuration
		await this.loadAuthConfig();

		// Load onboarding status
		await this.loadSystemStatus();

		// Check if already authenticated
		const isAuthenticated = await this.checkExistingAuth();

		return {
			redirectToWorkspace: isAuthenticated
		};
	}

	/**
	 * Load authentication configuration from server
	 * @private
	 */
	async loadAuthConfig() {
		try {
			const response = await fetch('/api/auth/config');
			if (response.ok) {
				const data = await response.json();
				const { oauth_providers: oauthProvidersFromApi = [], ...rest } = data ?? {};
				const normalizedProviders = Array.isArray(oauthProvidersFromApi)
					? oauthProvidersFromApi
					: [];

				this.authConfig = {
					...rest,
					oauthProviders: normalizedProviders
				};
				this.oauthProviders = normalizedProviders;
				log.info('Auth config loaded', this.authConfig);
			} else {
				log.error('Failed to load auth config', response.status);
			}
		} catch (err) {
			log.error('Failed to load auth config', err);
		}
	}

	/**
	 * Load onboarding completion status
	 * @private
	 */
	async loadSystemStatus() {
		try {
			const response = await fetch('/api/status');
			if (!response.ok) {
				log.warn('Failed to load system status', response.status);
				return;
			}

			const data = await response.json();
			const isComplete = data?.onboarding?.isComplete;
			this.onboardingComplete = typeof isComplete === 'boolean' ? isComplete : false;
			log.info('Onboarding status loaded', { onboardingComplete: this.onboardingComplete });
		} catch (err) {
			log.error('Failed to load system status', err);
		}
	}

	/**
	 * Check if user is already authenticated via session cookie
	 * The server will automatically validate the cookie via hooks.server.js
	 * @returns {Promise<boolean>} True if authenticated
	 */
	async checkExistingAuth() {
		try {
			// Perform a lightweight request to a protected route.
			// If authenticated, it returns 200; otherwise 401.
			const response = await fetch('/api/auth/keys', {
				method: 'GET',
				credentials: 'include'
			});

			if (response.ok) {
				log.info('Already authenticated via session cookie');
				return true;
			}

			if (response.status === 401) {
				log.info('No valid session cookie found');
				return false;
			}

			log.warn('Unexpected response checking auth', response.status);
			return false;
		} catch (err) {
			log.error('Error checking existing auth', err);
			return false;
		}
	}

	// =================================================================
	// AUTHENTICATION OPERATIONS
	// =================================================================

	/**
	 * Login with API key using SvelteKit form action
	 * This will create a session cookie on successful login
	 * @param {string} key - API key
	 * @returns {Promise<LoginResult>}
	 */
	async loginWithKey(key) {
		this.loading = true;
		this.error = '';

		try {
			log.info('Attempting login with API key');

			// Use SvelteKit form action for login
			// This will set the session cookie automatically
			const formData = new FormData();
			formData.append('key', key);

			const response = await fetch('/login', {
				method: 'POST',
				body: formData,
				credentials: 'include', // Include cookies in response
				redirect: 'manual' // Handle redirect manually
			});

			if (response.type === 'opaqueredirect' || response.status === 303) {
				// Successful login - SvelteKit form action redirected
				log.info('Login successful');
				return { success: true };
			} else if (response.ok) {
				// Also consider 200 OK as success (manual handling)
				log.info('Login successful');
				return { success: true };
			} else {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.error || 'Invalid API key';
				this.error = errorMessage;
				log.warn('Login failed', errorMessage);

				return { success: false, error: errorMessage };
			}
		} catch (err) {
			const errorMessage = 'Unable to reach server';
			this.error = errorMessage;
			log.error('Login error', err);

			return { success: false, error: errorMessage };
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Initiate OAuth login flow
	 * Redirects to OAuth provider authorization
	 * @param {string} [provider='github'] - OAuth provider name ('github' or 'google')
	 */
	async loginWithOAuth(provider = 'github') {
		if (!this.authConfig?.oauth_configured) {
			log.warn('OAuth not configured');
			this.error = 'OAuth authentication is not configured';
			return;
		}

		const selectedProvider = this.oauthProviders.find(
			(entry) => entry.name === provider && entry.available
		);

		if (!selectedProvider) {
			log.warn('Requested OAuth provider is not available', { provider });
			this.error = `OAuth provider ${provider} is not available`;
			return;
		}

		try {
			log.info('Initiating OAuth flow', { provider });

			// Request OAuth authorization URL from server
			const response = await fetch('/api/auth/oauth/initiate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ provider })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.message || `OAuth provider ${provider} is not available`;
				this.error = errorMessage;
				log.error('OAuth initiation failed', errorMessage);
				return;
			}

			const data = await response.json();
			if (!data.authUrl) {
				this.error = 'Failed to get OAuth authorization URL';
				log.error('OAuth initiation missing authUrl', data);
				return;
			}

			// Redirect to OAuth provider
			log.info('Redirecting to OAuth authorization', data.authUrl);
			window.location.href = data.authUrl;
		} catch (err) {
			const errorMessage = 'Unable to initiate OAuth login';
			this.error = errorMessage;
			log.error('OAuth initiation error', err);
		}
	}

	// =================================================================
	// PWA URL MANAGEMENT
	// =================================================================

	/**
	 * Update PWA URL (triggers page reload to new URL)
	 * @param {string} newUrl - New URL to navigate to
	 */
	updateUrl(newUrl) {
		if (!this.isPWA) {
			log.warn('updateUrl called but not in PWA mode');
			return;
		}

		log.info('Updating PWA URL', newUrl);
		window.location.href = newUrl;
	}

	// =================================================================
	// HELPER METHODS
	// =================================================================

	/**
	 * Clear error state
	 */
	clearError() {
		this.error = '';
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			loading: this.loading,
			error: this.error,
			isPWA: this.isPWA,
			onboardingComplete: this.onboardingComplete,
			hasTerminalKeyAuth: this.hasTerminalKeyAuth,
			hasOAuthAuth: this.hasOAuthAuth,
			hasAnyAuth: this.hasAnyAuth,
			needsUrlChange: this.needsUrlChange,
			oauthProviders: this.oauthProviders
		};
	}
}
