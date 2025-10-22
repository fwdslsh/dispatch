/**
 * ThemeService.js
 *
 * API client for theme-related operations.
 * Handles theme CRUD, validation, and assignment operations.
 */

/**
 * @typedef {Object} Theme
 * @property {string} id - Unique theme identifier
 * @property {string} name - Display name
 * @property {string} description - Theme description
 * @property {string} author - Theme author
 * @property {string} version - Semantic version
 * @property {boolean} isBuiltIn - Whether this is a built-in theme
 * @property {boolean} isValid - Whether theme has valid CSS
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} ThemeServiceConfig
 * @property {string} apiBaseUrl - Base URL for API requests
 * @property {string} authTokenKey - Key for auth token in localStorage
 * @property {boolean} debug - Enable debug logging
 */

export class ThemeService {
	/**
	 * @param {ThemeServiceConfig} config
	 */
	constructor(config) {
		this.config = config;
		this.baseUrl = config.apiBaseUrl || '';
	}

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
	 * Handle API response and error cases
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

			const error = /** @type {Error & {status?: number, statusText?: string}} */ (
				new Error(errorMessage)
			);
			error.status = response.status;
			error.statusText = response.statusText;

			throw error;
		}

		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			return response.json();
		}

		return response.text();
	}

	/**
	 * List all available themes
	 * @returns {Promise<{themes: Theme[]}>}
	 */
	async listThemes() {
		try {
			const response = await fetch(`${this.baseUrl}/themes`, {
				headers: this.getHeaders(),
				credentials: 'include'
			});

			const data = await this.handleResponse(response);
			return { themes: data.themes || [] };
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to list themes:', error);
			}
			throw error;
		}
	}

	/**
	 * Get a specific theme by ID
	 * @param {string} themeId - Theme identifier
	 * @returns {Promise<{theme: Theme}>}
	 */
	async getTheme(themeId) {
		try {
			const response = await fetch(`${this.baseUrl}/themes/${encodeURIComponent(themeId)}`, {
				headers: this.getHeaders(),
				credentials: 'include'
			});

			const data = await this.handleResponse(response);
			return { theme: data.theme || data };
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to get theme:', error);
			}
			throw error;
		}
	}

	/**
	 * Upload a new theme
	 * @param {File} file - ZIP file containing theme
	 * @returns {Promise<{success: boolean, themeId: string, warnings: string[], errors: string[]}>}
	 */
	async uploadTheme(file) {
		try {
			const formData = new FormData();
			formData.append('theme', file);

			// Authentication via session cookie (no Authorization header needed)
			const response = await fetch(`${this.baseUrl}/themes`, {
				method: 'POST',
				credentials: 'include',
				body: formData
			});

			const data = await this.handleResponse(response);
			return {
				success: data.success ?? true,
				themeId: data.themeId || data.id,
				warnings: data.warnings || [],
				errors: data.errors || []
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to upload theme:', error);
			}
			throw error;
		}
	}

	/**
	 * Delete a theme
	 * @param {string} themeId - Theme identifier
	 * @returns {Promise<{success: boolean, error?: string}>}
	 */
	async deleteTheme(themeId) {
		try {
			const response = await fetch(`${this.baseUrl}/themes/${encodeURIComponent(themeId)}`, {
				method: 'DELETE',
				headers: this.getHeaders(),
				credentials: 'include'
			});

			const data = await this.handleResponse(response);
			return {
				success: data.success ?? true,
				error: data.error
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to delete theme:', error);
			}
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Check if a theme can be deleted
	 * @param {string} themeId - Theme identifier
	 * @returns {Promise<{canDelete: boolean, reason?: string, workspaces?: string[]}>}
	 */
	async canDeleteTheme(themeId) {
		try {
			const response = await fetch(
				`${this.baseUrl}/themes/${encodeURIComponent(themeId)}/can-delete`,
				{
					headers: this.getHeaders(),
					credentials: 'include'
				}
			);

			const data = await this.handleResponse(response);
			return {
				canDelete: data.canDelete ?? false,
				reason: data.reason,
				workspaces: data.workspaces || []
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to check if theme can be deleted:', error);
			}
			return {
				canDelete: false,
				reason: error.message,
				workspaces: []
			};
		}
	}

	/**
	 * Get the active theme for a workspace or global default
	 * @param {string|null} workspaceId - Workspace ID (null for global default)
	 * @returns {Promise<{theme: Theme}>}
	 */
	async getActiveTheme(workspaceId = null) {
		try {
			const params = new URLSearchParams();
			if (workspaceId) {
				params.append('workspaceId', workspaceId);
			}

			const url = `${this.baseUrl}/themes/active${params.toString() ? '?' + params : ''}`;
			const response = await fetch(url, {
				headers: this.getHeaders(),
				credentials: 'include'
			});

			const data = await this.handleResponse(response);
			return { theme: data.theme || data };
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to get active theme:', error);
			}
			throw error;
		}
	}

	/**
	 * Set the global default theme
	 * Updates user preferences to set global default
	 * @param {string} themeId - Theme identifier
	 * @returns {Promise<{success: boolean, category: string, preferences: object}>}
	 */
	async setGlobalDefault(themeId) {
		try {
			const response = await fetch(`${this.baseUrl}/api/preferences`, {
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

			return await this.handleResponse(response);
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to set global default theme:', error);
			}
			throw error;
		}
	}

	/**
	 * Get theme preferences (global default, etc.)
	 * @returns {Promise<{globalDefault: string}>}
	 */
	async getThemePreferences() {
		try {
			const params = new URLSearchParams();
			params.append('category', 'themes');

			const response = await fetch(`${this.baseUrl}/api/preferences?${params}`, {
				headers: this.getHeaders(),
				credentials: 'include'
			});

			const data = await this.handleResponse(response);
			return {
				globalDefault: data.globalDefault || 'retro'
			};
		} catch (error) {
			if (this.config.debug) {
				console.error('[ThemeService] Failed to get theme preferences:', error);
			}
			// Return default on error
			return {
				globalDefault: 'retro'
			};
		}
	}

	/**
	 * Validate theme file before upload
	 * @param {File} file - ZIP file to validate
	 * @returns {Promise<{valid: boolean, errors: string[]}>}
	 */
	async validateThemeFile(file) {
		// Client-side basic validation
		const errors = [];

		// Check file type
		if (!file.name.endsWith('.zip')) {
			errors.push('Theme must be a ZIP file');
		}

		// Check file size (max 10MB)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			errors.push(`Theme file too large (max ${maxSize / (1024 * 1024)}MB)`);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Dispose of resources (for cleanup)
	 */
	dispose() {
		// No resources to clean up in this implementation
		// But keeping the method for interface consistency
	}
}
