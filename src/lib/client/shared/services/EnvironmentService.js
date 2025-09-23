/**
 * EnvironmentService.js
 *
 * Service for fetching environment information from the server,
 * including app version, platform info, etc.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('environment-service');

/**
 * Environment service for fetching server environment information
 */
export class EnvironmentService {
	constructor(config) {
		this.config = config;
		this.cache = null;
		this.lastFetch = null;
		this.cacheTimeout = 30000; // 30 seconds cache
	}

	/**
	 * Get environment information, with caching
	 * @returns {Promise<Object>} Environment information including appVersion
	 */
	async getEnvironment() {
		const now = Date.now();
		
		// Return cached data if it's fresh
		if (this.cache && this.lastFetch && (now - this.lastFetch) < this.cacheTimeout) {
			return this.cache;
		}

		try {
			logger.debug('Fetching environment information from server...');
			const response = await fetch(`${this.config.apiBaseUrl}/api/environment`);
			
			if (!response.ok) {
				throw new Error(`Failed to fetch environment: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			
			// Cache the result
			this.cache = data;
			this.lastFetch = now;
			
			logger.debug('Environment information fetched successfully:', data);
			return data;
		} catch (error) {
			logger.warn('Failed to fetch environment information:', error);
			
			// Return cached data if available, even if stale
			if (this.cache) {
				logger.debug('Returning stale cached environment data');
				return this.cache;
			}
			
			// Return minimal fallback data
			return {
				homeDirectory: 'unknown',
				platform: 'unknown',
				nodeVersion: 'unknown',
				appVersion: 'unknown'
			};
		}
	}

	/**
	 * Get just the app version quickly
	 * @returns {Promise<string>} App version
	 */
	async getAppVersion() {
		try {
			const env = await this.getEnvironment();
			return env.appVersion || 'unknown';
		} catch (error) {
			logger.warn('Failed to get app version:', error);
			return 'unknown';
		}
	}

	/**
	 * Clear the cache to force a fresh fetch next time
	 */
	clearCache() {
		this.cache = null;
		this.lastFetch = null;
	}

	/**
	 * Dispose of the service
	 */
	dispose() {
		this.clearCache();
	}
}