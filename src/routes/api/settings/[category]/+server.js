/**
 * Settings Category API Endpoint
 * PUT /api/settings/{category} - Update settings in a specific category
 */

import { json } from '@sveltejs/kit';
import { SettingsManager } from '../../../../lib/server/settings/SettingsManager.js';
import { SettingsValidator } from '../../../../lib/server/settings/SettingsValidator.js';
import { validateKey } from '../../../../lib/server/shared/auth.js';
import { settingsEventBroadcaster } from '../../../../lib/server/settings/SettingsEventBroadcaster.js';

const settingsManager = new SettingsManager();
const settingsValidator = new SettingsValidator();

/**
 * PUT /api/settings/{category}
 * Update all settings in a specific category
 */
export async function PUT({ params, request }) {
	try {
		const { category } = params;
		const body = await request.json();

		// Validate authentication
		const authKey = body.authKey;
		if (!validateKey(authKey)) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		// Validate request body
		if (!body.settings || typeof body.settings !== 'object') {
			return json({ error: 'Missing or invalid settings object' }, { status: 400 });
		}

		// Initialize settings manager
		await settingsManager.initialize();

		// Validate category exists
		const categoryObj = await settingsManager.getCategory(category);
		if (!categoryObj) {
			return json({ error: `Invalid category: ${category}` }, { status: 400 });
		}

		// Get all settings in the category for validation
		const categorySettings = await settingsManager.getSettings(category);
		const settingsByKey = new Map(categorySettings.map((s) => [s.key, s]));

		// Validate all updates before applying
		const validationResults = [];
		for (const [key, value] of Object.entries(body.settings)) {
			const setting = settingsByKey.get(key);
			if (!setting) {
				return json(
					{ error: `Unknown setting '${key}' in category '${category}'` },
					{ status: 400 }
				);
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

		// Apply updates
		const result = await settingsManager.updateCategorySettings(category, body.settings);

		// Add validation warnings to response
		const warnings = validationResults
			.filter((v) => v.warnings && v.warnings.length > 0)
			.map((v) => ({ setting: v.key, warnings: v.warnings }));

		const response = {
			...result,
			warnings: warnings.length > 0 ? warnings : undefined
		};

		// If authentication settings changed, add appropriate message
		if (result.session_invalidated) {
			response.message = 'Authentication settings updated. All sessions will be invalidated.';

			// Broadcast authentication invalidation event
			settingsEventBroadcaster.broadcastAuthInvalidation(
				'authentication_settings_changed',
				body.settings
			);
		}

		// Broadcast settings update to all connected clients
		settingsEventBroadcaster.broadcastSettingsUpdate(category, body.settings, {
			updatedCount: result.updated_count,
			sessionInvalidated: result.session_invalidated
		});

		return json(response, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});
	} catch (error) {
		console.error('Settings update error:', error);

		// Return validation error details if available
		if (error.message.includes('Validation failed')) {
			return json({ error: error.message }, { status: 400 });
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * OPTIONS /api/settings/{category}
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
