import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';

const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

export async function GET({ locals }) {
	const { settingsRepository } = locals.services;

	await themeManager.initialize();

	// Get global theme from settings
	try {
		const prefs = await settingsRepository.getByCategory('themes');
		if (prefs?.globalDefault) {
			const themeId = prefs.globalDefault.replace('.json', '');
			const theme = await themeManager.getTheme(themeId);
			if (theme) {
				return json({ theme });
			}
		}
	} catch (error) {
		console.error('[ThemeActive] Failed to get theme:', error);
	}

	// Fallback
	return json({ theme: themeManager.getFallbackTheme() });
}
