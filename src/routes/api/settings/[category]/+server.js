/**
 * Settings Category API Endpoint
 * PUT /api/settings/{category} - Update settings in a specific category
 * Uses unified settings table via DatabaseManager
 */

import { json } from '@sveltejs/kit';

/**
 * PUT /api/settings/{category}
 * Update all settings in a specific category
 *
 * Authentication: Authorization header (preferred) or authKey in body (backwards compatible)
 * Request body:
 *   {
 *     "settings": { key: value pairs for this category }
 *   }
 */
export async function PUT({ params, request, url, locals }) {
	try {
		const { category } = params;
		const body = await request.json();

		// Validate authentication using standardized pattern
		const authKey = locals.services.auth.getAuthKeyFromRequest(request) || body.authKey;
		if (!locals.services.auth.validateKey(authKey)) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		// Validate request body
		if (!body.settings || typeof body.settings !== 'object') {
			return json({ error: 'Missing or invalid settings object' }, { status: 400 });
		}

		const database = locals.services.database;

		// Get current settings for this category
		const currentSettings = await database.getSettingsByCategory(category);

		// Merge with updates
		const updatedSettings = {
			...currentSettings,
			...body.settings
		};

		// Save to database
		await database.setSettingsForCategory(
			category,
			updatedSettings,
			`Settings for ${category} category`
		);

		// Update terminal key cache if authentication settings changed
		if (category === 'authentication' && body.settings.terminal_key !== undefined) {
			locals.services.auth.updateCachedKey(body.settings.terminal_key);
		}

		return json(
			{
				success: true,
				category,
				settings: updatedSettings,
				updated_count: Object.keys(body.settings).length
			},
			{
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			}
		);
	} catch (error) {
		console.error('Settings update error:', error);
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
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
}
