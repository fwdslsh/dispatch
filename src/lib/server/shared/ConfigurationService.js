/**
 * ConfigurationService - Environment variable management
 * @file Centralizes environment variable reading and validation
 */

export class ConfigurationService {
	#config;

	/**
	 * @param {Object} [env=process.env] - Environment variables
	 */
	constructor(env = process.env) {
		this.#config = {
			TERMINAL_KEY: env.TERMINAL_KEY || 'change-me',
			PORT: parseInt(env.PORT) || 3030,
			WORKSPACES_ROOT: env.WORKSPACES_ROOT || '/workspace',
			ENABLE_TUNNEL: env.ENABLE_TUNNEL === 'true',
			LT_SUBDOMAIN: env.LT_SUBDOMAIN,
			HOST_UID: env.HOST_UID ? parseInt(env.HOST_UID) : undefined,
			HOST_GID: env.HOST_GID ? parseInt(env.HOST_GID) : undefined,
			HOME: env.HOME,
			DEBUG: env.DEBUG
		};
	}

	/**
	 * Get configuration value
	 * @param {string} key - Configuration key
	 * @returns {any} Configuration value
	 */
	get(key) {
		return this.#config[key];
	}

	/**
	 * Get all configuration
	 * @returns {Object} All configuration values
	 */
	getAll() {
		return { ...this.#config };
	}

	/**
	 * Validate required configuration
	 * @throws {Error} If required configuration missing
	 * @returns {void}
	 */
	validate() {
		if (!this.#config.TERMINAL_KEY || this.#config.TERMINAL_KEY === 'change-me') {
			throw new Error('TERMINAL_KEY environment variable required in production');
		}
	}
}
