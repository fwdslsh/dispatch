/**
 * Settings API Endpoints
 * GET /api/settings - Retrieve all settings from unified settings table
 * Uses DatabaseManager for simplified settings management
 */

import { json } from '@sveltejs/kit';
import { validateKey } from '../../../lib/server/shared/auth.js';

/**
 * GET /api/settings
 * Retrieve all configuration settings from the unified settings table
 *
 * Query parameters:
 *   - authKey: Authentication key (required)
 *   - category: Optional category filter
 *
 * Returns all settings grouped by category from the 'settings' table
 */
export async function GET({ url, locals }) {
	try {
		// Authenticate request
		const authKey = url.searchParams.get('authKey');
		if (!validateKey(authKey)) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		// Get category filter if provided
		const categoryFilter = url.searchParams.get('category');

		const database = locals.services.database;

		if (categoryFilter) {
			// Return specific category settings
			const categorySettings = await database.getSettingsByCategory(categoryFilter);

			return json({
				[categoryFilter]: categorySettings || {}
			}, {
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0'
				}
			});
		} else {
			// Return all settings from settings table
			// Query all categories and build response
			const allSettings = {};

			// Get all distinct categories from settings table
			const categories = await database.all(
				'SELECT category FROM settings ORDER BY category'
			);

			for (const row of categories) {
				const categorySettings = await database.getSettingsByCategory(row.category);
				allSettings[row.category] = categorySettings;
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
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}