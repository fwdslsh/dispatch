import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';

const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

export async function GET({ params, locals }) {
	// 1. Check auth (via middleware)
	if (!locals.auth?.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// 2. Get themeId from params
	const { themeId } = params;

	// 3. Initialize and get theme
	await themeManager.initialize();
	const theme = await themeManager.getTheme(themeId);

	// 4. Return theme or 404
	if (!theme) {
		return json({ error: 'Theme not found' }, { status: 404 });
	}

	return json({ theme });
}

export async function DELETE({ params, locals }) {
	// 1. Check auth (via middleware)
	if (!locals.auth?.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// 2. Get themeId
	const { themeId } = params;

	// 3. Initialize theme manager
	await themeManager.initialize();

	// 4. Delete theme (deleteTheme already checks if theme can be deleted)
	const result = await themeManager.deleteTheme(themeId);

	// 5. Return result
	if (result.success) {
		return json({ success: true }, { status: 200 });
	} else {
		return json(
			{
				success: false,
				error: result.error
			},
			{ status: 400 }
		);
	}
}
