/**
 * Color Utilities
 *
 * Provides color parsing, manipulation, and derivation utilities
 * for dynamic theme integration.
 */

/**
 * Parse hex color to RGB components
 * @param {string} hex - Hex color string (#RRGGBB or #RGB)
 * @returns {{r: number, g: number, b: number} | null} RGB object or null if invalid
 */
export function parseHexColor(hex) {
	if (!hex || typeof hex !== 'string') return null;

	// Remove # if present
	const cleanHex = hex.replace(/^#/, '');

	// Handle 3-digit hex
	if (cleanHex.length === 3) {
		const r = parseInt(cleanHex[0] + cleanHex[0], 16);
		const g = parseInt(cleanHex[1] + cleanHex[1], 16);
		const b = parseInt(cleanHex[2] + cleanHex[2], 16);

		if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
		return { r, g, b };
	}

	// Handle 6-digit hex
	if (cleanHex.length === 6) {
		const r = parseInt(cleanHex.slice(0, 2), 16);
		const g = parseInt(cleanHex.slice(2, 4), 16);
		const b = parseInt(cleanHex.slice(4, 6), 16);

		if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
		return { r, g, b };
	}

	return null;
}

/**
 * Convert RGB to hex color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string
 */
export function rgbToHex(r, g, b) {
	const toHex = (n) => {
		const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Derive UI color palette from terminal theme colors
 * Maps terminal colors to UI design tokens
 *
 * @param {Object} terminalTheme - Terminal theme CSS variables
 * @returns {Object} UI design token CSS variables
 */
export function deriveUIColors(terminalTheme) {
	if (!terminalTheme) {
		return {};
	}

	const uiColors = {};

	// Extract base terminal colors
	const background = terminalTheme['--theme-background'];
	const foreground = terminalTheme['--theme-foreground'];
	const cursor = terminalTheme['--theme-cursor'];
	const ansiGreen = terminalTheme['--theme-ansi-green'];
	const ansiRed = terminalTheme['--theme-ansi-red'];
	const ansiYellow = terminalTheme['--theme-ansi-yellow'];
	const ansiBlue = terminalTheme['--theme-ansi-blue'];
	const ansiCyan = terminalTheme['--theme-ansi-cyan'];
	const ansiMagenta = terminalTheme['--theme-ansi-magenta'];

	// Surface colors - Use terminal background as foundation
	if (background) {
		uiColors['--bg'] = background;
		// Derive slightly lighter surface using color-mix
		uiColors['--surface'] = `color-mix(in oklab, ${background} 95%, ${foreground || '#ffffff'} 5%)`;
		uiColors['--elev'] = `color-mix(in oklab, ${background} 90%, ${foreground || '#ffffff'} 10%)`;
	}

	// Text colors - Use terminal foreground
	if (foreground) {
		uiColors['--text'] = foreground;
		uiColors['--muted'] = `color-mix(in oklab, ${foreground} 60%, ${background || '#000000'} 40%)`;
		uiColors['--text-dim'] = `color-mix(in oklab, ${foreground} 40%, transparent 60%)`;
	}

	// Primary brand color - Use terminal cursor (typically the accent color)
	if (cursor) {
		uiColors['--primary'] = cursor;
		uiColors['--primary-bright'] = `color-mix(in oklab, ${cursor} 90%, white 10%)`;
		uiColors['--primary-dim'] = `color-mix(in oklab, ${cursor} 70%, black 30%)`;
		uiColors['--primary-muted'] = `color-mix(in oklab, ${cursor} 50%, transparent 50%)`;

		// Primary color family (opacity variants for glows/shadows)
		uiColors['--primary-glow'] = `color-mix(in oklab, ${cursor} 30%, transparent)`;
		uiColors['--primary-glow-10'] = `color-mix(in oklab, ${cursor} 10%, transparent)`;
		uiColors['--primary-glow-15'] = `color-mix(in oklab, ${cursor} 15%, transparent)`;
		uiColors['--primary-glow-20'] = `color-mix(in oklab, ${cursor} 20%, transparent)`;
		uiColors['--primary-glow-25'] = `color-mix(in oklab, ${cursor} 25%, transparent)`;
		uiColors['--primary-glow-30'] = `color-mix(in oklab, ${cursor} 30%, transparent)`;
		uiColors['--primary-glow-40'] = `color-mix(in oklab, ${cursor} 40%, transparent)`;
		uiColors['--primary-glow-50'] = `color-mix(in oklab, ${cursor} 50%, transparent)`;
		uiColors['--primary-glow-60'] = `color-mix(in oklab, ${cursor} 60%, transparent)`;
	}

	// Accent color - Use ANSI green (classic terminal accent)
	if (ansiGreen || cursor) {
		const accentColor = ansiGreen || cursor;
		uiColors['--accent'] = accentColor;
		uiColors['--color-primary'] = accentColor;
	}

	// Secondary accent - Use ANSI yellow
	if (ansiYellow) {
		uiColors['--accent-amber'] = ansiYellow;
	}

	// Semantic status colors - Map to appropriate ANSI colors
	if (ansiGreen) {
		uiColors['--ok'] = ansiGreen;
		uiColors['--success'] = ansiGreen;
	}

	if (ansiYellow) {
		uiColors['--warn'] = ansiYellow;
		uiColors['--warning'] = ansiYellow;
	}

	if (ansiRed) {
		uiColors['--err'] = ansiRed;
		uiColors['--error'] = ansiRed;
		uiColors['--secondary'] = ansiRed;
		uiColors['--err-dim'] = `color-mix(in oklab, ${ansiRed} 60%, transparent)`;
	}

	if (ansiBlue) {
		uiColors['--info'] = ansiBlue;
	}

	// Additional accent colors from ANSI palette
	if (ansiCyan) {
		uiColors['--accent-cyan'] = ansiCyan;
	}

	if (ansiMagenta) {
		uiColors['--accent-magenta'] = ansiMagenta;
	}

	// Derived colors using color-mix
	if (foreground) {
		uiColors['--line'] = `color-mix(in oklab, ${foreground} 20%, transparent)`;
	}

	if (cursor || ansiGreen) {
		const baseAccent = cursor || ansiGreen;
		uiColors['--glow'] = `color-mix(in oklab, ${baseAccent} 40%, transparent)`;
		uiColors['--focus'] = `color-mix(in oklab, ${baseAccent} 80%, white 10%)`;
	}

	// Surface mixing variants (for subtle backgrounds)
	if (background && (cursor || ansiGreen)) {
		const primary = cursor || ansiGreen;
		uiColors['--surface-primary-92'] = `color-mix(in oklab, ${background} 92%, ${primary} 8%)`;
		uiColors['--surface-primary-95'] = `color-mix(in oklab, ${background} 95%, ${primary} 5%)`;
		uiColors['--surface-primary-96'] = `color-mix(in oklab, ${background} 96%, ${primary} 4%)`;
		uiColors['--surface-primary-98'] = `color-mix(in oklab, ${background} 98%, ${primary} 2%)`;
		uiColors['--primary-surface-8'] = `color-mix(in oklab, ${primary} 8%, ${background})`;
		uiColors['--primary-surface-15'] = `color-mix(in oklab, ${primary} 15%, ${background})`;
		uiColors['--primary-surface-25'] = `color-mix(in oklab, ${primary} 25%, ${background})`;
	}

	// Component aliases (maintain existing names for compatibility)
	if (foreground) {
		uiColors['--text-primary'] = foreground;
		const muted = uiColors['--muted'] || `color-mix(in oklab, ${foreground} 60%, transparent)`;
		uiColors['--text-secondary'] = muted;
		uiColors['--text-muted'] = muted;
	}

	if (background) {
		uiColors['--bg-dark'] = background;
		uiColors['--bg-light'] = `color-mix(in oklab, ${background} 50%, white 50%)`;
		uiColors['--bg-panel'] = uiColors['--surface'] || background;
		uiColors['--surface-hover'] = uiColors['--elev'] || background;
		uiColors['--surface-border'] =
			uiColors['--line'] || `color-mix(in oklab, ${background} 80%, white 20%)`;
	}

	if (cursor || ansiGreen) {
		const primary = cursor || ansiGreen;
		uiColors['--primary-dim'] = `color-mix(in oklab, ${primary} 60%, transparent)`;
		uiColors['--scan-line'] = `color-mix(in oklab, ${primary} 5%, transparent)`;
	}

	return uiColors;
}

/**
 * Extract RGB values as string for rgba() usage
 * @param {string} hexColor - Hex color string
 * @returns {string} RGB values as "r, g, b" or empty string if invalid
 */
export function extractRgbString(hexColor) {
	const rgb = parseHexColor(hexColor);
	if (!rgb) return '';
	return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

/**
 * Update RGB CSS variables from theme colors
 * Enables rgba() usage with dynamic theme colors
 * @param {Object} terminalTheme - Terminal theme CSS variables
 * @returns {Object} RGB variable mappings
 */
export function deriveRgbVariables(terminalTheme) {
	const rgbVars = {};

	const cursor = terminalTheme['--theme-cursor'];
	const ansiGreen = terminalTheme['--theme-ansi-green'];

	if (cursor) {
		const primaryRgb = extractRgbString(cursor);
		if (primaryRgb) {
			rgbVars['--primary-rgb'] = primaryRgb;
		}
	}

	if (ansiGreen) {
		const successRgb = extractRgbString(ansiGreen);
		if (successRgb) {
			rgbVars['--success-rgb'] = successRgb;
		}
	}

	return rgbVars;
}

/**
 * Validate that a theme has required color properties
 * @param {Object} theme - Theme object to validate
 * @returns {{valid: boolean, missing: string[]}} Validation result
 */
export function validateThemeColors(theme) {
	const required = ['--theme-background', '--theme-foreground', '--theme-cursor'];

	const missing = required.filter((key) => !theme[key]);

	return {
		valid: missing.length === 0,
		missing
	};
}
