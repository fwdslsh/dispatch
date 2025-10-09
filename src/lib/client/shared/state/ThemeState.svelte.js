/**
 * ThemeState.svelte.js
 *
 * Theme management ViewModel using Svelte 5 runes.
 * Single responsibility: managing theme data, selection, and activation.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('theme-state');

/**
 * @typedef {Object} Theme
 * @property {string} id - Theme identifier (filename without extension)
 * @property {string} name - Display name
 * @property {string} source - Source type: 'preset' or 'custom'
 * @property {Object} cssVariables - CSS custom properties
 * @property {string} [description] - Optional theme description
 * @property {Object} [_validation] - Validation result with warnings
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Overall validation status
 * @property {string[]} errors - Blocking errors
 * @property {string[]} warnings - Non-blocking warnings
 */

export class ThemeState {
	/**
	 * @param {Object} config - Configuration object
	 * @param {string} config.apiBaseUrl - Base URL for API requests
	 * @param {string} config.authTokenKey - Key for auth token in localStorage
	 */
	constructor(config = {}) {
		this.config = config;
		this.baseUrl = config.apiBaseUrl || '';
		this.authTokenKey = 'dispatch-auth-token';

		// Core theme data
		this.themes = $state([]);
		this.activeThemeId = $state(null);
		this.loading = $state(false);
		this.error = $state(null);

		// Operation states
		this.uploading = $state(false);
		this.activating = $state(false);
		this.deleting = $state(false);

		// Derived state - filter preset themes
		this.presetThemes = $derived.by(() => this.themes.filter((t) => t.source === 'preset'));

		// Derived state - filter custom themes
		this.customThemes = $derived.by(() => this.themes.filter((t) => t.source === 'custom'));

		// Derived state - find active theme
		this.activeTheme = $derived.by(
			() => this.themes.find((t) => t.id === this.activeThemeId) || null
		);

		// Derived state - check if there are any themes
		this.hasThemes = $derived(this.themes.length > 0);
	}

	// =================================================================
	// API HELPERS
	// =================================================================

	/**
	 * Get headers for API requests
	 * Authentication via session cookies (no Authorization header needed)
	 * @returns {Object} Headers object
	 */
	getHeaders() {
		return {
			'Content-Type': 'application/json'
		};
	}

	/**
	 * Handle API response
	 * @param {Response} response
	 * @returns {Promise<any>}
	 */
	async handleResponse(response) {
		if (!response.ok) {
			const errorBody = await response.text();
			let errorMessage;

			try {
				const errorData = JSON.parse(errorBody);
				errorMessage = errorData.error || errorData.message || response.statusText;
			} catch {
				errorMessage = errorBody || response.statusText;
			}

			throw new Error(errorMessage);
		}

		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			return response.json();
		}

		return response.text();
	}

	// =================================================================
	// THEME LOADING
	// =================================================================

	/**
	 * Load all available themes from API
	 * @returns {Promise<void>}
	 */
	async loadThemes() {
		this.loading = true;
		this.error = null;

		try {
			// Authentication via session cookie (server validates)
			const url = `${this.baseUrl}/api/themes`;
			const response = await fetch(url, {
				method: 'GET',
				headers: this.getHeaders(),
				credentials: 'include'
			});
			const data = await this.handleResponse(response);

			this.themes = data.themes || [];
			log.info('Themes loaded successfully', { count: this.themes.length });
		} catch (err) {
			this.error = err.message || 'Failed to load themes';
			log.error('Failed to load themes', err);
			throw err;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load active theme for workspace or global
	 * @param {string} [workspaceId] - Optional workspace ID for workspace-specific theme
	 * @returns {Promise<Theme>}
	 */
	async loadActiveTheme(workspaceId = null) {
		this.loading = true;
		this.error = null;

		try {
			// Authentication via session cookie (server validates)
			const params = new URLSearchParams();
			if (workspaceId) {
				params.append('workspaceId', workspaceId);
			}

			const url = `${this.baseUrl}/api/themes/active${params.toString() ? '?' + params.toString() : ''}`;
			const response = await fetch(url, {
				method: 'GET',
				headers: this.getHeaders(),
				credentials: 'include'
			});
			const data = await this.handleResponse(response);

			this.activeThemeId = data.id;
			log.info('Active theme loaded', { themeId: data.id, source: data.source });

			return data;
		} catch (err) {
			this.error = err.message || 'Failed to load active theme';
			log.error('Failed to load active theme', err);
			throw err;
		} finally {
			this.loading = false;
		}
	}

	// =================================================================
	// THEME UPLOAD
	// =================================================================

	/**
	 * Upload a custom theme file
	 * @param {File} file - Theme file to upload
	 * @returns {Promise<{theme: Theme, validation: ValidationResult}>}
	 */
	async uploadTheme(file) {
		this.uploading = true;
		this.error = null;

		try {
			// Authentication via session cookie (server validates)

			// Validate file size (5MB limit)
			const MAX_SIZE = 5 * 1024 * 1024; // 5MB
			if (file.size > MAX_SIZE) {
				throw new Error('Theme file too large (max 5MB)');
			}

			// Create FormData for file upload
			const formData = new FormData();
			formData.append('theme', file);

			const url = `${this.baseUrl}/api/themes`;
			const response = await fetch(url, {
				method: 'POST',
				credentials: 'include',
				body: formData
			});

			const result = await this.handleResponse(response);

			// Reload themes to include newly uploaded theme
			await this.loadThemes();

			log.info('Theme uploaded successfully', {
				themeId: result.theme.id,
				warnings: result.validation?.warnings?.length || 0
			});

			return result;
		} catch (err) {
			this.error = err.message || 'Failed to upload theme';
			log.error('Failed to upload theme', err);
			throw err;
		} finally {
			this.uploading = false;
		}
	}

	// =================================================================
	// THEME ACTIVATION
	// =================================================================

	/**
	 * Activate a theme as global default
	 * @param {string} themeId - Theme ID to activate
	 * @returns {Promise<void>}
	 */
	async activateTheme(themeId) {
		this.activating = true;
		this.error = null;

		try {
			// Authentication via session cookie (server validates)

			// Update global theme preference
			const url = `${this.baseUrl}/api/preferences`;
			const response = await fetch(url, {
				method: 'PUT',
				headers: this.getHeaders(),
				credentials: 'include',
				body: JSON.stringify({
					category: 'themes',
					preferences: {
						globalDefault: themeId
					}
				})
			});

			await this.handleResponse(response);

			this.activeThemeId = themeId;
			log.info('Theme activated successfully', { themeId });

			// Trigger page reload to apply theme (FR-011)
			if (typeof window !== 'undefined') {
				window.location.reload();
			}
		} catch (err) {
			this.error = err.message || 'Failed to activate theme';
			log.error('Failed to activate theme', err);
			throw err;
		} finally {
			this.activating = false;
		}
	}

	/**
	 * Set workspace-specific theme override
	 * @param {string} workspaceId - Workspace ID
	 * @param {string} themeId - Theme ID to set as override
	 * @returns {Promise<void>}
	 */
	async setWorkspaceTheme(workspaceId, themeId) {
		this.activating = true;
		this.error = null;

		try {
			// Authentication via session cookie (server validates)

			const url = `${this.baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}`;
			const response = await fetch(url, {
				method: 'PUT',
				headers: this.getHeaders(),
				credentials: 'include',
				body: JSON.stringify({
					theme_override: themeId
				})
			});

			await this.handleResponse(response);

			log.info('Workspace theme set successfully', { workspaceId, themeId });

			// Trigger page reload to apply theme (FR-011)
			if (typeof window !== 'undefined') {
				window.location.reload();
			}
		} catch (err) {
			this.error = err.message || 'Failed to set workspace theme';
			log.error('Failed to set workspace theme', err);
			throw err;
		} finally {
			this.activating = false;
		}
	}

	/**
	 * Clear workspace theme override (revert to global default)
	 * @param {string} workspaceId - Workspace ID
	 * @returns {Promise<void>}
	 */
	async clearWorkspaceTheme(workspaceId) {
		return this.setWorkspaceTheme(workspaceId, null);
	}

	// =================================================================
	// THEME DELETION
	// =================================================================

	/**
	 * Check if a theme can be deleted
	 * @param {string} themeId - Theme ID to check
	 * @returns {Promise<{canDelete: boolean, reason?: string}>}
	 */
	async canDeleteTheme(themeId) {
		try {
			// Authentication via session cookie (server validates)
			const url = `${this.baseUrl}/api/themes/${encodeURIComponent(themeId)}/can-delete`;
			const response = await fetch(url, {
				method: 'GET',
				headers: this.getHeaders(),
				credentials: 'include'
			});
			return await this.handleResponse(response);
		} catch (err) {
			log.error('Failed to check theme deletion status', err);
			throw err;
		}
	}

	/**
	 * Delete a custom theme
	 * @param {string} themeId - Theme ID to delete
	 * @returns {Promise<void>}
	 */
	async deleteTheme(themeId) {
		this.deleting = true;
		this.error = null;

		try {
			// Authentication via session cookie (server validates)

			// Check if theme can be deleted
			const canDelete = await this.canDeleteTheme(themeId);
			if (!canDelete.canDelete) {
				throw new Error(canDelete.reason || 'Theme cannot be deleted');
			}

			const url = `${this.baseUrl}/api/themes/${encodeURIComponent(themeId)}`;
			const response = await fetch(url, {
				method: 'DELETE',
				headers: this.getHeaders(),
				credentials: 'include'
			});

			await this.handleResponse(response);

			// Remove theme from state
			this.themes = this.themes.filter((t) => t.id !== themeId);

			log.info('Theme deleted successfully', { themeId });
		} catch (err) {
			this.error = err.message || 'Failed to delete theme';
			log.error('Failed to delete theme', err);
			throw err;
		} finally {
			this.deleting = false;
		}
	}

	// =================================================================
	// QUERY METHODS
	// =================================================================

	/**
	 * Get theme by ID
	 * @param {string} themeId - Theme ID
	 * @returns {Theme|null}
	 */
	getTheme(themeId) {
		return this.themes.find((t) => t.id === themeId) || null;
	}

	/**
	 * Check if a theme is a preset theme
	 * @param {string} themeId - Theme ID
	 * @returns {boolean}
	 */
	isPresetTheme(themeId) {
		const theme = this.getTheme(themeId);
		return theme?.source === 'preset';
	}

	/**
	 * Check if a theme is currently active
	 * @param {string} themeId - Theme ID
	 * @returns {boolean}
	 */
	isActiveTheme(themeId) {
		return this.activeThemeId === themeId;
	}

	// =================================================================
	// ERROR HANDLING
	// =================================================================

	/**
	 * Clear current error state
	 */
	clearError() {
		this.error = null;
	}

	/**
	 * Get current error state
	 * @returns {string|null}
	 */
	getCurrentError() {
		return this.error;
	}

	// =================================================================
	// LIFECYCLE AND CLEANUP
	// =================================================================

	/**
	 * Reset all state
	 */
	reset() {
		this.themes = [];
		this.activeThemeId = null;
		this.loading = false;
		this.error = null;
		this.uploading = false;
		this.activating = false;
		this.deleting = false;
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			themesCount: this.themes.length,
			presetCount: this.presetThemes.length,
			customCount: this.customThemes.length,
			activeThemeId: this.activeThemeId,
			loading: this.loading,
			uploading: this.uploading,
			activating: this.activating,
			deleting: this.deleting,
			error: this.error
		};
	}
}
