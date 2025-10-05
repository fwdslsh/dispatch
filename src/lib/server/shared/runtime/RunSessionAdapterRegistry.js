import { logger } from '../utils/logger.js';

/**
 * @typedef {Object} RunSessionAdapter
 * @property {(options: Record<string, any>) => Promise<any>} create
 * @property {(data: string) => void} [input]
 * @property {(cols: number, rows: number) => Promise<void>} [resize]
 * @property {() => void} [close]
 */

/**
 * Registry for RunSession adapters keyed by session kind.
 */
export class RunSessionAdapterRegistry {
	constructor() {
		/** @type {Map<string, RunSessionAdapter>} */
		this.adapters = new Map();
	}

	/**
	 * Register an adapter implementation for a session kind.
	 * @param {string} kind
	 * @param {RunSessionAdapter} adapter
	 */
	register(kind, adapter) {
		if (!kind) {
			throw new Error('Adapter kind is required');
		}

		if (!adapter) {
			throw new Error(`Adapter implementation required for kind: ${kind}`);
		}

		if (this.adapters.has(kind)) {
			logger.warn('ADAPTER_REGISTRY', `Adapter for kind ${kind} will be replaced`);
		}

		this.adapters.set(kind, adapter);
		logger.info('ADAPTER_REGISTRY', `Registered adapter for kind: ${kind}`);
	}

	/**
	 * Retrieve an adapter implementation for a kind.
	 * @param {string} kind
	 * @returns {RunSessionAdapter|null}
	 */
	get(kind) {
		return this.adapters.get(kind) || null;
	}

	/**
	 * Determine whether a kind is registered.
	 * @param {string} kind
	 * @returns {boolean}
	 */
	has(kind) {
		return this.adapters.has(kind);
	}

	/**
	 * List all registered kinds.
	 * @returns {string[]}
	 */
	listKinds() {
		return Array.from(this.adapters.keys());
	}

	/**
	 * Clear the registry of all adapters.
	 */
	clear() {
		this.adapters.clear();
	}
}
