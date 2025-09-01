/**
 * Centralized configuration constants for Dispatch
 * Single source of truth for all application constants
 */

export const TERMINAL_CONFIG = {
  // History and buffer limits
  MAX_HISTORY_ENTRIES: 5000,
  MAX_BUFFER_LENGTH: 500000,
  MAX_CHAT_EVENTS: 300000,
  
  // Terminal dimensions
  DEFAULT_DIMENSIONS: { cols: 80, rows: 24 },
  MIN_COLS: 1,
  MAX_COLS: 500,
  MIN_ROWS: 1,
  MAX_ROWS: 200,
  
  // Timing and performance
  FIT_DELAY_MS: 100,
  BUFFER_TRIM_RATIO: 0.8,
  MIN_UPDATE_INTERVAL: 100,
  SAVE_DEBOUNCE_MS: 500,
  
  // Buffer cache optimization
  MAX_BUFFER_CACHE_SIZE: 10,
  BUFFER_CHANGE_THRESHOLD: 100,
  
  // Limits and constraints
  MAX_TERMINALS: 4,
  MIN_PANE_SIZE: 100,
  MAX_INPUT_LENGTH: 10000,
  MAX_SESSION_NAME_LENGTH: 100,
  
  // Socket and network
  SOCKET_TIMEOUT: 30000,
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 1000
};

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
  
  // Key prefixes
  SESSION_HISTORY_PREFIX: 'dispatch-session-history-',
  TERMINAL_STATE_PREFIX: 'dispatch-terminal-',
  
  // Storage limits (in bytes)
  MAX_STORAGE_SIZE: 10 * 1024 * 1024, // 10MB
  WARN_STORAGE_SIZE: 8 * 1024 * 1024   // 8MB
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

// Backwards compatibility - export individual constants for gradual migration
export const MAX_HISTORY_ENTRIES = TERMINAL_CONFIG.MAX_HISTORY_ENTRIES;
export const MAX_BUFFER_LENGTH = TERMINAL_CONFIG.MAX_BUFFER_LENGTH;
export const MAX_CHAT_EVENTS = TERMINAL_CONFIG.MAX_CHAT_EVENTS;
export const DEFAULT_DIMENSIONS = TERMINAL_CONFIG.DEFAULT_DIMENSIONS;
export const DESKTOP_BREAKPOINT = UI_CONFIG.DESKTOP_BREAKPOINT;