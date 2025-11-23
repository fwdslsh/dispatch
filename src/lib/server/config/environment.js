/**
 * Environment Configuration
 * Centralized configuration for environment-specific values
 */

/**
 * Get the base URL for the application
 * @returns {string} The base URL
 */
export function getBaseUrl() {
	// Use explicit PUBLIC_BASE_URL if set
	if (process.env.PUBLIC_BASE_URL) {
		return process.env.PUBLIC_BASE_URL;
	}

	// Production: require explicit configuration
	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'PUBLIC_BASE_URL environment variable must be set in production. ' +
				'Example: PUBLIC_BASE_URL=https://dispatch.example.com'
		);
	}

	// Development: use SSL-enabled localhost by default
	const sslEnabled = process.env.SSL_ENABLED !== 'false';
	const port = process.env.PORT || '5173';
	const protocol = sslEnabled ? 'https' : 'http';

	return `${protocol}://localhost:${port}`;
}

/**
 * Application configuration object
 */
export const config = {
	/**
	 * Base URL for the application (used for OAuth redirects, etc.)
	 * @type {string}
	 */
	get baseUrl() {
		return getBaseUrl();
	},

	/**
	 * Server port
	 * @type {number}
	 */
	get port() {
		return parseInt(process.env.PORT || '3030', 10);
	},

	/**
	 * Is development environment
	 * @type {boolean}
	 */
	get isDevelopment() {
		return process.env.NODE_ENV !== 'production';
	},

	/**
	 * Is production environment
	 * @type {boolean}
	 */
	get isProduction() {
		return process.env.NODE_ENV === 'production';
	}
};
