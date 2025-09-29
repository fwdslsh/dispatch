/**
 * Settings API Endpoints
 * GET /api/settings - Retrieve all settings or filtered by category
 * Using normalized settings system with SettingsManager
 */

import { json } from '@sveltejs/kit';
import { SettingsManager } from '../../../lib/server/settings/SettingsManager.js';
import { validateKey } from '../../../lib/server/shared/auth.js';

const settingsManager = new SettingsManager();

/**
 * GET /api/settings
 * Retrieve all configuration settings grouped by category
 */
export async function GET({ url }) {
	try {
		// Authenticate request
		const authKey = url.searchParams.get('authKey');
		if (!validateKey(authKey)) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		// Initialize settings manager
		await settingsManager.initialize();

		// Get category filter if provided
		const categoryFilter = url.searchParams.get('category');

		let result;
		if (categoryFilter) {
			// Return specific category
			const category = await settingsManager.getCategory(categoryFilter);
			if (!category) {
				return json({
					categories: [],
					settings: []
				});
			}

			const settings = await settingsManager.getSettings(categoryFilter);
			result = {
				categories: [category.toObject()],
				settings: settings.map((setting) => ({
					...setting.toObject(true),
					// Mask sensitive values for API response
					current_value:
						setting.is_sensitive && setting.current_value
							? setting.getDisplayValue()
							: setting.current_value,
					resolved_value: setting.is_sensitive
						? setting.getDisplayValue()
						: setting.getResolvedValue()
				}))
			};
		} else {
			// Return all settings grouped by category
			result = await settingsManager.getSettingsByCategory();

			// Mask sensitive values in the response
			result.settings = result.settings.map((setting) => {
				const configSetting = settingsManager.settingRepo.findByKey(setting.key);
				return {
					...setting,
					current_value:
						configSetting?.is_sensitive && setting.current_value
							? configSetting.getDisplayValue()
							: setting.current_value,
					resolved_value: configSetting?.is_sensitive
						? configSetting.getDisplayValue()
						: configSetting?.getResolvedValue()
				};
			});
		}

		return json(result, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		});
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
