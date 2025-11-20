import { sequence } from '@sveltejs/kit/hooks';
import { json, redirect } from '@sveltejs/kit';
import { logger } from './lib/server/shared/utils/logger.js';
import { initializeServices } from './lib/server/shared/index.js';
import {
	SessionCookieStrategy,
	ApiKeyStrategy,
	AuthenticationCoordinator
} from './lib/server/auth/strategies/index.js';
import { createAuthRateLimiter } from './lib/server/auth/RateLimiter.js';

// Use process-level singleton to survive module reloads
const SERVICES_KEY = Symbol.for('dispatch.services');

// Rate limiter singleton (10 attempts per minute per IP)
const authRateLimiter = createAuthRateLimiter();

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
	'/api-docs',
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
 * Authentication middleware (refactored with Strategy pattern)
 * Validates requests using dual auth strategy (session cookies OR API keys)
 *
 * Strategy 1: Session cookie validation (browser requests)
 * Strategy 2: API key validation (programmatic access)
 *
 * Benefits of Strategy pattern refactor:
 * - Reduced complexity: 112 lines -> ~45 lines
 * - Single Responsibility: Each strategy handles one auth method
 * - Testability: Strategies can be tested independently
 * - Maintainability: Easy to add new auth methods without modifying middleware
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

	// Rate limiting: Check authentication attempts per IP address
	// Skip rate limiting for already-authenticated users (session cookie exists)
	const clientIp = event.getClientAddress();
	const hasSessionCookie = event.cookies.get('session');

	if (!hasSessionCookie && clientIp) {
		const rateLimitResult = authRateLimiter.check(clientIp);
		if (!rateLimitResult.allowed) {
			logger.warn('AUTH', `Rate limit exceeded for IP ${clientIp}`, {
				retryAfter: rateLimitResult.retryAfter
			});

			const isApiRoute = pathname.startsWith('/api/');
			if (isApiRoute) {
				return json(
					{ error: 'Too many authentication attempts. Please try again later.' },
					{
						status: 429,
						headers: {
							'Retry-After': rateLimitResult.retryAfter.toString()
						}
					}
				);
			} else {
				// For browser requests, show a friendly error page
				throw redirect(
					303,
					`/login?error=${encodeURIComponent('Too many login attempts. Please try again later.')}`
				);
			}
		}
	}

	// Initialize authentication coordinator with strategies in priority order
	const coordinator = new AuthenticationCoordinator([
		new SessionCookieStrategy(), // Try session cookie first (browser auth)
		new ApiKeyStrategy() // Fall back to API key (programmatic auth)
	]);

	// Attempt authentication using all configured strategies
	const authResult = await coordinator.authenticate(event, event.locals.services);
	event.locals.auth = authResult;

	// Reset rate limit on successful authentication
	if (authResult.authenticated && clientIp) {
		authRateLimiter.reset(clientIp);
	}

	// Handle unauthenticated requests
	if (!authResult.authenticated) {
		// Optional auth routes should proceed even without authentication
		if (isOptionalAuth) {
			logger.debug('AUTH', `Optional auth route ${pathname} - proceeding without authentication`);
			return resolve(event);
		}

		// API routes return 401 JSON response
		const isApiRoute = pathname.startsWith('/api/');
		if (isApiRoute) {
			logger.warn('AUTH', `Unauthenticated API request to ${pathname}`);
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Browser routes redirect to login page
		logger.debug('AUTH', `Redirecting unauthenticated request to /login (from ${pathname})`);
		throw redirect(303, `/login?redirect=${encodeURIComponent(pathname)}`);
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

	// Allow onboarding and login routes without redirection
	const isOnboardingRoute = pathname === '/onboarding' || pathname.startsWith('/onboarding/');
	const isLoginRoute = pathname === '/login'; // Only exempt explicit /login, not root /
	const isApiDocsRoute = pathname === '/api-docs';
	if (isOnboardingRoute || isLoginRoute || isApiDocsRoute) {
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
