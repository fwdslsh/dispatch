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
 * @typedef {Object} AuthConfig
 * @property {boolean} terminal_key_set - Whether terminal key is configured
 * @property {boolean} oauth_configured - Whether OAuth is configured
 * @property {string} [oauth_client_id] - OAuth client ID
 * @property {string} [oauth_redirect_uri] - OAuth redirect URI
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

	// PWA state
	isPWA = $state(false);
	currentUrl = $state('');

	// =================================================================
	// DERIVED STATE
	// =================================================================

	/** @type {boolean} */
	hasTerminalKeyAuth = $derived.by(() => {
		return this.authConfig?.terminal_key_set ?? false;
	});

	/** @type {boolean} */
	hasOAuthAuth = $derived.by(() => {
		return this.authConfig?.oauth_configured ?? false;
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
				this.authConfig = await response.json();
				log.info('Auth config loaded', this.authConfig);
			} else {
				log.error('Failed to load auth config', response.status);
			}
		} catch (err) {
			log.error('Failed to load auth config', err);
		}
	}

	/**
	 * Check if user is already authenticated via stored key
	 * @private
	 * @returns {Promise<boolean>} True if authenticated
	 */
	async checkExistingAuth() {
		const storedKey = localStorage.getItem('dispatch-auth-token');
		if (!storedKey) {
			return false;
		}

		try {
			const response = await fetch('/api/auth/check', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${storedKey}`
				},
				body: JSON.stringify({ key: storedKey })
			});

			if (response.ok) {
				log.info('Already authenticated via stored key');
				return true;
			} else {
				// Invalid stored key, remove it
				localStorage.removeItem('dispatch-auth-token');
				log.warn('Stored key is invalid, removed from localStorage');
				return false;
			}
		} catch (err) {
			log.error('Error checking existing auth', err);
			return false;
		}
	}

	// =================================================================
	// AUTHENTICATION OPERATIONS
	// =================================================================

	/**
	 * Login with terminal key
	 * @param {string} key - Terminal key
	 * @returns {Promise<LoginResult>}
	 */
	async loginWithKey(key) {
		this.loading = true;
		this.error = '';

		try {
			log.info('Attempting login with terminal key');

			const response = await fetch('/api/auth/check', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${key}`
				},
				body: JSON.stringify({ key })
			});

			if (response.ok) {
				// Store key for future requests
				localStorage.setItem('dispatch-auth-token', key);
				log.info('Login successful');

				return { success: true };
			} else {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.error || 'Invalid key';
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
	 * Redirects to GitHub OAuth authorization
	 */
	loginWithOAuth() {
		if (!this.authConfig?.oauth_configured) {
			log.warn('OAuth not configured');
			return;
		}

		const redirectUri = this.authConfig.oauth_redirect_uri;
		const clientId = this.authConfig.oauth_client_id;

		// Build GitHub OAuth authorization URL
		const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;

		log.info('Redirecting to OAuth authorization', authUrl);
		window.location.href = authUrl;
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
			hasTerminalKeyAuth: this.hasTerminalKeyAuth,
			hasOAuthAuth: this.hasOAuthAuth,
			hasAnyAuth: this.hasAnyAuth,
			needsUrlChange: this.needsUrlChange
		};
	}
}
