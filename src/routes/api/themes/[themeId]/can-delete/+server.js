import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';

const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

export async function GET({ params, url, locals }) {
	// 1. Check auth
	const authKey = url.searchParams.get('authKey');
	if (!authKey || authKey !== process.env.TERMINAL_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// 2. Get themeId
	const { themeId } = params;

	// 3. Get database from locals
	const database = locals.services.database;

	// 4. Initialize and check deletion
	await themeManager.initialize();
	const result = await themeManager.canDelete(themeId, database);

	// 5. Return result
	return json(result);
}
