/**
 * Settings Category API Endpoint
 * PUT /api/settings/{category} - Update settings in a specific category
 * Uses unified settings table via DatabaseManager
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

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
export async function PUT({ params, request, locals }) {
	try {
		logger.info('SETTINGS_API', `PUT /api/settings/${params.category} hit`, {
			user: locals.auth?.userId || null,
			authenticated: Boolean(locals.auth?.authenticated)
		});
		// Auth must be handled in hooks only
		if (!locals.auth?.authenticated) {
			logger.info('SETTINGS_API', `Unauthenticated on PUT /api/settings/${params.category}`);
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		const { category } = params;
		const body = await request.json();

		// Validate request body
		if (!body.settings || typeof body.settings !== 'object') {
			return json({ error: 'Missing or invalid settings object' }, { status: 400 });
		}

		const { settingsRepository } = locals.services;

		// Get current settings for this category
		const currentSettings = await settingsRepository.getByCategory(category);

		// Merge with updates
		const updatedSettings = {
			...currentSettings,
			...body.settings
		};

		// Save to database
		await settingsRepository.setByCategory(
			category,
			updatedSettings,
			`Settings for ${category} category`
		);

		const payload = {
			success: true,
			category,
			settings: updatedSettings,
			updated_count: Object.keys(body.settings).length
		};

		logger.info('SETTINGS_API', `Updated settings for ${category}`, {
			updated_count: payload.updated_count
		});

		return json(payload, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});
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
