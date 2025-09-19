import { sequence } from '@sveltejs/kit/hooks';
import { logger } from './lib/server/utils/logger.js';
import { getGlobalServices } from './lib/server/services/shared.js';

// Initialize services immediately
getGlobalServices().catch((error) => {
	logger.error('HOOKS_SERVER', 'Critical error during service initialization:', error);
	process.exit(1);
});

export const handle = sequence(async ({ event, resolve }) => {
	// Ensure services are initialized and make them available to request
	event.locals.services = await getGlobalServices();

	return resolve(event);
});
