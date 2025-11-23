import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	BadRequestError,
	ServiceUnavailableError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

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
			throw new ServiceUnavailableError(
				'OAuth manager not initialized',
				'OAUTH_NOT_INITIALIZED'
			);
		}

		const body = await request.json();
		const { provider = 'github' } = body;

		// Validate provider
		if (!provider || typeof provider !== 'string') {
			throw new BadRequestError('Provider name required', 'MISSING_PROVIDER');
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
		// If the error is from OAuthManager about provider configuration, wrap as BadRequest
		if (err.message?.includes('not enabled') || err.message?.includes('not configured')) {
			err = new BadRequestError(err.message, 'PROVIDER_NOT_CONFIGURED');
		}

		handleApiError(err, 'POST /api/auth/oauth/initiate');
	}
}
