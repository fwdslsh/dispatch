/**
 * Projects Feature Configuration
 * Constants and configuration for project management functionality
 */

export const PROJECT_VALIDATION = {
	NAME_MIN_LENGTH: 1,
	NAME_MAX_LENGTH: 50,
	NAME_PATTERN: /^[a-zA-Z0-9\s_-]*$/,
	DESCRIPTION_MAX_LENGTH: 200
};

export const PROJECT_DEFAULTS = {
	SESSION_TYPES: ['shell', 'claude'],
	DEFAULT_SESSION_TYPE: 'shell',
	DEFAULT_TERMINAL_COLS: 80,
	DEFAULT_TERMINAL_ROWS: 24
};

export const PROJECT_UI = {
	GRID_BREAKPOINT: '350px',
	MOBILE_BREAKPOINT: '768px',
	SMALL_MOBILE_BREAKPOINT: '480px'
};
