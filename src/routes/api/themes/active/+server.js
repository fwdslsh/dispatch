import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';

const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

/**
 * Resolve active theme using hierarchy:
 * 1. Workspace override (if workspaceId provided)
 * 2. Global default from user preferences (themes category)
 * 3. Fallback theme (hardcoded Phosphor Green)
 *
 * @param {Object} database - DatabaseManager instance
 * @param {Object} themeManager - ThemeManager instance
 * @param {string|null} workspaceId - Optional workspace ID
 * @returns {Promise<Object>} Resolved theme with metadata and CSS variables
 */
async function resolveActiveTheme(database, themeManager, workspaceId) {
	// 1. Check workspace override if workspaceId provided
	if (workspaceId) {
		try {
			const workspace = await database.get(
				'SELECT theme_override FROM workspaces WHERE id = ?',
				[workspaceId]
			);

			if (workspace?.theme_override) {
				// Remove .json extension if present for theme lookup
				const themeId = workspace.theme_override.replace('.json', '');
				const theme = await themeManager.getTheme(themeId);

				if (theme) {
					return theme;
				}
			}
		} catch (error) {
			console.error('[ThemeActive] Failed to check workspace override:', error);
		}
	}

	// 2. Check global default from user_preferences
	try {
		const prefs = await database.getUserPreferences('themes');

		if (prefs?.globalDefault) {
			// Remove .json extension if present for theme lookup
			const themeId = prefs.globalDefault.replace('.json', '');
			const theme = await themeManager.getTheme(themeId);

			if (theme) {
				return theme;
			}
		}
	} catch (error) {
		console.error('[ThemeActive] Failed to check global default:', error);
	}

	// 3. Fallback to hardcoded theme
	return themeManager.getFallbackTheme();
}

export async function GET({ url, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	// Get optional workspaceId from query params
	const workspaceId = url.searchParams.get('workspaceId');

	// Get services from locals
	const database = locals.services.database;

	// Initialize theme manager
	await themeManager.initialize();

	// Resolve active theme using hierarchy
	const theme = await resolveActiveTheme(database, themeManager, workspaceId);

	// Return resolved theme
	return json({ theme });
}
