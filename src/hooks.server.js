import { sequence } from '@sveltejs/kit/hooks';
import { json } from '@sveltejs/kit';
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

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
	'/auth/callback',
	'/api/auth/callback',
	'/api/auth/config',
	'/api/status',
	'/api/settings/onboarding',
	'/api/environment'
];

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname) {
	return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Authentication middleware
 * Validates requests using multi-strategy auth (terminal key or OAuth session)
 */
async function authenticationMiddleware({ event, resolve }) {
	const { pathname } = event.url;

	// Skip auth for public routes
	if (isPublicRoute(pathname)) {
		logger.debug('AUTH', `Skipping auth for public route: ${pathname}`);
		return resolve(event);
	}

	// Only enforce auth on API routes
	if (!pathname.startsWith('/api/')) {
		return resolve(event);
	}

	// Extract auth token from request
	const authService = event.locals.services.auth;
	const token = authService.getAuthKeyFromRequest(event.request);

	if (!token) {
		logger.warn('AUTH', `Unauthenticated API request to ${pathname}`);
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Validate using multi-strategy auth
	const authResult = await authService.validateAuth(token);

	if (!authResult.valid) {
		logger.warn('AUTH', `Invalid authentication token for ${pathname}`);
		return json({ error: 'Invalid authentication token' }, { status: 401 });
	}

	// Store auth context in locals for use by routes
	event.locals.auth = {
		provider: authResult.provider,
		userId: authResult.userId,
		authenticated: true
	};

	logger.debug('AUTH', `Authenticated ${pathname} via ${authResult.provider}`);

	return resolve(event);
}

/**
 * Services initialization middleware
 * Ensures services are available in event.locals
 */
async function servicesMiddleware({ event, resolve }) {
	// Ensure services are initialized and make them available to request
	event.locals.services = await getServices();
	return resolve(event);
}

// Transaction middleware removed - this was an anti-pattern
// Transactions should be at the repository method level, not wrapping entire HTTP requests
// See code-review-fixes.md FIX-002 for details

export const handle = sequence(servicesMiddleware, authenticationMiddleware);
