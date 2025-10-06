/**
 * AdapterRegistry - Session adapter registry
 * @file Manages registration and retrieval of session type adapters
 */

export class AdapterRegistry {
	#adapters = new Map();

	/**
	 * No dependencies - adapters registered after construction
	 */
	constructor() {}

	/**
	 * Register adapter for session type
	 * @param {string} kind - Session type (pty, claude, file-editor)
	 * @param {Object} adapter - Adapter instance implementing Adapter interface
	 * @returns {void}
	 */
	register(kind, adapter) {
		if (!kind) {
			throw new Error('Session kind is required');
		}

		if (!adapter) {
			throw new Error('Adapter instance is required');
		}

		// Validate adapter has required methods
		const requiredMethods = ['create', 'attach', 'sendInput', 'close'];
		for (const method of requiredMethods) {
			if (typeof adapter[method] !== 'function') {
				throw new Error(`Adapter for '${kind}' missing required method: ${method}`);
			}
		}

		this.#adapters.set(kind, adapter);
	}

	/**
	 * Get adapter for session type
	 * @param {string} kind - Session type
	 * @returns {Object} Adapter instance
	 * @throws {Error} If adapter not found
	 */
	getAdapter(kind) {
		const adapter = this.#adapters.get(kind);
		if (!adapter) {
			throw new Error(`Adapter not found for session type: ${kind}`);
		}
		return adapter;
	}

	/**
	 * Check if adapter is registered
	 * @param {string} kind - Session type
	 * @returns {boolean} True if adapter is registered
	 */
	hasAdapter(kind) {
		return this.#adapters.has(kind);
	}

	/**
	 * Get all registered adapter kinds
	 * @returns {Array<string>} List of registered session types
	 */
	getRegisteredKinds() {
		return Array.from(this.#adapters.keys());
	}

	/**
	 * Unregister adapter (useful for testing)
	 * @param {string} kind - Session type
	 * @returns {void}
	 */
	unregister(kind) {
		this.#adapters.delete(kind);
	}

	/**
	 * Clear all adapters (useful for testing)
	 * @returns {void}
	 */
	clear() {
		this.#adapters.clear();
	}
}
