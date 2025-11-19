/**
 * AuthenticationCoordinator.js
 *
 * Coordinates multiple authentication strategies using Chain of Responsibility pattern.
 * Tries each strategy in order until one succeeds or all fail.
 *
 * Benefits:
 * - Single entry point for authentication
 * - Strategies are tried in configured order
 * - Easy to add/remove/reorder strategies
 * - Testable: Can test coordinator with mock strategies
 */

import { logger } from '../../shared/utils/logger.js';

export class AuthenticationCoordinator {
	/**
	 * @param {import('./AuthStrategy.js').AuthStrategy[]} strategies - Ordered list of auth strategies to try
	 */
	constructor(strategies) {
		if (!Array.isArray(strategies) || strategies.length === 0) {
			throw new Error('AuthenticationCoordinator requires at least one strategy');
		}
		this.strategies = strategies;
	}

	/**
	 * Attempt authentication using all configured strategies
	 * Tries each strategy in order until one succeeds
	 *
	 * @param {Object} event - SvelteKit request event
	 * @param {Object} services - Service container
	 * @returns {Promise<import('./AuthStrategy.js').AuthResult>} Authentication result
	 */
	async authenticate(event, services) {
		const { pathname } = event.url;

		for (const strategy of this.strategies) {
			try {
				const result = await strategy.authenticate(event, services);
				if (result) {
					// Authentication succeeded
					logger.debug(
						'AUTH',
						`Successfully authenticated ${pathname} using ${strategy.name} strategy`
					);
					return result;
				}
			} catch (err) {
				// Strategy threw an error - log and continue to next strategy
				logger.error(
					'AUTH',
					`${strategy.name} strategy threw error for ${pathname}:`,
					err
				);
				// Continue to next strategy
			}
		}

		// All strategies failed
		logger.debug('AUTH', `All authentication strategies failed for ${pathname}`);
		return { authenticated: false };
	}

	/**
	 * Get list of strategy names for debugging
	 * @returns {string[]}
	 */
	getStrategyNames() {
		return this.strategies.map((s) => s.name);
	}
}
