/**
 * SessionCookieStrategy.js
 *
 * Authentication strategy using session cookies.
 * Handles browser-based authentication with session management.
 *
 * Flow:
 * 1. Extract session ID from cookie
 * 2. Validate session with SessionManager
 * 3. Refresh session cookie if needed (within 24h of expiration)
 * 4. Return user and session data
 */

import { AuthStrategy } from './AuthStrategy.js';
import { CookieService } from '../CookieService.server.js';
import { logger } from '$lib/server/shared/utils/logger.js';

export class SessionCookieStrategy extends AuthStrategy {
	constructor() {
		super('session_cookie');
	}

	/**
	 * Authenticate using session cookie
	 * @param {Object} event - SvelteKit request event
	 * @param {Object} services - Service container
	 * @returns {Promise<import('./AuthStrategy.js').AuthResult|null>}
	 */
	async authenticate(event, services) {
		const { pathname } = event.url;

		// Extract session ID from cookie
		const sessionId = CookieService.getSessionCookie(event.cookies);
		if (!sessionId) {
			this.logFailure(pathname, 'No session cookie found');
			return null;
		}

		// Validate session
		const sessionData = await services.sessionManager.validateSession(sessionId);
		if (!sessionData) {
			this.logFailure(pathname, 'Invalid or expired session');
			return null;
		}

		// Attach session and user to event.locals for downstream use
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;

		// Refresh session cookie if needed (within 24h of expiration)
		if (sessionData.needsRefresh) {
			try {
				const newExpiresAt = await services.sessionManager.refreshSession(sessionId);
				logger.debug(
					'AUTH',
					`Refreshed session ${sessionId.slice(0, 8)}... (new expiry: ${new Date(newExpiresAt).toISOString()})`
				);
			} catch (err) {
				// Log but don't fail authentication if refresh fails
				logger.warn('AUTH', `Failed to refresh session ${sessionId.slice(0, 8)}...`, err);
			}
		}

		const authResult = {
			authenticated: true,
			provider: sessionData.session.provider,
			userId: sessionData.session.userId,
			session: sessionData.session,
			user: sessionData.user
		};

		this.logSuccess(pathname, authResult);

		return authResult;
	}
}
