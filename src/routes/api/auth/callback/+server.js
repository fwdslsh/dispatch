import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import { CookieService } from '$lib/server/auth/CookieService.server.js';

/**
 * OAuth Callback Handler
 * Exchanges authorization code for access token and creates user session with cookie
 * Uses OAuthManager for provider-agnostic OAuth flow handling
 */
export async function GET({ url, cookies, locals }) {
	try {
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const provider = url.searchParams.get('provider') || 'github';

		if (!code) {
			logger.warn('AUTH', 'OAuth callback missing authorization code');
			throw redirect(303, '/login?error=missing_code');
		}

		if (!state) {
			logger.warn('AUTH', 'OAuth callback missing state token');
			throw redirect(303, '/login?error=missing_state');
		}

		// Get OAuthManager from locals
		const oauthManager = locals.services?.oauthManager;
		if (!oauthManager) {
			logger.error('AUTH', 'OAuth manager not initialized');
			throw redirect(303, '/login?error=auth_not_configured');
		}

		// Handle OAuth callback and get user data
		const userData = await oauthManager.handleCallback(code, state, provider);
		if (!userData) {
			logger.warn('AUTH', `OAuth callback failed for provider ${provider}`);
			throw redirect(303, '/login?error=auth_failed');
		}

		// Create session using SessionManager
		const session = await locals.services.sessionManager.createSession(
			userData.userId,
			userData.provider, // e.g., "oauth_github"
			{
				email: userData.email,
				name: userData.name
			}
		);

		// Set session cookie
		CookieService.setSessionCookie(cookies, session.sessionId);

		logger.info(
			'AUTH',
			`User ${userData.userId} authenticated via ${provider} OAuth (email: ${userData.email})`
		);

		// Redirect to home
		throw redirect(303, '/');
	} catch (error) {
		// If it's already a redirect, re-throw
		if (error?.status === 303) {
			throw error;
		}

		logger.error('AUTH', 'OAuth callback error:', error);
		throw redirect(303, '/login?error=auth_error');
	}
}
