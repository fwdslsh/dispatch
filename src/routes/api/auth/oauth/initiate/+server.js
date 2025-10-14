import { json, error } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * OAuth Initiation API
 * POST /api/auth/oauth/initiate
 * Generates OAuth authorization URL with state token for CSRF protection
 */

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const services = locals.services;
		if (!services?.oauthManager) {
			throw error(500, 'OAuth manager not initialized');
		}

		const body = await request.json();
		const { provider = 'github' } = body;

		// Validate provider
		if (!provider || typeof provider !== 'string') {
			throw error(400, 'Provider name required');
		}

		// Initiate OAuth flow
		const { url, state } = await services.oauthManager.initiateOAuth(provider);

		logger.info('OAUTH_INITIATE', `OAuth flow initiated for provider: ${provider}`);

		return json({
			success: true,
			authUrl: url,
			state,
			provider
		});
	} catch (err) {
		logger.error('OAUTH_INITIATE', 'Error initiating OAuth flow:', err);

		// If the error is from OAuthManager, return specific message
		if (err.message?.includes('not enabled') || err.message?.includes('not configured')) {
			throw error(400, err.message);
		}

		throw error(500, 'Failed to initiate OAuth flow');
	}
}
