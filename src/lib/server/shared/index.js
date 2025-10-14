/**
 * Shared service initialization
 * REFACTORED: Using simplified architecture with ES6 modules
 */

import { initializeServices, services, resetServices } from './services.js';

// Re-export for convenience
export { initializeServices, services, resetServices };

/**
 * Export global services instance for API routes
 * Provides backward-compatible interface
 */
export const __API_SERVICES = {
	get services() {
		return services;
	},
	getDatabase() {
		return services?.db;
	},
	getRunSessionManager() {
		// Return SessionOrchestrator - same interface for session operations
		return services?.sessionOrchestrator;
	}
};
