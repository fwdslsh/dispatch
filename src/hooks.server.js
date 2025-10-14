import { sequence } from '@sveltejs/kit/hooks';
import { json, redirect } from '@sveltejs/kit';
import { logger } from './lib/server/shared/utils/logger.js';
import { initializeServices } from './lib/server/shared/index.js';
import { CookieService } from './lib/server/auth/CookieService.server.js';

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
	'/',
	'/login',
	'/onboarding',
	'/api/auth/oauth/initiate',
	'/api/auth/callback',
	'/api/auth/config',
	'/api/auth/login',
	'/api/auth/logout',
	'/api/status',
	'/api/environment',
	'/api/themes/active',
	'/api/themes'
];

/**
 * Routes that should run auth middleware but not require authentication
 * These routes need to check auth status but should work for both authenticated and unauthenticated users
 */
const OPTIONAL_AUTH_ROUTES = [];

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname) {
	return PUBLIC_ROUTES.some((route) =>
		route === '/' ? pathname === '/' : pathname.startsWith(route)
	);
}

/**
 * Check if a route requires authentication check but doesn't enforce it
 */
function isOptionalAuthRoute(pathname) {
	return OPTIONAL_AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Authentication middleware
 * Validates requests using dual auth strategy (session cookies OR API keys)
 *
 * Strategy 1: Session cookie validation (browser requests)
 * Strategy 2: API key validation (programmatic access)
 */
async function authenticationMiddleware({ event, resolve }) {
	const { pathname } = event.url;
	const isOptionalAuth = isOptionalAuthRoute(pathname);

	// Always initialize locals.auth to a boolean state
	event.locals.auth = event.locals.auth || { authenticated: false };

	// Allow CORS preflight and OPTIONS requests to skip auth entirely
	if (event.request.method === 'OPTIONS') {
		logger.debug('AUTH', `Skipping auth for OPTIONS ${pathname}`);
		return resolve(event);
	}

	// Skip auth for public routes (but not optional auth routes)
	if (isPublicRoute(pathname) && !isOptionalAuth) {
		logger.debug('AUTH', `Skipping auth for public route: ${pathname}`);
		return resolve(event);
	}

	const services = event.locals.services;
	const isApiRoute = pathname.startsWith('/api/');
	let authenticated = false;

	// Strategy 1: Check for session cookie (browser authentication)
	const isSettingsApi = pathname.startsWith('/api/settings');
	if (isSettingsApi) {
		logger.info('AUTH', 'Settings API request detected');
	}
	const sessionId = CookieService.getSessionCookie(event.cookies);
	if (sessionId) {
		if (isSettingsApi) logger.info('AUTH', `Found session cookie: ${sessionId.slice(0, 8)}...`);
		const sessionData = await services.sessionManager.validateSession(sessionId);
		if (sessionData) {
			// Valid session - attach to locals
			event.locals.session = sessionData.session;
			event.locals.user = sessionData.user;
			event.locals.auth = {
				authenticated: true,
				provider: sessionData.session.provider,
				userId: sessionData.session.userId
			};

			if (isSettingsApi)
				logger.info(
					'AUTH',
					`Validated session for user ${sessionData.session.userId} (provider ${sessionData.session.provider})`
				);

			// Refresh session cookie if needed (within 24h of expiration)
			if (sessionData.needsRefresh) {
				const newExpiresAt = await services.sessionManager.refreshSession(sessionId);
				logger.debug(
					'AUTH',
					`Refreshed session ${sessionId} (new expiry: ${new Date(newExpiresAt).toISOString()})`
				);
			}

			authenticated = true;
			logger.debug(
				'AUTH',
				`Authenticated ${pathname} via session cookie (provider: ${sessionData.session.provider})`
			);
		}
	}
	else if (isSettingsApi) {
		logger.info('AUTH', 'No session cookie found for settings request');
	}

	// Strategy 2: Check for API key (Authorization header)
	if (!authenticated) {
		const authService = services.auth;
		const token = authService.getAuthKeyFromRequest(event.request);

		if (token) {
			const authResult = await authService.validateAuth(token);
			if (authResult.valid) {
				event.locals.auth = {
					authenticated: true,
					provider: authResult.provider,
					userId: authResult.userId,
					apiKeyId: authResult.apiKeyId,
					label: authResult.label
				};
				authenticated = true;
				logger.debug(
					'AUTH',
					`Authenticated ${pathname} via API key (provider: ${authResult.provider})`
				);
			}
		}
	}

	// Handle unauthenticated requests
	if (!authenticated) {
		// Optional auth routes should proceed even without authentication
		if (isOptionalAuth) {
			logger.debug('AUTH', `Optional auth route ${pathname} - proceeding without authentication`);
			// Ensure locals.auth reflects unauthenticated state
			event.locals.auth = { authenticated: false };
			return resolve(event);
		}

		if (isApiRoute) {
			logger.warn('AUTH', `Unauthenticated API request to ${pathname}`);
			if (isSettingsApi) logger.info('AUTH', 'Returning 401 for settings API (unauthenticated)');
			return json({ error: 'Authentication required' }, { status: 401 });
		} else {
			// Redirect browser requests to login page
			logger.debug('AUTH', `Redirecting unauthenticated request to /login (from ${pathname})`);
			throw redirect(303, `/login?redirect=${encodeURIComponent(pathname)}`);
		}
	}

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

/**
 * Onboarding enforcement middleware
 * Redirects HTML page requests to onboarding until setup is complete
 * Note: Settings are no longer exempt; they require onboarding + auth.
 */
async function onboardingMiddleware({ event, resolve }) {
	const { pathname } = event.url;

	// Allow onboarding routes without redirection
	const isOnboardingRoute = pathname === '/onboarding' || pathname.startsWith('/onboarding/');
	if (isOnboardingRoute) {
		return resolve(event);
	}

	// Only enforce on HTML navigation requests (skip APIs and assets)
	const acceptHeader = event.request.headers.get('accept') || '';
	if (!acceptHeader.includes('text/html')) {
		return resolve(event);
	}

	// Allow API and internal asset routes explicitly
	if (pathname.startsWith('/api/') || pathname.startsWith('/_app/')) {
		return resolve(event);
	}

	try {
		const services = event.locals.services;
		const status = await services?.settingsRepository?.getSystemStatus();
		const onboardingComplete = status?.onboarding?.isComplete === true;

		if (!onboardingComplete) {
			logger.debug('ONBOARDING', `Redirecting ${pathname} to /onboarding`);
			throw redirect(303, '/onboarding');
		}
	} catch (error) {
		logger.error('ONBOARDING', 'Failed to evaluate onboarding state:', error);
		// Allow request to proceed on failure to avoid blocking access
	}

	return resolve(event);
}

export const handle = sequence(servicesMiddleware, authenticationMiddleware, onboardingMiddleware);
