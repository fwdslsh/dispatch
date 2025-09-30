/**
 * Authentication Configuration API Endpoints
 * GET /api/auth/config - Get authentication configuration status
 * PUT /api/auth/config - Update authentication configuration
 */

import { json } from '@sveltejs/kit';
import { SettingsManager } from '../../../../lib/server/settings/SettingsManager.js';
import { SettingsValidator } from '../../../../lib/server/settings/SettingsValidator.js';
import { validateKey } from '../../../../lib/server/shared/auth.js';
import { settingsEventBroadcaster } from '../../../../lib/server/settings/SettingsEventBroadcaster.js';

const settingsManager = new SettingsManager();
const settingsValidator = new SettingsValidator();

/**
 * GET /api/auth/config
 * Retrieve current authentication configuration status
 * NOTE: This endpoint is public (no auth required) so login page can see available auth methods
 */
export async function GET() {
	try {
		// Initialize settings manager
		await settingsManager.initialize();

		// Get authentication configuration
		const authConfig = await settingsManager.getAuthConfig();

		return json(authConfig, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		});
	} catch (error) {
		console.error('Auth config GET error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * PUT /api/auth/config
 * Update authentication configuration with session invalidation
 */
export async function PUT({ request }) {
	try {
		const body = await request.json();

		// Validate authentication
		const authKey = body.authKey;
		if (!validateKey(authKey)) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		// Initialize settings manager
		await settingsManager.initialize();

		// Extract authentication settings from body
		const authSettings = {};
		const validAuthKeys = [
			'terminal_key',
			'oauth_client_id',
			'oauth_client_secret',
			'oauth_redirect_uri'
		];

		for (const key of validAuthKeys) {
			if (body[key] !== undefined) {
				authSettings[key] = body[key];
			}
		}

		if (Object.keys(authSettings).length === 0) {
			return json({ error: 'No authentication settings provided' }, { status: 400 });
		}

		// Get authentication settings for validation
		const authCategorySettings = await settingsManager.getSettings('authentication');
		const settingsByKey = new Map(authCategorySettings.map((s) => [s.key, s]));

		// Validate all auth settings
		const validationResults = [];
		for (const [key, value] of Object.entries(authSettings)) {
			const setting = settingsByKey.get(key);
			if (!setting) {
				return json({ error: `Unknown authentication setting: ${key}` }, { status: 400 });
			}

			const validation = settingsValidator.validateSetting(setting, value);
			validationResults.push({ key, ...validation });

			if (!validation.valid) {
				return json(
					{
						error: 'Validation failed',
						details: validation.errors,
						setting: key
					},
					{ status: 400 }
				);
			}
		}

		// Apply updates to authentication category
		const result = await settingsManager.updateCategorySettings('authentication', authSettings);

		// Add validation warnings to response
		const warnings = validationResults
			.filter((v) => v.warnings && v.warnings.length > 0)
			.map((v) => ({ setting: v.key, warnings: v.warnings }));

		const response = {
			...result,
			warnings: warnings.length > 0 ? warnings : undefined
		};

		// Authentication settings always invalidate sessions
		response.session_invalidated = true;
		response.message =
			'Authentication configuration updated. All active sessions have been invalidated.';

		// Broadcast authentication invalidation and settings update events
		settingsEventBroadcaster.broadcastAuthInvalidation(
			'authentication_config_changed',
			authSettings
		);

		settingsEventBroadcaster.broadcastSettingsUpdate('authentication', authSettings, {
			updatedCount: result.updated_count,
			sessionInvalidated: true,
			source: 'auth_config_endpoint'
		});

		return json(response, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});
	} catch (error) {
		console.error('Auth config PUT error:', error);

		// Return validation error details if available
		if (error.message.includes('Validation failed')) {
			return json({ error: error.message }, { status: 400 });
		}

		// Handle specific authentication errors
		if (error.message.includes('Terminal key')) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * OPTIONS /api/auth/config
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
