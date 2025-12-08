/**
 * Session type constants
 * Simplified to core types: Terminal and AI (powered by OpenCode)
 *
 * v2.0 Hard Fork: OpenCode-first architecture
 * - TERMINAL: Shell/PTY sessions
 * - AI: OpenCode-powered AI agent sessions (replaces claude, opencode, opencode-tui)
 * - FILE_EDITOR: File editing sessions (kept for direct file editing)
 */

export const SESSION_TYPE = {
	/** Terminal/PTY sessions */
	TERMINAL: 'terminal',
	/** AI agent sessions powered by OpenCode */
	AI: 'ai',
	/** File editor sessions */
	FILE_EDITOR: 'file-editor',

	// Legacy aliases for migration compatibility (will be removed)
	/** @deprecated Use TERMINAL instead */
	PTY: 'terminal',
	/** @deprecated Use AI instead */
	CLAUDE: 'ai',
	/** @deprecated Use AI instead */
	OPENCODE: 'ai',
	/** @deprecated Use AI instead */
	OPENCODE_TUI: 'ai'
};

/**
 * Canonical session types (excludes deprecated aliases)
 */
export const CANONICAL_SESSION_TYPES = ['terminal', 'ai', 'file-editor'];

/**
 * Valid session types as an array (includes aliases for migration)
 */
export const VALID_SESSION_TYPES = [...new Set(Object.values(SESSION_TYPE))];

/**
 * Check if a value is a valid session type
 * @param {string} type
 * @returns {boolean}
 */
export function isValidSessionType(type) {
	return VALID_SESSION_TYPES.includes(type);
}

/**
 * Normalize legacy session types to canonical types
 * @param {string} type - Session type (may be legacy)
 * @returns {string} - Canonical session type
 */
export function normalizeSessionType(type) {
	// Map legacy types to canonical types
	const legacyMap = {
		'pty': 'terminal',
		'claude': 'ai',
		'opencode': 'ai',
		'opencode-tui': 'ai'
	};
	return legacyMap[type] || type;
}
