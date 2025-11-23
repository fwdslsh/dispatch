import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';
import { logger } from '$lib/server/shared/utils/logger.js';
import { handleApiError } from '$lib/server/shared/utils/api-errors.js';

const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

/**
 * Resolve active theme using hierarchy:
 * 1. Workspace override (if workspaceId provided)
 * 2. Global default from user preferences (themes category)
 * 3. Fallback theme (hardcoded Phosphor Green)
 *
 * @param {Object} workspaceRepository - WorkspaceRepository instance
 * @param {Object} settingsRepository - SettingsRepository instance
 * @param {Object} themeManager - ThemeManager instance
 * @param {string|null} workspaceId - Optional workspace ID
 * @returns {Promise<Object>} Resolved theme with metadata and CSS variables
 */
async function resolveActiveTheme(
	workspaceRepository,
	settingsRepository,
	themeManager,
	workspaceId
) {
	// 1. Check workspace override if workspaceId provided
	if (workspaceId) {
		try {
			const workspace = await workspaceRepository.findById(workspaceId);

			if (workspace?.themeOverride) {
				// Remove .json extension if present for theme lookup
				const themeId = workspace.themeOverride.replace('.json', '');
				const theme = await themeManager.getTheme(themeId);

				if (theme) {
					return theme;
				}
			}
		} catch (error) {
			logger.warn('THEMES', 'Failed to check workspace override', { workspaceId, error: error.message });
		}
	}

	// 2. Check global default from user preferences (themes category in settings)
	try {
		const prefs = await settingsRepository.getByCategory('themes');

		if (prefs?.globalDefault) {
			// Remove .json extension if present for theme lookup
			const themeId = prefs.globalDefault.replace('.json', '');
			const theme = await themeManager.getTheme(themeId);

			if (theme) {
				return theme;
			}
		}
	} catch (error) {
		logger.warn('THEMES', 'Failed to check global default', { error: error.message });
	}

	// 3. Fallback to hardcoded theme
	return themeManager.getFallbackTheme();
}

export async function GET({ url, locals }) {
	try {
		// Get optional workspaceId from query params
		const workspaceId = url.searchParams.get('workspaceId');

		// Get repositories from locals
		const { workspaceRepository, settingsRepository } = locals.services;

		// Initialize theme manager
		await themeManager.initialize();

		// Resolve active theme using hierarchy
		const theme = await resolveActiveTheme(
			workspaceRepository,
			settingsRepository,
			themeManager,
			workspaceId
		);

		// Return resolved theme
		return json({ theme });
	} catch (err) {
		handleApiError(err, 'GET /api/themes/active');
	}
}
