import { json, redirect } from '@sveltejs/kit';
import passport from 'passport';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * Google OAuth authentication initiation
 * GET /api/auth/google
 */
export async function GET({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Check if Google OAuth is enabled
		const config = await oauthManager.getOAuthConfig();
		if (!config.google || !config.google.enabled) {
			return json({ error: 'Google OAuth is not enabled' }, { status: 400 });
		}

		// Get provider configuration
		const providerConfig = await oauthManager.getProviderConfig('google');

		// Generate state parameter
		const state = oauthManager.generateState();
		const returnTo = url.searchParams.get('returnTo') || '/';

		// Store state
		oauthManager.storeState(state, {
			provider: 'google',
			returnTo
		});

		// Build Google OAuth authorization URL
		const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('client_id', providerConfig.clientId);
		authUrl.searchParams.set('redirect_uri', providerConfig.callbackUrl);
		authUrl.searchParams.set('scope', 'openid email profile');
		authUrl.searchParams.set('state', state);

		// Redirect to Google OAuth
		throw redirect(302, authUrl.toString());

	} catch (error) {
		if (error.status === 302) {
			// Re-throw redirect responses
			throw error;
		}

		logger.error('OAUTH', `Google OAuth initiation error: ${error.message}`);
		return json({ error: 'Failed to initiate Google OAuth' }, { status: 500 });
	}
}