/**
 * Shared Authentication Constants
 * Used by both server and client code for consistent authentication behavior
 */

// Authentication providers
export const AUTH_PROVIDERS = ['api_key', 'oauth_github', 'oauth_google'];

// Session cookie name
export const COOKIE_NAME = 'dispatch_session';

// Session duration (30 days in milliseconds)
export const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 2,592,000,000 ms

// Session refresh window (24 hours in milliseconds)
// Sessions will be refreshed when within this window of expiration
export const REFRESH_WINDOW = 24 * 60 * 60 * 1000; // 86,400,000 ms

// API key length (32 bytes)
export const API_KEY_LENGTH = 32; // 256 bits

// bcrypt cost factor for API key hashing
export const BCRYPT_COST_FACTOR = 12;

/**
 * Authentication provider types
 */
export const AuthProvider = {
	API_KEY: 'api_key',
	OAUTH_GITHUB: 'oauth_github',
	OAUTH_GOOGLE: 'oauth_google'
};

/**
 * Check if a provider string is valid
 * @param {string} provider - Provider string to validate
 * @returns {boolean} True if valid provider
 */
export function isValidProvider(provider) {
	return AUTH_PROVIDERS.includes(provider);
}

/**
 * Get human-readable provider name
 * @param {string} provider - Provider constant
 * @returns {string} Human-readable name
 */
export function getProviderDisplayName(provider) {
	switch (provider) {
		case AuthProvider.API_KEY:
			return 'API Key';
		case AuthProvider.OAUTH_GITHUB:
			return 'GitHub OAuth';
		case AuthProvider.OAUTH_GOOGLE:
			return 'Google OAuth';
		default:
			return 'Unknown';
	}
}

/**
 * Calculate session expiration timestamp
 * @param {number} [baseTime=Date.now()] - Base timestamp (defaults to now)
 * @returns {number} Expiration timestamp (ms)
 */
export function calculateSessionExpiration(baseTime = Date.now()) {
	return baseTime + SESSION_DURATION;
}

/**
 * Check if session needs refresh
 * @param {number} expiresAt - Session expiration timestamp (ms)
 * @param {number} [now=Date.now()] - Current timestamp (defaults to now)
 * @returns {boolean} True if within refresh window
 */
export function needsSessionRefresh(expiresAt, now = Date.now()) {
	const timeUntilExpiry = expiresAt - now;
	return timeUntilExpiry < REFRESH_WINDOW && timeUntilExpiry > 0;
}

/**
 * Check if session is expired
 * @param {number} expiresAt - Session expiration timestamp (ms)
 * @param {number} [now=Date.now()] - Current timestamp (defaults to now)
 * @returns {boolean} True if expired
 */
export function isSessionExpired(expiresAt, now = Date.now()) {
	return now > expiresAt;
}
