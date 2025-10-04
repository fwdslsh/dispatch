/**
 * Themes API - List all available themes (preset + custom) and upload custom themes
 *
 * GET /api/themes - Returns all themes with metadata
 * POST /api/themes - Upload custom theme file
 * Authentication required via hooks middleware
 */

import { json } from '@sveltejs/kit';
import { ThemeManager } from '$lib/server/themes/ThemeManager.js';
import { XtermThemeParser } from '$lib/server/themes/XtermThemeParser.js';

// Initialize parser and theme manager as singletons
const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

export async function GET({ locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Initialize theme manager (safe to call multiple times)
		await themeManager.initialize();

		// Get all themes (preset + custom)
		const themes = await themeManager.listThemes();

		// Transform to API response format
		const themeList = themes.map((theme) => ({
			id: theme.id,
			name: theme.name,
			description: theme.description,
			source: theme.source,
			cssVariables: theme.cssVariables,
			lastModified: theme.lastModified
		}));

		return json({ themes: themeList });
	} catch (error) {
		console.error('[Themes API] Failed to list themes:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * POST /api/themes - Upload custom theme
 *
 * Accepts multipart/form-data with theme file
 * - Validates file size (max 5MB)
 * - Parses and validates theme content
 * - Saves to ~/.dispatch/themes/
 * - Returns validation result with errors/warnings
 */
export async function POST({ request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Parse form data
		const formData = await request.formData();
		const file = formData.get('theme');

		if (!file) {
			return json({ error: 'No theme file provided' }, { status: 400 });
		}

		// Validate it's a File object
		if (!(file instanceof File)) {
			return json({ error: 'Invalid file upload' }, { status: 400 });
		}

		// Read file content
		const content = await file.text();
		const filename = file.name;

		// Upload via ThemeManager (handles validation and size limits)
		await themeManager.initialize();
		const result = await themeManager.uploadTheme(filename, content);

		// Return result
		if (result.success) {
			return json(
				{
					success: true,
					themeId: result.themeId,
					name: result.name,
					warnings: result.warnings || []
				},
				{ status: 201 }
			);
		} else {
			return json(
				{
					success: false,
					errors: result.errors || [],
					warnings: result.warnings || []
				},
				{ status: 400 }
			);
		}
	} catch (error) {
		console.error('[Themes API] Theme upload error:', error);

		// Handle specific error types
		if (error.code === 'EACCES') {
			return json({ error: 'Permission denied' }, { status: 403 });
		}

		if (error.code === 'ENOSPC') {
			return json({ error: 'No space left on device' }, { status: 507 });
		}

		return json({ error: error.message || 'Failed to upload theme' }, { status: 500 });
	}
}
