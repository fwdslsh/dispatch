/**
 * Authentication timeout constants
 * Centralized timeout values for authentication flows
 */

/**
 * Claude OAuth authentication timeouts
 */
export const CLAUDE_AUTH_TIMEOUTS = {
	/** Timeout for initial OAuth flow start request (30 seconds) */
	OAUTH_START: 30000,

	/** Timeout for authorization code submission (30 seconds) */
	CODE_SUBMIT: 30000,

	/** PTY watchdog timeout for CLI authentication (25 seconds) */
	CLI_WATCHDOG: 25000,

	/** Stale PTY session cleanup threshold (5 minutes) */
	STALE_SESSION_THRESHOLD: 5 * 60 * 1000
};

/**
 * General authentication timeouts
 */
export const AUTH_TIMEOUTS = {
	/** Session validation check interval (60 seconds) */
	SESSION_CHECK_INTERVAL: 60000,

	/** API request timeout (10 seconds) */
	API_REQUEST: 10000,

	/** Logout request timeout (5 seconds) */
	LOGOUT: 5000
};
