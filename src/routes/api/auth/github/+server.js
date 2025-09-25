import { json, redirect } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * GitHub OAuth authentication initiation
 * GET /api/auth/github
 */
export async function GET({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Check if GitHub OAuth is enabled
		const config = await oauthManager.getOAuthConfig();
		if (!config.github || !config.github.enabled) {
			return json({ error: 'GitHub OAuth is not enabled' }, { status: 400 });
		}

		// Get provider configuration
		const providerConfig = await oauthManager.getProviderConfig('github');

		// Generate state parameter
		const state = oauthManager.generateState();
		const returnTo = url.searchParams.get('returnTo') || '/';

		// Store state
		oauthManager.storeState(state, {
			provider: 'github',
			returnTo
		});

		// Build GitHub OAuth authorization URL
		const authUrl = new URL('https://github.com/login/oauth/authorize');
		authUrl.searchParams.set('client_id', providerConfig.clientId);
		authUrl.searchParams.set('redirect_uri', providerConfig.callbackUrl);
		authUrl.searchParams.set('scope', 'user:email');
		authUrl.searchParams.set('state', state);

		// Redirect to GitHub OAuth
		throw redirect(302, authUrl.toString());

	} catch (error) {
		if (error.status === 302) {
			// Re-throw redirect responses
			throw error;
		}

		logger.error('OAUTH', `GitHub OAuth initiation error: ${error.message}`);
		return json({ error: 'Failed to initiate GitHub OAuth' }, { status: 500 });
	}
}