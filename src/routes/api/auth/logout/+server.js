import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { CookieService } from '$lib/server/auth/CookieService.server.js';

/**
 * Logout endpoint
 * Invalidates session and clears cookie
 */

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies, locals }) {
	const services = locals.services;

	try {
		// Get session ID from cookie
		const sessionId = CookieService.getSessionCookie(cookies);

		if (sessionId) {
			// Invalidate session in database
			await services.sessionManager.invalidateSession(sessionId);
			logger.info('LOGOUT', `Session ${sessionId} invalidated`);
		}

		// Clear session cookie
		CookieService.deleteSessionCookie(cookies);

		logger.info('LOGOUT', 'User logged out successfully');
	} catch (err) {
		// Log error but continue with logout (best effort session cleanup)
		logger.error('LOGOUT', 'Error during logout:', err);
	}

	// Always redirect to login page
	throw redirect(303, '/login');
}
