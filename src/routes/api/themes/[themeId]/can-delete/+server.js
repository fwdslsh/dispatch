import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';

const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

export async function GET({ params, locals }) {
	// 1. Auth via centralized hooks (session cookie or API key)
	if (!locals.auth?.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// 2. Get themeId
	const { themeId } = params;

	// 3. Get settingsRepository and database from locals
	const { settingsRepository, database } = locals.services;

	// 4. Initialize and check deletion
	await themeManager.initialize();
	const result = await themeManager.canDelete(themeId, settingsRepository, database);

	// 5. Return result
	return json(result);
}
