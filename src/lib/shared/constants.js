/**
 * Centralized configuration constants for Dispatch
 * Single source of truth for all application constants
 */

export const UI_CONFIG = {
	// Responsive breakpoints
	DESKTOP_BREAKPOINT: 1024,
	TABLET_BREAKPOINT: 768,
	MOBILE_BREAKPOINT: 480,

	// Mobile-specific
	MOBILE_KEYBOARD_HEIGHT: 300,
	TOUCH_TARGET_MIN: 44,

	// Animation and timing
	ANIMATION_DURATION: 200,
	DEBOUNCE_DELAY: 300,
	TOAST_DURATION: 5000,

	// Layout
	SIDEBAR_WIDTH: 280,
	HEADER_HEIGHT: 60,
	FOOTER_HEIGHT: 40
};

export const STORAGE_CONFIG = {
	// localStorage keys
	AUTH_TOKEN_KEY: 'dispatch-auth-token',
	SESSION_ID_KEY: 'dispatch-session-id',
	THEME_KEY: 'dispatch-theme',
	SETTINGS_KEY: 'dispatch-settings',

	// Session storage keys
	TEMP_DATA_KEY: 'dispatch-temp',
	NAVIGATION_STATE_KEY: 'dispatch-nav',

	// Storage limits (in bytes)
	MAX_STORAGE_SIZE: 10 * 1024 * 1024, // 10MB
	WARN_STORAGE_SIZE: 8 * 1024 * 1024 // 8MB
};

export const VALIDATION_CONFIG = {
	// Input validation
	MIN_PASSWORD_LENGTH: 8,
	MAX_PASSWORD_LENGTH: 128,
	MAX_USERNAME_LENGTH: 50,

	// Session validation
	SESSION_ID_PATTERN: /^[a-zA-Z0-9-_]{8,64}$/,
	SESSION_NAME_PATTERN: /^[a-zA-Z0-9\s\-_.]{1,100}$/,

	// Terminal validation
	ALLOWED_MODES: ['claude', 'shell'],

	// File validation
	MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
	ALLOWED_FILE_TYPES: ['text/*', 'application/json', 'application/javascript']
};

export const ERROR_CODES = {
	// Authentication errors
	AUTH_REQUIRED: 'AUTH_REQUIRED',
	AUTH_FAILED: 'AUTH_FAILED',
	AUTH_EXPIRED: 'AUTH_EXPIRED',

	// Session errors
	SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
	SESSION_ENDED: 'SESSION_ENDED',
	SESSION_LIMIT_EXCEEDED: 'SESSION_LIMIT_EXCEEDED',

	// Terminal errors
	TERMINAL_CREATE_FAILED: 'TERMINAL_CREATE_FAILED',
	TERMINAL_ATTACH_FAILED: 'TERMINAL_ATTACH_FAILED',
	TERMINAL_INPUT_INVALID: 'TERMINAL_INPUT_INVALID',

	// Validation errors
	VALIDATION_FAILED: 'VALIDATION_FAILED',
	INVALID_INPUT: 'INVALID_INPUT',
	INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',

	// System errors
	STORAGE_FULL: 'STORAGE_FULL',
	NETWORK_ERROR: 'NETWORK_ERROR',
	UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export const PROJECT_CONFIG = {
	// Project sandboxing configuration
	DEFAULT_SANDBOX_ENABLED: true,

	// Configuration directories to copy from host home to project home
	CONFIG_DIRS_TO_COPY: [
		'.claude',
		'.config/gh', // GitHub CLI config
		'.config/git' // Git config
	],

	// Configuration files to copy from host home to project home
	CONFIG_FILES_TO_COPY: ['.gitconfig', '.bashrc', '.profile', '.bash_profile', '.vimrc', '.zshrc'],

	// Permissions for copied config files
	CONFIG_FILE_MODE: 0o644,
	CONFIG_DIR_MODE: 0o755
};

export const TUNNEL_CONFIG = {
	// LocalTunnel configuration
	TUNNEL_TIMEOUT: 10000,
	TUNNEL_RETRY_ATTEMPTS: 3
};
