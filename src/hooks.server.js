import { sequence } from '@sveltejs/kit/hooks';
import { getServerServiceContainer } from './lib/server/core/ServerServiceContainer.js';
import { logger } from './lib/server/utils/logger.js';

// Initialize server services using dependency injection container
let serverContainer = null;

async function initializeServerServices() {
	if (serverContainer) return serverContainer;

	try {
		// Create service container with configuration
		serverContainer = getServerServiceContainer({
			dbPath: process.env.DB_PATH || '~/.dispatch/data/workspace.db',
			workspacesRoot: process.env.WORKSPACES_ROOT || '~/.dispatch-home/workspaces',
			configDir: process.env.DISPATCH_CONFIG_DIR || '~/.config/dispatch',
			debug: process.env.DEBUG === 'true'
		});

		// Initialize all services
		await serverContainer.initialize();

		logger.info('HOOKS_SERVER', 'Server services initialized successfully');
		return serverContainer;

	} catch (error) {
		logger.error('HOOKS_SERVER', 'Failed to initialize server services:', error);
		throw error;
	}
}

// Initialize services immediately
initializeServerServices().catch((error) => {
	logger.error('HOOKS_SERVER', 'Critical error during service initialization:', error);
	process.exit(1);
});

export const handle = sequence(async ({ event, resolve }) => {
	// Ensure services are initialized
	const container = await initializeServerServices();

	// Make services available to API endpoints via dependency injection
	event.locals.database = container.get('database');
	event.locals.workspaceManager = container.get('workspaceManager');
	event.locals.sessionRegistry = container.get('sessionRegistry');
	event.locals.terminalManager = container.get('terminalManager');
	event.locals.claudeSessionManager = container.get('claudeSessionManager');
	event.locals.claudeAuthManager = container.get('claudeAuthManager');
	event.locals.messageBuffer = container.get('messageBuffer');

	// Provide easy access to the container itself for services that need multiple dependencies
	event.locals.serviceContainer = container;

	return resolve(event);
});
