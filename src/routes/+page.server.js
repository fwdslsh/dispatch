import { fail, redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { CookieService } from '$lib/server/auth/CookieService.server.js';

/**
 * Login page server-side actions
 * Handles API key authentication with session cookie creation
 */

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * Log in with API key
	 * Creates a session cookie on successful authentication
	 */
	login: async ({ request, cookies, locals }) => {
		const services = locals.services;
		const formData = await request.formData();
		const apiKey = formData.get('key');

		// Validate input
		if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
			logger.warn('LOGIN', 'Login attempt with missing API key');
			return fail(400, { error: 'API key is required' });
		}

		// Verify API key
		const apiKeyData = await services.apiKeyManager.verify(apiKey);
		if (!apiKeyData) {
			logger.warn('LOGIN', 'Login attempt with invalid API key');
			return fail(401, { error: 'Invalid API key' });
		}

		// Create session
		const session = await services.sessionManager.createSession(apiKeyData.userId, 'api_key', {
			apiKeyId: apiKeyData.id,
			label: apiKeyData.label
		});

		// Set session cookie
		CookieService.setSessionCookie(cookies, session.sessionId);

		logger.info(
			'LOGIN',
			`User ${apiKeyData.userId} logged in with API key ${apiKeyData.id} (label: ${apiKeyData.label})`
		);

		// Redirect to home or to redirect parameter
		const redirectUrl = new URL(request.url).searchParams.get('redirect') || '/workspace';
		throw redirect(303, redirectUrl);
	}
};
