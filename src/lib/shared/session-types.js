/**
 * Session type constants
 * OpenCode-first architecture with ephemeral windows
 *
 * v3.0 Architecture:
 * - AI: OpenCode-powered AI agent sessions (the ONLY persisted session type)
 * - TERMINAL: Ephemeral shell/PTY windows (not persisted)
 * - FILE_EDITOR: Ephemeral file editing windows (not persisted)
 *
 * "Sessions" = OpenCode sessions only
 * "Windows" = Terminal and File Editor (ephemeral, CWD-driven)
 */

export const SESSION_TYPE = {
	/** AI agent sessions powered by OpenCode - PERSISTED */
	AI: 'ai',
	/** OpenCode sessions with portal UI - PERSISTED */
	OPENCODE: 'opencode',
	/** Terminal/PTY windows - EPHEMERAL (not persisted) */
	TERMINAL: 'terminal',
	/** File editor windows - EPHEMERAL (not persisted) */
	FILE_EDITOR: 'file-editor',

	// Legacy aliases for migration compatibility (will be removed)
	/** @deprecated Use TERMINAL instead */
	PTY: 'terminal',
	/** @deprecated Use AI instead */
	CLAUDE: 'ai',
	/** @deprecated Use AI instead */
	OPENCODE_TUI: 'ai'
};

/**
 * Canonical session types (excludes deprecated aliases)
 */
export const CANONICAL_SESSION_TYPES = ['ai', 'opencode', 'terminal', 'file-editor'];

/**
 * Ephemeral session types - these are NOT persisted to DB
 * They exist only in memory and are lost when the process closes
 */
export const EPHEMERAL_SESSION_TYPES = ['terminal', 'file-editor'];

/**
 * Persistent session types - these ARE persisted to DB
 * OpenCode/AI sessions are persistent
 */
export const PERSISTENT_SESSION_TYPES = ['ai', 'opencode'];

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
 * Check if a session type is ephemeral (not persisted)
 * @param {string} type
 * @returns {boolean}
 */
export function isEphemeralSessionType(type) {
	const normalized = normalizeSessionType(type);
	return EPHEMERAL_SESSION_TYPES.includes(normalized);
}

/**
 * Check if a session type is persistent (persisted to DB)
 * @param {string} type
 * @returns {boolean}
 */
export function isPersistentSessionType(type) {
	const normalized = normalizeSessionType(type);
	return PERSISTENT_SESSION_TYPES.includes(normalized);
}

/**
 * Normalize legacy session types to canonical types
 * @param {string} type - Session type (may be legacy)
 * @returns {string} - Canonical session type
 */
export function normalizeSessionType(type) {
	// Map legacy types to canonical types
	const legacyMap = {
		pty: 'terminal',
		claude: 'ai',
		opencode: 'ai',
		'opencode-tui': 'ai'
	};
	return legacyMap[type] || type;
}
