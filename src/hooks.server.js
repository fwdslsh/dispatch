import { sequence } from '@sveltejs/kit/hooks';
import { logger } from './lib/server/shared/utils/logger.js';
import { initializeServices } from './lib/server/shared/index.js';

// Use process-level singleton to survive module reloads
const SERVICES_KEY = Symbol.for('dispatch.services');

async function getServices() {
	// Check if services already exist at process level
	if (globalThis[SERVICES_KEY]) {
		return globalThis[SERVICES_KEY];
	}

	try {
		logger.info('HOOKS_SERVER', 'Initializing services...');
		const services = await initializeServices();
		// Store at process level to survive module reloads
		globalThis[SERVICES_KEY] = services;
		logger.info('HOOKS_SERVER', 'Services initialized successfully');
		return services;
	} catch (error) {
		logger.error('HOOKS_SERVER', 'Critical error during service initialization:', error);
		process.exit(1);
	}
}

// Export services for use by other parts of the application (like Socket.IO)
export async function getGlobalServices() {
	return await getServices();
}

export const handle = sequence(async ({ event, resolve }) => {
	// Ensure services are initialized and make them available to request
	event.locals.services = await getServices();

	return resolve(event);
});
