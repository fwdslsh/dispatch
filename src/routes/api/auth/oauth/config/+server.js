import { json } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * OAuth configuration management API
 * GET /api/auth/oauth/config - Get OAuth configuration
 * POST /api/auth/oauth/config - Update OAuth configuration
 */

export async function GET({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Get OAuth configuration
		const config = await oauthManager.getOAuthConfig();
		const enabledProviders = await oauthManager.getEnabledProviders();

		// Return sanitized config (no secrets)
		const sanitizedConfig = {};
		Object.keys(config).forEach(provider => {
			sanitizedConfig[provider] = {
				enabled: config[provider].enabled,
				hasClientId: Boolean(config[provider].clientId),
				hasClientSecret: Boolean(config[provider].clientSecret),
				callbackUrl: oauthManager.getCallbackUrl(provider)
			};
		});

		return json({
			success: true,
			config: sanitizedConfig,
			enabledProviders,
			baseUrl
		});

	} catch (error) {
		logger.error('OAUTH', `Failed to get OAuth config: ${error.message}`);
		return json({
			success: false,
			error: 'Failed to get OAuth configuration'
		}, { status: 500 });
	}
}

export async function POST({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Get request body
		const body = await request.json();
		const { config } = body;

		if (!config) {
			return json({
				success: false,
				error: 'OAuth configuration is required'
			}, { status: 400 });
		}

		// Validate configuration
		const validationResult = validateOAuthConfig(config);
		if (!validationResult.valid) {
			return json({
				success: false,
				error: validationResult.error
			}, { status: 400 });
		}

		// Update OAuth configuration
		const updatedConfig = await oauthManager.updateOAuthConfig(config);

		logger.info('OAUTH', 'OAuth configuration updated successfully');

		return json({
			success: true,
			config: updatedConfig,
			message: 'OAuth configuration updated successfully'
		});

	} catch (error) {
		logger.error('OAUTH', `Failed to update OAuth config: ${error.message}`);
		return json({
			success: false,
			error: 'Failed to update OAuth configuration'
		}, { status: 500 });
	}
}

/**
 * Validate OAuth configuration
 */
function validateOAuthConfig(config) {
	const validProviders = ['google', 'github'];
	const errors = [];

	Object.keys(config).forEach(provider => {
		if (!validProviders.includes(provider)) {
			errors.push(`Invalid provider: ${provider}`);
			return;
		}

		const providerConfig = config[provider];

		// If enabled, must have client ID and secret
		if (providerConfig.enabled) {
			if (!providerConfig.clientId) {
				errors.push(`${provider}: Client ID is required when enabled`);
			}
			if (!providerConfig.clientSecret) {
				errors.push(`${provider}: Client Secret is required when enabled`);
			}

			// Validate client ID format (basic validation)
			if (providerConfig.clientId && providerConfig.clientId.length < 10) {
				errors.push(`${provider}: Client ID appears to be invalid`);
			}
		}
	});

	return {
		valid: errors.length === 0,
		error: errors.join(', ')
	};
}