/**
 * Cookie Service - Helper utilities for managing session cookies
 *
 * Provides standardized cookie handling for authentication sessions:
 * - httpOnly: Prevents XSS attacks (JavaScript cannot access)
 * - Secure: Requires HTTPS in production (TLS encryption)
 * - SameSite=Lax: Prevents most CSRF attacks while allowing normal navigation
 * - 30-day expiration: Matches session lifetime
 */
export class CookieService {
	static COOKIE_NAME = 'dispatch_session';
	static MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

	/**
	 * Get standard session cookie attributes
	 * @returns {Object} Cookie options for SvelteKit's cookies.set()
	 */
	static getSessionCookieAttributes() {
		const isDev = process.env.NODE_ENV !== 'production';
		return {
			path: '/', // Cookie available to entire application
			httpOnly: true, // Prevent JavaScript access (XSS protection)
			secure: !isDev, // Require HTTPS in production (allow HTTP in dev)
			sameSite: 'lax', // CSRF protection while allowing normal navigation
			maxAge: this.MAX_AGE // 30 days in seconds
		};
	}

	/**
	 * Set session cookie with standard security attributes
	 * @param {Object} cookies - SvelteKit cookies object from event.cookies
	 * @param {string} sessionId - Session ID (UUID) to store in cookie
	 */
	static setSessionCookie(cookies, sessionId) {
		if (!cookies || typeof cookies.set !== 'function') {
			throw new Error('Invalid cookies object - must be SvelteKit event.cookies');
		}

		if (!sessionId || typeof sessionId !== 'string') {
			throw new Error('Invalid sessionId - must be a non-empty string');
		}

		cookies.set(this.COOKIE_NAME, sessionId, this.getSessionCookieAttributes());
	}

	/**
	 * Get session ID from cookie
	 * @param {Object} cookies - SvelteKit cookies object from event.cookies
	 * @returns {string|null} Session ID or null if not found
	 */
	static getSessionCookie(cookies) {
		if (!cookies || typeof cookies.get !== 'function') {
			throw new Error('Invalid cookies object - must be SvelteKit event.cookies');
		}

		return cookies.get(this.COOKIE_NAME) || null;
	}

	/**
	 * Delete session cookie (logout)
	 * @param {Object} cookies - SvelteKit cookies object from event.cookies
	 */
	static deleteSessionCookie(cookies) {
		if (!cookies || typeof cookies.delete !== 'function') {
			throw new Error('Invalid cookies object - must be SvelteKit event.cookies');
		}

		cookies.delete(this.COOKIE_NAME, { path: '/' });
	}
}
