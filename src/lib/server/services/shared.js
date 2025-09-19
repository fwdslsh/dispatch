/**
 * Shared services module for consistent service instances across hooks.server.js and vite.config.js
 */

import { logger } from '../utils/logger.js';
import { initializeServices } from './index.js';

// Global services instance
let globalServices = null;

/**
 * Get the global services instance, creating it if it doesn't exist
 * @returns {Promise<object>} Services object
 */
export async function getGlobalServices() {
	if (globalServices) return globalServices;

	try {
		globalServices = await initializeServices();
		return globalServices;
	} catch (error) {
		logger.error('SHARED_SERVICES', 'Failed to initialize server services:', error);
		throw error;
	}
}

/**
 * Reset the global services (for testing purposes)
 */
export function resetGlobalServices() {
	globalServices = null;
}