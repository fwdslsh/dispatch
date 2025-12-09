/**
 * Tab type constants
 * Defines the canonical types of tabs available in the application.
 *
 * - TERMINAL: Shell/PTY tabs for command-line access
 * - AI: AI agent tabs powered by OpenCode
 * - FILE_EDITOR: File editing tabs for direct file manipulation
 */

export const TAB_TYPE = {
	/** Terminal/PTY tabs */
	TERMINAL: 'terminal',
	/** AI agent tabs */
	AI: 'ai',
	/** File editor tabs */
	FILE_EDITOR: 'file-editor'
};

/**
 * All valid tab types as an array
 */
export const TAB_TYPES = Object.values(TAB_TYPE);

/**
 * Check if a value is a valid tab type
 * @param {string} type
 * @returns {boolean}
 */
export function isValidTabType(type) {
	return TAB_TYPES.includes(type);
}

/**
 * Get display name for a tab type
 * @param {string} type - Tab type
 * @returns {string} - Human-readable display name
 */
export function getTabTypeDisplayName(type) {
	const displayNames = {
		[TAB_TYPE.TERMINAL]: 'Terminal',
		[TAB_TYPE.AI]: 'AI Agent',
		[TAB_TYPE.FILE_EDITOR]: 'File Editor'
	};
	return displayNames[type] || type;
}

/**
 * Get icon name for a tab type
 * @param {string} type - Tab type
 * @returns {string} - Icon identifier
 */
export function getTabTypeIcon(type) {
	const icons = {
		[TAB_TYPE.TERMINAL]: 'terminal',
		[TAB_TYPE.AI]: 'robot',
		[TAB_TYPE.FILE_EDITOR]: 'file-edit'
	};
	return icons[type] || 'file';
}
