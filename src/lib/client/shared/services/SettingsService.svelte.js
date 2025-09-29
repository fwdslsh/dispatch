/**
 * Simple SettingsService - Clean API service for settings management
 * Focused on HTTP communication without overengineered reactive patterns
 */

/**
 * Simple SettingsService class for API communication
 */
export class SettingsService {
	/**
	 * Create SettingsService instance
	 * @param {string} authKey - Authentication key for API requests
	 * @param {string} baseUrl - Base URL for API endpoints (default: current origin)
	 */
	constructor(authKey = '', baseUrl = '') {
		this.authKey = authKey;
		this.baseUrl = baseUrl;
	}

	/**
	 * Make authenticated API request
	 * @param {string} url - API endpoint URL
	 * @param {Object} options - Fetch options
	 * @returns {Promise<Object>} Response data
	 */
	async makeRequest(url, options = {}) {
		const defaultOptions = {
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		};

		const finalOptions = { ...defaultOptions, ...options };
		const response = await fetch(`${this.baseUrl}${url}`, finalOptions);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Get all settings, optionally filtered by category
	 * @param {string|null} categoryId - Optional category filter
	 * @returns {Promise<Object>} Settings data with categories and settings arrays
	 */
	async getAllSettings(categoryId = null) {
		const params = new URLSearchParams({ authKey: this.authKey });
		if (categoryId) {
			params.append('category', categoryId);
		}

		return await this.makeRequest(`/api/settings?${params}`);
	}

	/**
	 * Update settings in a category
	 * @param {string} categoryId - Category ID
	 * @param {Object} settings - Settings key-value pairs to update
	 * @returns {Promise<Object>} Update result
	 */
	async updateCategorySettings(categoryId, settings) {
		return await this.makeRequest(`/api/settings/${categoryId}`, {
			method: 'PUT',
			body: JSON.stringify({
				authKey: this.authKey,
				settings
			})
		});
	}

	/**
	 * Get authentication configuration status
	 * @returns {Promise<Object>} Authentication configuration
	 */
	async getAuthConfig() {
		const params = new URLSearchParams({ authKey: this.authKey });
		return await this.makeRequest(`/api/auth/config?${params}`);
	}

	/**
	 * Update authentication configuration
	 * @param {Object} authSettings - Authentication settings to update
	 * @returns {Promise<Object>} Update result
	 */
	async updateAuthConfig(authSettings) {
		return await this.makeRequest('/api/auth/config', {
			method: 'PUT',
			body: JSON.stringify({
				authKey: this.authKey,
				...authSettings
			})
		});
	}

	/**
	 * Check if the service is properly configured
	 * @returns {boolean} Whether service has auth key
	 */
	isConfigured() {
		return Boolean(this.authKey);
	}
}
