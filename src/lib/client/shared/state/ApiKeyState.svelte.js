/**
 * ApiKeyState.svelte.js
 *
 * API Key Management ViewModel using Svelte 5 runes.
 * Handles CRUD operations for API keys.
 *
 * ARCHITECTURE PRINCIPLES:
 * - Pure business logic (no UI concerns)
 * - Manages API key state and operations
 * - Single responsibility (API key management only)
 * - Provides clean interface for settings UI components
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('apikey:state');

/**
 * @typedef {Object} ApiKey
 * @property {string} id - API key ID (UUID)
 * @property {string} label - User-friendly label
 * @property {number} created_at - Creation timestamp (ms)
 * @property {number|null} last_used_at - Last usage timestamp (ms, nullable)
 * @property {number} disabled - Disabled flag (0=active, 1=disabled)
 */

/**
 * @typedef {Object} CreateKeyResult
 * @property {string} id - API key ID
 * @property {string} key - Plaintext API key (shown ONCE)
 * @property {string} label - User-friendly label
 * @property {string} message - Warning message
 */

export class ApiKeyState {
	// =================================================================
	// REACTIVE STATE
	// =================================================================

	/** @type {ApiKey[]} */
	keys = $state([]);

	loading = $state(false);
	error = $state('');

	// =================================================================
	// DERIVED STATE
	// =================================================================

	/** @type {ApiKey[]} */
	activeKeys = $derived.by(() => {
		return this.keys.filter((k) => k.disabled === 0);
	});

	/** @type {ApiKey[]} */
	disabledKeys = $derived.by(() => {
		return this.keys.filter((k) => k.disabled === 1);
	});

	/** @type {number} */
	activeCount = $derived.by(() => {
		return this.activeKeys.length;
	});

	// =================================================================
	// INITIALIZATION
	// =================================================================

	/**
	 * Initialize by loading existing API keys
	 * @returns {Promise<void>}
	 */
	async initialize() {
		log.info('Initializing API key state');
		await this.loadKeys();
	}

	// =================================================================
	// API KEY OPERATIONS
	// =================================================================

	/**
	 * Load all API keys from server
	 * @returns {Promise<void>}
	 */
	async loadKeys() {
		this.loading = true;
		this.error = '';

		try {
			log.info('Loading API keys');

			const response = await fetch('/api/auth/keys', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include' // Include session cookie
			});

			if (response.ok) {
				const data = await response.json();
				this.keys = data.keys || [];
				log.info(`Loaded ${this.keys.length} API keys`);
			} else {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.error || 'Failed to load API keys';
				this.error = errorMessage;
				log.error('Failed to load API keys', errorMessage);
			}
		} catch (err) {
			const errorMessage = 'Unable to reach server';
			this.error = errorMessage;
			log.error('Load keys error', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Create a new API key
	 * @param {string} label - User-friendly label for the key
	 * @returns {Promise<CreateKeyResult|null>} Result with plaintext key (shown ONCE) or null on error
	 */
	async createKey(label) {
		this.loading = true;
		this.error = '';

		try {
			log.info('Creating new API key', { label });

			const response = await fetch('/api/auth/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include', // Include session cookie
				body: JSON.stringify({ label })
			});

			if (response.ok) {
				const data = await response.json();
				log.info('API key created successfully', { id: data.id });

				// Reload keys to get updated list (without plaintext key)
				await this.loadKeys();

				return {
					id: data.id,
					key: data.key,
					label: data.label,
					message: data.message
				};
			} else {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.error || 'Failed to create API key';
				this.error = errorMessage;
				log.error('Failed to create API key', errorMessage);

				return null;
			}
		} catch (err) {
			const errorMessage = 'Unable to reach server';
			this.error = errorMessage;
			log.error('Create key error', err);

			return null;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Delete an API key permanently
	 * @param {string} keyId - API key ID to delete
	 * @returns {Promise<boolean>} True if deleted successfully
	 */
	async deleteKey(keyId) {
		this.loading = true;
		this.error = '';

		try {
			log.info('Deleting API key', { keyId });

			const response = await fetch(`/api/auth/keys/${keyId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include' // Include session cookie
			});

			if (response.ok) {
				log.info('API key deleted successfully', { keyId });

				// Reload keys to get updated list
				await this.loadKeys();

				return true;
			} else {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.error || 'Failed to delete API key';
				this.error = errorMessage;
				log.error('Failed to delete API key', errorMessage);

				return false;
			}
		} catch (err) {
			const errorMessage = 'Unable to reach server';
			this.error = errorMessage;
			log.error('Delete key error', err);

			return false;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Toggle API key enabled/disabled status
	 * @param {string} keyId - API key ID to toggle
	 * @param {boolean} disabled - New disabled state (true=disabled, false=enabled)
	 * @returns {Promise<boolean>} True if toggled successfully
	 */
	async toggleKey(keyId, disabled) {
		this.loading = true;
		this.error = '';

		try {
			log.info('Toggling API key', { keyId, disabled });

			const response = await fetch(`/api/auth/keys/${keyId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include', // Include session cookie
				body: JSON.stringify({ disabled })
			});

			if (response.ok) {
				log.info('API key toggled successfully', { keyId, disabled });

				// Reload keys to get updated list
				await this.loadKeys();

				return true;
			} else {
				const data = await response.json().catch(() => ({}));
				const errorMessage = data?.error || 'Failed to toggle API key';
				this.error = errorMessage;
				log.error('Failed to toggle API key', errorMessage);

				return false;
			}
		} catch (err) {
			const errorMessage = 'Unable to reach server';
			this.error = errorMessage;
			log.error('Toggle key error', err);

			return false;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Enable a disabled API key
	 * @param {string} keyId - API key ID to enable
	 * @returns {Promise<boolean>} True if enabled successfully
	 */
	async enableKey(keyId) {
		return this.toggleKey(keyId, false);
	}

	/**
	 * Disable an active API key
	 * @param {string} keyId - API key ID to disable
	 * @returns {Promise<boolean>} True if disabled successfully
	 */
	async disableKey(keyId) {
		return this.toggleKey(keyId, true);
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
	 * Get API key by ID
	 * @param {string} keyId - API key ID
	 * @returns {ApiKey|undefined} API key object or undefined if not found
	 */
	getKeyById(keyId) {
		return this.keys.find((k) => k.id === keyId);
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			keysCount: this.keys.length,
			activeCount: this.activeCount,
			disabledCount: this.disabledKeys.length,
			loading: this.loading,
			error: this.error
		};
	}
}
