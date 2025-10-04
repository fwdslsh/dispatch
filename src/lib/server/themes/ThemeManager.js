/**
 * Theme Manager - Centralized theme loading, caching, and CRUD operations
 *
 * Manages themes from two sources:
 * - Preset themes: static/themes/ (read-only, bundled with app)
 * - Custom themes: ~/.dispatch/themes/ (user-uploaded, writable)
 *
 * Features:
 * - In-memory caching with 5-minute TTL
 * - Automatic cache invalidation on CRUD operations
 * - Hardcoded fallback theme (Phosphor Green) for recovery scenarios
 * - Theme validation and deletion prevention
 */

import { promises as fs } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

/**
 * Hardcoded Phosphor Green theme - System fallback for recovery scenarios
 * Used when:
 * - All themes are deleted
 * - Theme files are corrupted
 * - Themes directory is missing
 * - Initial installation needs a default
 */
const FALLBACK_THEME = {
	name: 'Phosphor Green',
	description: 'Classic terminal phosphor green - the default Dispatch theme',
	background: '#0c1210',
	foreground: '#d9ffe6',
	cursor: '#2ee66b',
	cursorAccent: '#0c1210',
	selectionBackground: '#2ee66b40',
	black: '#121a17',
	red: '#ef476f',
	green: '#2ee66b',
	yellow: '#ffd166',
	blue: '#00c2ff',
	magenta: '#ff6b9d',
	cyan: '#56b6c2',
	white: '#cfe7d8',
	brightBlack: '#8aa699',
	brightRed: '#ef476f',
	brightGreen: '#4eff82',
	brightYellow: '#ffd166',
	brightBlue: '#00c2ff',
	brightMagenta: '#ff6b9d',
	brightCyan: '#56b6c2',
	brightWhite: '#d9ffe6'
};

/**
 * Expand tilde in file paths to user home directory
 * @param {string} filePath - Path potentially containing ~
 * @returns {string} Expanded absolute path
 */
function expandTilde(filePath) {
	if (!filePath || typeof filePath !== 'string') {
		return filePath;
	}

	if (filePath.startsWith('~/')) {
		return join(homedir(), filePath.slice(2));
	}

	if (filePath === '~') {
		return homedir();
	}

	return filePath;
}

/**
 * ThemeManager - Manages theme loading, caching, validation, and CRUD operations
 */
export class ThemeManager {
	/**
	 * Initialize ThemeManager with parser and optional custom paths
	 * @param {Object} parser - XtermThemeParser instance for theme parsing
	 * @param {Object} options - Configuration options
	 * @param {string} options.customThemesDir - Custom themes directory (default: ~/.dispatch/themes)
	 * @param {string} options.presetThemesDir - Preset themes directory (default: static/themes)
	 */
	constructor(parser, options = {}) {
		if (!parser) {
			throw new Error('ThemeManager requires a parser instance');
		}

		this.parser = parser;

		// Determine project root (where static/ directory is located)
		// In production: process.cwd() is the app root
		// In dev: need to ensure we're at project root
		const projectRoot = options.projectRoot || process.cwd();

		// Custom themes directory (user-uploaded themes)
		this.customThemesDir = options.customThemesDir
			? expandTilde(options.customThemesDir)
			: expandTilde('~/.dispatch/themes');

		// Preset themes directory (bundled themes)
		this.presetThemesDir = options.presetThemesDir
			? resolve(options.presetThemesDir)
			: resolve(projectRoot, 'static', 'themes');

		// In-memory cache: Map<themeId, ThemeMetadata>
		this.cache = new Map();
		this.lastCacheUpdate = 0;
		this.cacheTimeout = 5 * 60 * 1000; // 5 minutes in milliseconds
		this.isInitialized = false;

		// Cache reload synchronization (prevents race conditions)
		this.cacheReloadPromise = null;
	}

	/**
	 * Initialize theme manager: ensure directories exist, load themes into cache
	 */
	async initialize() {
		if (this.isInitialized) return;

		try {
			// Ensure custom themes directory exists
			await fs.mkdir(this.customThemesDir, { recursive: true });

			// Ensure presets exist (copy from static if needed)
			await this.ensurePresetsExist();

			// Load all themes into cache
			await this.loadThemes();

			this.isInitialized = true;
		} catch (error) {
			console.error('ThemeManager initialization failed:', error);
			throw error;
		}
	}

	/**
	 * Load themes from both preset and custom directories into cache
	 * Replaces entire cache with fresh data
	 */
	async loadThemes() {
		const themes = [];

		// Load preset themes (from static/themes/)
		try {
			const presetThemes = await this.loadFromDirectory(this.presetThemesDir, 'preset');
			themes.push(...presetThemes);
		} catch (error) {
			console.error('Failed to load preset themes:', error);
			// Continue - custom themes may still load
		}

		// Load custom themes (from ~/.dispatch/themes/)
		try {
			const customThemes = await this.loadFromDirectory(this.customThemesDir, 'custom');
			themes.push(...customThemes);
		} catch (error) {
			console.error('Failed to load custom themes:', error);
			// Continue - preset themes may have loaded
		}

		// If no themes loaded at all, ensure fallback exists
		if (themes.length === 0) {
			console.warn('No themes found, recreating fallback theme');
			await this.recreateFallbackTheme();
			const fallbackThemes = await this.loadFromDirectory(this.customThemesDir, 'custom');
			themes.push(...fallbackThemes);
		}

		// Update cache
		this.cache.clear();
		for (const theme of themes) {
			this.cache.set(theme.id, theme);
		}

		this.lastCacheUpdate = Date.now();
	}

	/**
	 * Load themes from a specific directory
	 * @param {string} dirPath - Directory to scan for theme files
	 * @param {'preset'|'custom'} source - Theme source type
	 * @returns {Promise<Array>} Array of ThemeMetadata objects
	 */
	async loadFromDirectory(dirPath, source) {
		const themes = [];

		// Check if directory exists
		if (!existsSync(dirPath)) {
			return themes;
		}

		try {
			const files = await fs.readdir(dirPath);

			for (const file of files) {
				// Only process .json files
				if (!file.endsWith('.json')) continue;

				const filePath = join(dirPath, file);
				const themeId = file.replace('.json', '');

				try {
					// Read and parse theme file
					const fileContent = await fs.readFile(filePath, 'utf-8');
					const themeData = this.parser.parse(fileContent);

					// Validate theme
					const validation = this.parser.validate(themeData);
					if (!validation.valid) {
						console.error(`Invalid theme ${themeId}:`, validation.errors);
						continue;
					}

					// Get file stats for lastModified
					const stats = await fs.stat(filePath);

					// Create theme metadata
					const metadata = {
						id: themeId,
						name: themeData.name || themeId,
						description: themeData.description || '',
						source,
						filePath,
						cssVariables: this.parser.toCssVariables(themeData),
						lastModified: stats.mtime,
						// Store raw theme data for potential re-export
						_rawTheme: themeData
					};

					themes.push(metadata);
				} catch (error) {
					console.error(`Failed to load theme ${file}:`, error);
					// Continue to next file
				}
			}
		} catch (error) {
			console.error(`Failed to read directory ${dirPath}:`, error);
		}

		return themes;
	}

	/**
	 * Get single theme by ID with cache check
	 * @param {string} themeId - Theme identifier (filename without .json)
	 * @returns {Promise<Object|null>} ThemeMetadata or null if not found
	 */
	async getTheme(themeId) {
		// Check cache validity - refresh if expired
		if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
			// If reload already in progress, wait for it
			if (this.cacheReloadPromise) {
				await this.cacheReloadPromise;
			} else {
				// Start new reload and track promise
				this.cacheReloadPromise = this.loadThemes().finally(() => {
					this.cacheReloadPromise = null;
				});
				await this.cacheReloadPromise;
			}
		}

		return this.cache.get(themeId) || null;
	}

	/**
	 * Get all themes from cache
	 * @returns {Promise<Array>} Array of all cached themes
	 */
	async listThemes() {
		// Check cache validity - refresh if expired
		if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
			// If reload already in progress, wait for it
			if (this.cacheReloadPromise) {
				await this.cacheReloadPromise;
			} else {
				// Start new reload and track promise
				this.cacheReloadPromise = this.loadThemes().finally(() => {
					this.cacheReloadPromise = null;
				});
				await this.cacheReloadPromise;
			}
		}

		return Array.from(this.cache.values());
	}

	/**
	 * Upload and save a new custom theme
	 * @param {string} filename - Theme filename (must end with .json)
	 * @param {string} content - Theme file content (JSON string)
	 * @returns {Promise<Object>} Result with success status, metadata, and validation info
	 */
	async uploadTheme(filename, content) {
		// Validate filename
		if (!filename.endsWith('.json')) {
			return {
				success: false,
				errors: ['Filename must end with .json'],
				warnings: []
			};
		}

		// Validate file size (5MB max)
		const fileSizeBytes = Buffer.byteLength(content, 'utf-8');
		const maxSizeBytes = 5 * 1024 * 1024; // 5MB
		if (fileSizeBytes > maxSizeBytes) {
			return {
				success: false,
				errors: [`File size ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB exceeds 5MB limit`],
				warnings: []
			};
		}

		// Parse and validate theme content
		let themeData;
		try {
			themeData = this.parser.parse(content);
		} catch (error) {
			return {
				success: false,
				errors: [`Invalid JSON: ${error.message}`],
				warnings: []
			};
		}

		const validation = this.parser.validate(themeData);
		if (!validation.valid) {
			return {
				success: false,
				errors: validation.errors,
				warnings: validation.warnings
			};
		}

		// Save theme file to custom themes directory
		const filePath = join(this.customThemesDir, filename);
		try {
			await fs.writeFile(filePath, content, 'utf-8');
		} catch (error) {
			return {
				success: false,
				errors: [`Failed to save theme: ${error.message}`],
				warnings: validation.warnings
			};
		}

		// Invalidate cache to force reload
		this.invalidateCache();

		// Return success with metadata
		const themeId = filename.replace('.json', '');
		return {
			success: true,
			themeId,
			name: themeData.name || themeId,
			errors: [],
			warnings: validation.warnings
		};
	}

	/**
	 * Delete a custom theme
	 * @param {string} themeId - Theme identifier to delete
	 * @returns {Promise<Object>} Result with success status and optional error
	 */
	async deleteTheme(themeId) {
		const theme = await this.getTheme(themeId);

		if (!theme) {
			return {
				success: false,
				error: 'Theme not found'
			};
		}

		// Cannot delete preset themes
		if (theme.source === 'preset') {
			return {
				success: false,
				error: 'Cannot delete preset themes'
			};
		}

		// Delete the file
		try {
			await fs.unlink(theme.filePath);

			// Invalidate cache
			this.invalidateCache();

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Failed to delete theme: ${error.message}`
			};
		}
	}

	/**
	 * Check if a theme can be deleted (not in use, not a preset)
	 * @param {string} themeId - Theme identifier to check
	 * @param {Object} database - DatabaseManager instance to check usage
	 * @returns {Promise<Object>} Object with canDelete flag and optional reason/details
	 */
	async canDelete(themeId, database) {
		const theme = await this.getTheme(themeId);

		if (!theme) {
			return {
				canDelete: false,
				reason: 'Theme not found'
			};
		}

		// Check if theme is a preset
		if (theme.source === 'preset') {
			return {
				canDelete: false,
				reason: 'Cannot delete preset themes'
			};
		}

		// Check if theme is global default
		try {
			const prefs = await database.getUserPreferences('themes');
			const globalDefault = prefs?.globalDefault;

			if (globalDefault === `${themeId}.json`) {
				return {
					canDelete: false,
					reason: 'Theme is currently set as global default'
				};
			}
		} catch (error) {
			console.error('Failed to check global default:', error);
		}

		// Check if theme is used by any workspace
		try {
			const workspaces = await database.all(
				'SELECT id, name FROM workspaces WHERE theme_override = ?',
				`${themeId}.json`
			);

			if (workspaces && workspaces.length > 0) {
				return {
					canDelete: false,
					reason: `Theme is used by ${workspaces.length} workspace(s)`,
					workspaces: workspaces.map((w) => ({ id: w.id, name: w.name }))
				};
			}
		} catch (error) {
			console.error('Failed to check workspace usage:', error);
		}

		return { canDelete: true };
	}

	/**
	 * Ensure preset themes exist in static directory
	 * If presets are missing, no action needed - they'll be bundled with app
	 * This method is kept for API compatibility but doesn't copy anything
	 */
	async ensurePresetsExist() {
		// Preset themes are bundled with the application in static/themes/
		// No need to copy them - they're loaded directly from preset directory
		// This ensures they maintain source='preset' and cannot be deleted

		// Just verify preset directory exists
		if (!existsSync(this.presetThemesDir)) {
			console.warn(`Preset themes directory not found: ${this.presetThemesDir}`);
		}
	}

	/**
	 * Recreate fallback theme from hardcoded constant
	 * Used for recovery when all themes are deleted or corrupted
	 * @returns {Promise<void>}
	 */
	async recreateFallbackTheme() {
		const fallbackPath = join(this.customThemesDir, 'phosphor-green.json');

		try {
			// Ensure directory exists
			await fs.mkdir(this.customThemesDir, { recursive: true });

			// Write hardcoded fallback theme
			await fs.writeFile(fallbackPath, JSON.stringify(FALLBACK_THEME, null, 2), 'utf-8');

			console.log('Recreated fallback theme: phosphor-green.json');
		} catch (error) {
			console.error('Failed to recreate fallback theme:', error);
			throw error;
		}
	}

	/**
	 * Get the fallback theme object (hardcoded Phosphor Green)
	 * @returns {Object} Fallback theme data
	 */
	getFallbackTheme() {
		return {
			id: 'phosphor-green',
			name: FALLBACK_THEME.name,
			description: FALLBACK_THEME.description,
			source: 'fallback',
			cssVariables: this.parser.toCssVariables(FALLBACK_THEME),
			_rawTheme: FALLBACK_THEME
		};
	}

	/**
	 * Invalidate cache - force reload on next access
	 */
	invalidateCache() {
		this.cache.clear();
		this.lastCacheUpdate = 0;
	}
}
