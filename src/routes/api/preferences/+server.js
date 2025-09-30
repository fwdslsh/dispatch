import { json } from '@sveltejs/kit';

/**
 * User Preferences API - Manages user-specific settings and preferences
 * Supporting authentication persistence and UI customization
 */

export async function GET({ request, url, locals }) {
	// Get auth key from Authorization header
	const authHeader = request.headers.get('Authorization');
	const authKey = authHeader?.replace('Bearer ', '');
	const category = url.searchParams.get('category');

	if (!locals.services.auth.validateKey(authKey)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	try {
		if (category) {
			// Get preferences for specific category
			const preferences = await locals.services.database.getUserPreferences(category);
			return json(preferences || {});
		} else {
			// Get all preferences grouped by category
			const allPreferences = await locals.services.database.getAllUserPreferences();
			return json(allPreferences || {});
		}
	} catch (error) {
		console.error('[Preferences API] Failed to get user preferences:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function PUT({ request, locals }) {
	try {
		// Get auth key from Authorization header
		const authHeader = request.headers.get('Authorization');
		const authKey = authHeader?.replace('Bearer ', '');

		if (!locals.services.auth.validateKey(authKey)) {
			return json({ error: 'Invalid authentication key' }, { status: 401 });
		}

		const body = await request.json();
		const { category, preferences } = body;

		if (!category) {
			return json({ error: 'Missing category parameter' }, { status: 400 });
		}

		if (!preferences || typeof preferences !== 'object') {
			return json({ error: 'Missing or invalid preferences object' }, { status: 400 });
		}

		// Validate known preference categories and their structure
		const validCategories = ['ui', 'auth', 'workspace', 'terminal', 'maintenance'];
		if (!validCategories.includes(category)) {
			return json({ error: 'Invalid preference category' }, { status: 400 });
		}

		// Category-specific validation
		if (category === 'auth') {
			// Validate auth preferences
			if (preferences.sessionDuration !== undefined) {
				if (
					!Number.isInteger(preferences.sessionDuration) ||
					preferences.sessionDuration < 1 ||
					preferences.sessionDuration > 365
				) {
					return json(
						{ error: 'Session duration must be between 1 and 365 days' },
						{ status: 400 }
					);
				}
			}
		}

		if (category === 'ui') {
			// Validate UI preferences
			if (
				preferences.theme !== undefined &&
				!['light', 'dark', 'auto'].includes(preferences.theme)
			) {
				return json({ error: 'Theme must be light, dark, or auto' }, { status: 400 });
			}
		}

		if (category === 'maintenance') {
			// Validate maintenance preferences (retention policy)
			if (preferences.sessionRetentionDays !== undefined) {
				if (
					!Number.isInteger(preferences.sessionRetentionDays) ||
					preferences.sessionRetentionDays < 1 ||
					preferences.sessionRetentionDays > 365
				) {
					return json(
						{ error: 'Session retention days must be between 1 and 365' },
						{ status: 400 }
					);
				}
			}
			if (preferences.logRetentionDays !== undefined) {
				if (
					!Number.isInteger(preferences.logRetentionDays) ||
					preferences.logRetentionDays < 1 ||
					preferences.logRetentionDays > 90
				) {
					return json({ error: 'Log retention days must be between 1 and 90' }, { status: 400 });
				}
			}
		}

		// Update preferences for category
		const updatedPreferences = await locals.services.database.updateUserPreferences(
			category,
			preferences
		);

		return json({
			success: true,
			category,
			preferences: updatedPreferences
		});
	} catch (error) {
		console.error('[Preferences API] Failed to update user preferences:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	try {
		// Get auth key from Authorization header
		const authHeader = request.headers.get('Authorization');
		const authKey = authHeader?.replace('Bearer ', '');

		if (!locals.services.auth.validateKey(authKey)) {
			return json({ error: 'Invalid authentication key' }, { status: 401 });
		}

		const body = await request.json();
		const { action } = body;

		if (action === 'reset') {
			const { category } = body;

			if (!category) {
				return json({ error: 'Missing category parameter for reset action' }, { status: 400 });
			}

			// Reset preferences for category to defaults
			const defaultPreferences = getDefaultPreferences(category);
			const resetPreferences = await locals.services.database.updateUserPreferences(
				category,
				defaultPreferences
			);

			return json({
				success: true,
				category,
				preferences: resetPreferences
			});
		}

		if (action === 'export') {
			// Export all preferences for backup/migration
			const allPreferences = await locals.services.database.getAllUserPreferences();

			return json({
				success: true,
				preferences: allPreferences,
				exportedAt: new Date().toISOString()
			});
		}

		if (action === 'import') {
			const { preferences } = body;

			if (!preferences || typeof preferences !== 'object') {
				return json({ error: 'Missing or invalid preferences object for import' }, { status: 400 });
			}

			// Import preferences, validating each category
			const results = {};
			for (const [category, categoryPrefs] of Object.entries(preferences)) {
				try {
					results[category] = await locals.services.database.updateUserPreferences(
						category,
						categoryPrefs
					);
				} catch (error) {
					console.warn(`[Preferences API] Failed to import category ${category}:`, error);
					results[category] = { error: error.message };
				}
			}

			return json({
				success: true,
				importResults: results
			});
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('[Preferences API] Failed to execute preference action:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * Get default preferences for a category
 * @param {string} category - Preference category
 * @returns {object} Default preferences
 */
function getDefaultPreferences(category) {
	const defaults = {
		ui: {
			theme: 'auto',
			showWorkspaceInTitle: true,
			autoHideInactiveTabsMinutes: 0
		},
		auth: {
			sessionDuration: 30,
			rememberLastWorkspace: true
		},
		workspace: {
			defaultPath: '',
			autoCreateMissingDirectories: true
		},
		terminal: {
			fontSize: 14,
			fontFamily: 'Monaco, monospace',
			scrollback: 1000
		},
		maintenance: {
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		}
	};

	return defaults[category] || {};
}
