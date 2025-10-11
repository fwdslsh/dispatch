import { json, error } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * OAuth Settings API
 * Handles fetching and updating OAuth provider configurations
 */

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	try {
		const services = locals.services;
		if (!services?.oauthManager) {
			throw error(500, 'OAuth manager not initialized');
		}

		// Get all OAuth providers
		const providers = await services.oauthManager.getProviders();

		// Transform to response format (exclude secrets)
		const responseData = {};
		for (const provider of providers) {
			responseData[provider.name] = {
				enabled: provider.enabled,
				clientId: provider.clientId,
				displayName: provider.displayName
			};
		}

		return json(responseData);
	} catch (err) {
		logger.error('OAUTH_API', 'Error fetching OAuth settings:', err);
		throw error(500, 'Failed to load OAuth settings');
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		const services = locals.services;
		if (!services?.oauthManager) {
			throw error(500, 'OAuth manager not initialized');
		}

		const body = await request.json();
		const { providers } = body;

		if (!providers || typeof providers !== 'object') {
			throw error(400, 'Invalid request: providers object required');
		}

		// Update each provider
		const results = [];
		for (const [providerName, config] of Object.entries(providers)) {
			try {
				if (config.enabled) {
					// Validate required fields
					if (!config.clientId) {
						throw error(400, `Client ID required for ${providerName}`);
					}

					// Enable provider (only update secret if provided)
					await services.oauthManager.enableProvider(
						providerName,
						config.clientId,
						config.clientSecret || null, // Only update if new secret provided
						config.redirectUri
					);

					results.push({
						provider: providerName,
						status: 'enabled',
						success: true
					});

					logger.info('OAUTH_API', `OAuth provider ${providerName} enabled`);
				} else {
					// Disable provider
					await services.oauthManager.disableProvider(providerName);

					results.push({
						provider: providerName,
						status: 'disabled',
						success: true
					});

					logger.info('OAUTH_API', `OAuth provider ${providerName} disabled`);
				}
			} catch (err) {
				logger.error('OAUTH_API', `Error updating provider ${providerName}:`, err);
				results.push({
					provider: providerName,
					success: false,
					error: err.message
				});
			}
		}

		// Check if any updates failed
		const failures = results.filter((r) => !r.success);
		if (failures.length > 0) {
			return json(
				{
					success: false,
					error: 'Some providers failed to update',
					results
				},
				{ status: 400 }
			);
		}

		return json({
			success: true,
			message: 'OAuth settings updated successfully',
			results
		});
	} catch (err) {
		logger.error('OAUTH_API', 'Error updating OAuth settings:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Failed to update OAuth settings');
	}
}
