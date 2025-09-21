/**
 * Settings API
 * Manages server-side settings stored in the database
 */

import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/shared/auth.js';

/**
 * GET - Retrieve settings
 * Query parameters:
 * - category: Filter by category (optional)
 * - key: Get specific setting (optional)
 * - metadata: Include metadata (default: false)
 */
export async function GET({ url, locals }) {
	const databaseManager = locals.services?.database;
	if (!databaseManager) {
		return json({ error: 'Database service not available' }, { status: 500 });
	}

	const key = url.searchParams.get('key');
	const authKey = url.searchParams.get('authKey');
	const category = url.searchParams.get('category');
	const includeMetadata = url.searchParams.get('metadata') === 'true';

	// Validate authentication for sensitive operations
	if (includeMetadata && !validateKey(authKey)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		let result;

		if (key) {
			// Get specific setting
			const value = await databaseManager.getSetting(key);
			result = { [key]: value };
		} else if (category) {
			// Get settings by category
			result = await databaseManager.getSettingsByCategory(category);
		} else if (includeMetadata) {
			// Get all settings with metadata (admin only)
			const allSettings = await databaseManager.getAllSettings();
			result = { settings: allSettings };
		} else {
			// Get all settings without metadata (public)
			const categories = ['global', 'claude', 'terminal'];
			result = {};
			for (const cat of categories) {
				const settings = await databaseManager.getSettingsByCategory(cat);
				// Filter out sensitive settings for public access
				const filtered = {};
				for (const [k, v] of Object.entries(settings)) {
					// Don't expose API keys or other sensitive data in public endpoint
					if (!k.includes('apiKey') && !k.includes('secret') && !k.includes('token')) {
						filtered[k] = v;
					}
				}
				result[cat] = filtered;
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
 * Body: { key, value, category?, description?, isSensitive? } or { settings: [...] }
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

		if (body.settings && Array.isArray(body.settings)) {
			// Bulk update
			for (const setting of body.settings) {
				const { key, value, category, description, isSensitive = false } = setting;
				if (!key || !category) {
					continue; // Skip invalid entries
				}
				await databaseManager.setSetting(key, value, category, description, isSensitive);
			}
		} else {
			// Single setting update
			const { key, value, category, description, isSensitive = false } = body;
			if (!key || !category) {
				return json({ error: 'Missing required fields: key, category' }, { status: 400 });
			}
			await databaseManager.setSetting(key, value, category, description, isSensitive);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update settings:', error);
		return json({ error: 'Failed to update settings' }, { status: 500 });
	}
}

/**
 * DELETE - Delete setting
 * Query parameters:
 * - key: Setting key to delete
 */
export async function DELETE({ url, request, locals }) {
	const databaseManager = locals.services?.database;
	if (!databaseManager) {
		return json({ error: 'Database service not available' }, { status: 500 });
	}

	const key = url.searchParams.get('key');
	if (!key) {
		return json({ error: 'Missing setting key' }, { status: 400 });
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
		await databaseManager.deleteSetting(key);
		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete setting:', error);
		return json({ error: 'Failed to delete setting' }, { status: 500 });
	}
}