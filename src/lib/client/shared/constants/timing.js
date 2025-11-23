/**
 * Centralized timing constants for client-side operations
 * All values are in milliseconds
 */

// UI and interaction delays
export const COOKIE_PROPAGATION_DELAY = 100; // Delay after setting cookies to ensure browser propagation
export const STATUS_DISPLAY_DURATION = 3000; // Duration to display status messages
export const SESSION_STATUS_UPDATE_DELAY = 500; // Delay after session operations to ensure server updates

// Polling and retry intervals
export const SETTINGS_POLLING_INTERVAL = 50; // Interval for polling settings service state
export const API_POLLING_INTERVAL = 50; // Interval for polling API service state
export const PUBLIC_URL_POLL_INTERVAL = 5000; // Interval for polling public URL updates

// DOM and rendering delays
export const DOM_UPDATE_DELAY = 0; // Delay for DOM updates (e.g., auto-scroll after content update)
