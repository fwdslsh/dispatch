/**
 * Authentication middleware helper functions
 * Provides convenient authentication utilities for SvelteKit routes
 */

import { logger } from '../utils/logger.js';

/**
 * Extract session token from SvelteKit Request object
 */
function _extractSessionToken(request) {
	// Try Authorization header
	const authHeader = request.headers.get('authorization');
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.substring(7);
	}

	// Try cookies
	const cookieHeader = request.headers.get('cookie');
	if (cookieHeader) {
		const cookies = parseCookies(cookieHeader);
		if (cookies.sessionToken || cookies['dispatch-session']) {
			return cookies.sessionToken || cookies['dispatch-session'];
		}
	}

	return null;
}

/**
 * Parse cookie header
 */
function parseCookies(cookieHeader) {
	const cookies = {};
	cookieHeader.split(';').forEach((cookie) => {
		const [name, value] = cookie.trim().split('=');
		if (name && value) {
			cookies[name] = decodeURIComponent(value);
		}
	});
	return cookies;
}

/**
 * Get authenticated user from request
 * @param {Request} request - SvelteKit Request object
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getAuthenticatedUser(request) {
	try {
		const sessionToken = _extractSessionToken(request);
		if (!sessionToken) {
			return null;
		}

		// Get auth manager from global services
		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			logger.error('AUTH_MIDDLEWARE', 'AuthManager not available');
			return null;
		}

		// Validate session
		const validation = await authManager.validateSession(sessionToken);
		if (!validation.valid) {
			logger.debug('AUTH_MIDDLEWARE', `Invalid session: ${validation.error}`);
			return null;
		}

		return validation.user;
	} catch (error) {
		logger.error('AUTH_MIDDLEWARE', `Authentication error: ${error.message}`);
		return null;
	}
}

/**
 * Require admin authentication from request
 * @param {Request} request - SvelteKit Request object
 * @returns {Promise<Object|null>} Admin user object or null if not authenticated as admin
 */
export async function requireAdminAuth(request) {
	try {
		const user = await getAuthenticatedUser(request);
		if (!user) {
			return null;
		}

		// Check if user is admin
		if (!user.isAdmin) {
			logger.debug('AUTH_MIDDLEWARE', `Non-admin user attempted admin access: ${user.username}`);
			return null;
		}

		return user;
	} catch (error) {
		logger.error('AUTH_MIDDLEWARE', `Admin authentication error: ${error.message}`);
		return null;
	}
}

/**
 * Extract session token from request (helper for backward compatibility)
 */
export function extractSessionToken(request) {
	return _extractSessionToken(request);
}