/**
 * Settings API Endpoints
 * GET /api/settings - Retrieve all settings from unified settings table
 * Uses DatabaseManager for simplified settings management
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * GET /api/settings
 * Retrieve all configuration settings from the unified settings table
 *
 * Authentication: Authorization header (preferred) or authKey query param (backwards compatible)
 * Query parameters:
 *   - category: Optional category filter
 *
 * Returns all settings grouped by category from the 'settings' table
 */
export async function GET({ url, locals }) {
	try {
		logger.info('SETTINGS_API', `GET /api/settings hit`, {
			user: locals.auth?.userId || null,
			authenticated: Boolean(locals.auth?.authenticated),
			category: url.searchParams.get('category') || null
		});
		// Auth must be handled in hooks only
		if (!locals.auth?.authenticated) {
			logger.info('SETTINGS_API', 'Unauthenticated on GET /api/settings');
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Get category filter if provided
		const categoryFilter = url.searchParams.get('category');

		const { settingsRepository } = locals.services;

		if (categoryFilter) {
			// Return specific category settings
			const categorySettings = await settingsRepository.getByCategory(categoryFilter);

			return json(
				{
					[categoryFilter]: categorySettings || {}
				},
				{
					headers: {
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						Pragma: 'no-cache',
						Expires: '0'
					}
				}
			);
		} else {
			// Return all settings from settings table
			const allSettingsArray = await settingsRepository.getAll();
			const allSettings = {};

			for (const setting of allSettingsArray) {
				allSettings[setting.category] = setting.settings;
			}

			return json(allSettings, {
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0'
				}
			});
		}
	} catch (error) {
		console.error('Settings API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * OPTIONS /api/settings
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
}
