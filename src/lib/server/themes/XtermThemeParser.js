/**
 * XtermThemeParser - Parses and validates xterm.js ITheme format
 *
 * Handles xterm theme format with:
 * - Required fields: background, foreground, 16 ANSI colors
 * - Optional fields: cursor, cursorAccent, selectionBackground, name, description
 * - Color format validation (hex, rgb, rgba, hsl, hsla)
 * - CSS variable transformation
 */

/**
 * XtermThemeParser - Concrete implementation for xterm.js theme format
 */
export class XtermThemeParser {
	/**
	 * Parse theme file content
	 * @param {string} fileContent - Raw theme file content (JSON)
	 * @returns {Object} Parsed theme object
	 * @throws {Error} If JSON is invalid
	 */
	parse(fileContent) {
		try {
			return JSON.parse(fileContent);
		} catch (error) {
			throw new Error(`Invalid JSON: ${error.message}`);
		}
	}

	/**
	 * Validate theme structure and color values
	 * @param {Object} theme - Parsed theme object
	 * @returns {Object} ValidationResult { valid: boolean, errors: string[], warnings: string[] }
	 */
	validate(theme) {
		const errors = [];
		const warnings = [];

		// Required fields
		const requiredFields = [
			'background',
			'foreground',
			// ANSI colors (16 required)
			'black',
			'red',
			'green',
			'yellow',
			'blue',
			'magenta',
			'cyan',
			'white',
			'brightBlack',
			'brightRed',
			'brightGreen',
			'brightYellow',
			'brightBlue',
			'brightMagenta',
			'brightCyan',
			'brightWhite'
		];

		// Check required fields exist
		for (const field of requiredFields) {
			if (!theme[field]) {
				errors.push(`Missing required field: ${field}`);
			}
		}

		// Color format validation regex
		// Supports: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla()
		const colorRegex = /^(#[0-9a-f]{3}([0-9a-f]{3}([0-9a-f]{2})?)?|rgba?\(|hsla?\()/i;

		// Validate color formats for all color fields
		const colorFields = [...requiredFields, 'cursor', 'cursorAccent', 'selectionBackground'];

		for (const field of colorFields) {
			const value = theme[field];
			if (value && typeof value === 'string' && !colorRegex.test(value)) {
				errors.push(`Invalid color format for ${field}: ${value}`);
			}
		}

		// Warnings for missing optional fields
		if (!theme.name) {
			warnings.push('Missing optional field: name (will use filename)');
		}
		if (!theme.cursor) {
			warnings.push('Missing optional field: cursor (will use foreground color)');
		}
		if (!theme.selectionBackground) {
			warnings.push(
				'Missing optional field: selectionBackground (will use cursor with transparency)'
			);
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Transform theme to CSS variables
	 * @param {Object} theme - Validated theme object
	 * @returns {Object} CSS variables object
	 */
	toCssVariables(theme) {
		const cssVars = {};

		// Terminal base colors
		cssVars['--theme-background'] = theme.background || '#000000';
		cssVars['--theme-foreground'] = theme.foreground || '#ffffff';

		// Cursor (use foreground as fallback)
		cssVars['--theme-cursor'] = theme.cursor || theme.foreground || '#ffffff';
		cssVars['--theme-cursor-accent'] = theme.cursorAccent || theme.background || '#000000';

		// Selection (use cursor with transparency as fallback)
		cssVars['--theme-selection-bg'] =
			theme.selectionBackground || (theme.cursor ? `${theme.cursor}40` : `${theme.foreground}40`);

		// ANSI colors (16 colors)
		const ansiMapping = {
			black: '--theme-ansi-black',
			red: '--theme-ansi-red',
			green: '--theme-ansi-green',
			yellow: '--theme-ansi-yellow',
			blue: '--theme-ansi-blue',
			magenta: '--theme-ansi-magenta',
			cyan: '--theme-ansi-cyan',
			white: '--theme-ansi-white',
			brightBlack: '--theme-ansi-bright-black',
			brightRed: '--theme-ansi-bright-red',
			brightGreen: '--theme-ansi-bright-green',
			brightYellow: '--theme-ansi-bright-yellow',
			brightBlue: '--theme-ansi-bright-blue',
			brightMagenta: '--theme-ansi-bright-magenta',
			brightCyan: '--theme-ansi-bright-cyan',
			brightWhite: '--theme-ansi-bright-white'
		};

		for (const [themeKey, cssVar] of Object.entries(ansiMapping)) {
			cssVars[cssVar] = theme[themeKey] || '#000000';
		}

		return cssVars;
	}
}
