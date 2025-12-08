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
import {
	ApiError,
	BadRequestError,
	UnauthorizedError,
	ForbiddenError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

// Initialize parser and theme manager as singletons
const parser = new XtermThemeParser();
const themeManager = new ThemeManager(parser);

export async function GET({ locals: _locals }) {
	try {
		// Public route - no auth required (accessible during onboarding)
		// Auth is optional - if provided, may enable additional features in future

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
	} catch (err) {
		handleApiError(err, 'GET /api/themes');
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
			throw new UnauthorizedError();
		}

		// Parse form data
		const formData = await request.formData();
		const file = formData.get('theme');

		if (!file) {
			throw new BadRequestError('No theme file provided', 'NO_FILE');
		}

		// Validate it's a File object
		if (!(file instanceof File)) {
			throw new BadRequestError('Invalid file upload', 'INVALID_FILE');
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
	} catch (err) {
		// Handle filesystem errors
		if (err.code === 'EACCES') {
			throw new ForbiddenError('Permission denied');
		}
		if (err.code === 'ENOSPC') {
			throw new ApiError('No space left on device', 507, 'INSUFFICIENT_STORAGE');
		}

		handleApiError(err, 'POST /api/themes');
	}
}
