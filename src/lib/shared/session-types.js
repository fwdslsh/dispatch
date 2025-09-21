/**
 * Session type constants
 * Simple constants for session types - no mapping, no aliases
 */

export const SESSION_TYPE = {
	PTY: 'pty',
	CLAUDE: 'claude',
	FILE_EDITOR: 'file-editor'
};

/**
 * Valid session types as an array
 */
export const VALID_SESSION_TYPES = Object.values(SESSION_TYPE);

/**
 * Check if a value is a valid session type
 * @param {string} type
 * @returns {boolean}
 */
export function isValidSessionType(type) {
	return VALID_SESSION_TYPES.includes(type);
}
