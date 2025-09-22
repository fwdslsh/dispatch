/**
 * Settings API
 * Manages server-side settings stored as JSON objects per category
 */

import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/shared/auth.js';

/**
 * GET - Retrieve settings
 * Query parameters:
 * - category: Get specific category (optional)
 * - metadata: Include metadata (default: false)
 */
export async function GET({ url, locals }) {
	const databaseManager = locals.services?.database;
	if (!databaseManager) {
		return json({ error: 'Database service not available' }, { status: 500 });
	}

	const authKey = url.searchParams.get('authKey');
	const category = url.searchParams.get('category');
	const includeMetadata = url.searchParams.get('metadata') === 'true';

	// Validate authentication for sensitive operations
	if (includeMetadata && !validateKey(authKey)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		let result;

		if (category) {
			// Get settings for specific category
			result = await databaseManager.getSettingsByCategory(category);
		} else if (includeMetadata) {
			// Get all settings with metadata (admin only)
			const allSettings = await databaseManager.getAllSettings();
			result = { categories: allSettings };
		} else {
			// Get all settings without metadata (public)
			const categories = ['global', 'claude'];
			result = {};
			for (const cat of categories) {
				const settings = await databaseManager.getSettingsByCategory(cat);
				result[cat] = settings;
			}
		}

		return json(result);
	} catch (error) {
		console.error('Failed to get settings:', error);
		return json({ error: 'Failed to retrieve settings' }, { status: 500 });
	}
}

/**
 * POST - Update settings
 * Body: { category, settings, description? }
 */
export async function POST({ request, locals }) {
	const databaseManager = locals.services?.database;
	if (!databaseManager) {
		return json({ error: 'Database service not available' }, { status: 500 });
	}

	try {
		const body = await request.json();

		// Get auth key from body or headers
		let authKey = body.authKey;
		if (!authKey) {
			const auth = request.headers.get('authorization');
			if (auth && auth.startsWith('Bearer ')) {
				authKey = auth.slice(7);
			}
		}

		// Validate authentication for write operations
		if (!validateKey(authKey)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { category, settings, description } = body;
		if (!category || !settings || typeof settings !== 'object') {
			return json(
				{ error: 'Missing required fields: category, settings (object)' },
				{ status: 400 }
			);
		}

		await databaseManager.setSettingsForCategory(category, settings, description);

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update settings:', error);
		return json({ error: 'Failed to update settings' }, { status: 500 });
	}
}

/**
 * DELETE - Delete settings category
 * Query parameters:
 * - category: Settings category to delete
 */
export async function DELETE({ url, request, locals }) {
	const databaseManager = locals.services?.database;
	if (!databaseManager) {
		return json({ error: 'Database service not available' }, { status: 500 });
	}

	const category = url.searchParams.get('category');
	if (!category) {
		return json({ error: 'Missing category parameter' }, { status: 400 });
	}

	// Get auth key from headers
	let authKey = null;
	const auth = request.headers.get('authorization');
	if (auth && auth.startsWith('Bearer ')) {
		authKey = auth.slice(7);
	}

	// Validate authentication
	if (!validateKey(authKey)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await databaseManager.deleteSettingsCategory(category);
		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete settings category:', error);
		return json({ error: 'Failed to delete settings category' }, { status: 500 });
	}
}
