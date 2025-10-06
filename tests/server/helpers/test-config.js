/**
 * Test Configuration Helper
 * @file Provides mock ConfigurationService for tests
 */

/**
 * Create test configuration with defaults
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} Test configuration
 */
export function createTestConfig(overrides = {}) {
	return {
		TERMINAL_KEY: 'test-secret-key',
		PORT: 7173,
		WORKSPACES_ROOT: '/tmp/test-workspaces',
		ENABLE_TUNNEL: false,
		HOME: '/tmp/test-home',
		DEBUG: '',
		...overrides
	};
}

/**
 * Mock ConfigurationService for tests
 */
export class MockConfigurationService {
	#config;

	constructor(config = {}) {
		this.#config = createTestConfig(config);
	}

	get(key) {
		return this.#config[key];
	}

	getAll() {
		return { ...this.#config };
	}

	validate() {
		if (!this.#config.TERMINAL_KEY || this.#config.TERMINAL_KEY === 'change-me') {
			throw new Error('TERMINAL_KEY environment variable required');
		}
	}
}
