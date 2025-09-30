/**
 * Cached terminal key value
 * Loaded on startup and updated when settings change
 */
let cachedTerminalKey = null;

/**
 * Initialize the terminal key cache with proper settings hierarchy
 * Should be called during application startup
 *
 * @param {Object} database - DatabaseManager instance for settings lookup
 * @returns {Promise<string>} The resolved terminal key
 */
export async function initializeTerminalKey(database = null) {
	let terminalKey;

	// Try to get from database first (using new unified settings table)
	if (database) {
		try {
			const authSettings = await database.getSettingsByCategory('authentication');
			if (authSettings && authSettings.terminal_key) {
				terminalKey = authSettings.terminal_key;
				cachedTerminalKey = terminalKey;
				console.log('[AUTH] Terminal key loaded from database settings');
				return terminalKey;
			}
		} catch (error) {
			// Fall through to environment variable if database lookup fails
			console.warn('[AUTH] Failed to get terminal_key from settings database:', error.message);
		}
	}

	// Fall back to environment variable
	if (process.env.TERMINAL_KEY) {
		terminalKey = process.env.TERMINAL_KEY;
		cachedTerminalKey = terminalKey;
		console.log('[AUTH] Terminal key loaded from environment variable');
		return terminalKey;
	}

	// Final fallback to default
	terminalKey = 'change-me';
	cachedTerminalKey = terminalKey;
	console.log('[AUTH] Terminal key using default value');
	return terminalKey;
}

/**
 * Update the cached terminal key
 * Should be called when settings are changed via the settings API
 *
 * @param {string} newKey - New terminal key value
 */
export function updateCachedTerminalKey(newKey) {
	cachedTerminalKey = newKey;
	console.log('[AUTH] Terminal key cache updated');
}

/**
 * Get the current cached terminal key
 * Falls back to environment variable if not initialized
 *
 * @returns {string} The cached terminal key
 */
export function getCachedTerminalKey() {
	if (cachedTerminalKey !== null) {
		return cachedTerminalKey;
	}

	// If not initialized, fall back to environment variable
	return process.env.TERMINAL_KEY || 'change-me';
}

/**
 * Get the terminal key following the proper settings hierarchy:
 * 1. Database configuration (settings table, authentication category)
 * 2. Environment variable (TERMINAL_KEY)
 * 3. Default value ('change-me')
 *
 * @param {Object} database - Optional DatabaseManager instance for database lookup
 * @returns {Promise<string>} The resolved terminal key
 * @deprecated Use getCachedTerminalKey() instead for synchronous access
 */
export async function getTerminalKey(database = null) {
	// If database is provided, try to get from database first
	if (database) {
		try {
			const authSettings = await database.getSettingsByCategory('authentication');
			if (authSettings && authSettings.terminal_key) {
				return authSettings.terminal_key;
			}
		} catch (error) {
			// Fall through to environment variable if database lookup fails
			console.warn('Failed to get terminal_key from settings:', error.message);
		}
	}

	// Fall back to environment variable
	if (process.env.TERMINAL_KEY) {
		return process.env.TERMINAL_KEY;
	}

	// Final fallback to default
	return 'change-me';
}

/**
 * Validate a key against the configured terminal key
 * Uses cached value from settings hierarchy (database > env > default)
 *
 * @param {string} key - Key to validate
 * @returns {boolean} True if valid
 */
export function validateKey(key) {
	const terminalKey = getCachedTerminalKey();

	// If terminal key is explicitly set to empty string, allow any key
	if (terminalKey === '') {
		return true;
	}

	return key === terminalKey;
}

/**
 * Require authentication, throwing error if invalid
 * Uses cached terminal key from settings hierarchy
 *
 * @param {string} key - Key to validate
 * @throws {Error} If authentication key is invalid
 */
export function requireAuth(key) {
	if (!validateKey(key)) {
		throw new Error('Invalid authentication key');
	}
}
