/**
 * OAuth error handling utilities
 * Maps OAuth error codes to user-friendly messages and provides recovery suggestions
 */

/**
 * OAuth error types and their user-friendly messages
 */
export const OAUTH_ERROR_MESSAGES = {
	// General OAuth errors
	oauth_error: 'OAuth authentication failed',
	oauth_invalid_callback: 'Invalid OAuth callback parameters',
	oauth_invalid_state: 'Invalid or expired authentication request',
	oauth_token_exchange: 'Failed to exchange authorization code for tokens',
	oauth_profile_fetch: 'Failed to retrieve user profile from provider',
	oauth_callback: 'OAuth authentication callback failed',

	// Provider-specific errors
	access_denied: 'You denied access to the application',
	invalid_request: 'Invalid OAuth request parameters',
	unauthorized_client: 'Application is not authorized for this OAuth provider',
	unsupported_response_type: 'OAuth response type not supported',
	invalid_scope: 'Invalid OAuth scope requested',
	server_error: 'OAuth provider server error',
	temporarily_unavailable: 'OAuth provider temporarily unavailable',

	// Configuration errors
	oauth_config_missing: 'OAuth configuration is missing',
	provider_disabled: 'OAuth provider is currently disabled',
	provider_misconfigured: 'OAuth provider is not properly configured',

	// Token errors
	token_expired: 'OAuth token has expired',
	token_invalid: 'OAuth token is invalid',
	refresh_failed: 'Failed to refresh OAuth token',

	// Account errors
	account_already_linked: 'This OAuth account is already linked to another user',
	account_not_found: 'OAuth account not found',
	unlink_failed: 'Failed to unlink OAuth account',

	// Network/system errors
	network_error: 'Network error during OAuth authentication',
	system_error: 'System error during OAuth authentication'
};

/**
 * Recovery suggestions for different error types
 */
export const OAUTH_RECOVERY_SUGGESTIONS = {
	oauth_error: 'Please try signing in again',
	oauth_invalid_callback: 'Please start the login process again',
	oauth_invalid_state: 'Please start the login process again',
	oauth_token_exchange: 'Please try signing in again',
	oauth_profile_fetch: 'Please try signing in again',
	oauth_callback: 'Please try signing in again',

	access_denied: 'To continue, please allow access when prompted by the OAuth provider',
	invalid_request: 'Please try signing in again',
	unauthorized_client: 'Please contact support for assistance',
	unsupported_response_type: 'Please contact support for assistance',
	invalid_scope: 'Please contact support for assistance',
	server_error: 'Please try again in a few minutes',
	temporarily_unavailable: 'Please try again in a few minutes',

	oauth_config_missing: 'OAuth is not configured. Please contact support',
	provider_disabled: 'This OAuth provider is currently disabled',
	provider_misconfigured: 'OAuth provider configuration error. Please contact support',

	token_expired: 'Please sign in again to refresh your access',
	token_invalid: 'Please sign in again',
	refresh_failed: 'Please sign in again to refresh your access',

	account_already_linked: 'This account is already linked to another user. Try using a different account',
	account_not_found: 'OAuth account not found. Please try linking again',
	unlink_failed: 'Please try again or contact support',

	network_error: 'Please check your internet connection and try again',
	system_error: 'Please try again or contact support if the issue persists'
};

/**
 * Provider-specific error messages
 */
export const PROVIDER_ERROR_MESSAGES = {
	google: {
		invalid_client: 'Google OAuth application configuration error',
		invalid_grant: 'Invalid Google authorization code',
		redirect_uri_mismatch: 'Google OAuth redirect URI mismatch'
	},
	github: {
		bad_verification_code: 'Invalid GitHub authorization code',
		incorrect_client_credentials: 'GitHub OAuth application credentials error',
		redirect_uri_mismatch: 'GitHub OAuth redirect URI mismatch'
	}
};

/**
 * Parse OAuth error from URL parameters or error object
 */
export function parseOAuthError(urlParams, provider = null) {
	// Check URL parameters for errors
	if (urlParams) {
		const error = urlParams.get('error');
		const errorDescription = urlParams.get('error_description');
		const details = urlParams.get('details');

		if (error) {
			return {
				code: error,
				description: errorDescription || details,
				provider: urlParams.get('provider') || provider,
				isOAuthError: true
			};
		}
	}

	return null;
}

/**
 * Get user-friendly error message for OAuth error
 */
export function getOAuthErrorMessage(errorCode, provider = null, details = null) {
	// Check provider-specific errors first
	if (provider && PROVIDER_ERROR_MESSAGES[provider] && PROVIDER_ERROR_MESSAGES[provider][errorCode]) {
		return PROVIDER_ERROR_MESSAGES[provider][errorCode];
	}

	// Check general OAuth errors
	if (OAUTH_ERROR_MESSAGES[errorCode]) {
		return OAUTH_ERROR_MESSAGES[errorCode];
	}

	// Use details if available
	if (details) {
		return `OAuth error: ${details}`;
	}

	// Generic fallback
	return `OAuth authentication failed (${errorCode})`;
}

/**
 * Get recovery suggestion for OAuth error
 */
export function getOAuthRecoverySuggestion(errorCode) {
	return OAUTH_RECOVERY_SUGGESTIONS[errorCode] || 'Please try again or contact support if the issue persists';
}

/**
 * Format complete OAuth error for display
 */
export function formatOAuthError(errorCode, provider = null, details = null) {
	const message = getOAuthErrorMessage(errorCode, provider, details);
	const suggestion = getOAuthRecoverySuggestion(errorCode);
	const providerName = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'OAuth';

	return {
		title: `${providerName} Authentication Error`,
		message,
		suggestion,
		code: errorCode,
		provider,
		canRetry: !['unauthorized_client', 'unsupported_response_type', 'invalid_scope'].includes(errorCode)
	};
}

/**
 * Check if error is recoverable by user action
 */
export function isRecoverableOAuthError(errorCode) {
	const nonRecoverableErrors = [
		'unauthorized_client',
		'unsupported_response_type',
		'invalid_scope',
		'oauth_config_missing',
		'provider_misconfigured'
	];

	return !nonRecoverableErrors.includes(errorCode);
}

/**
 * Get appropriate retry delay for different error types
 */
export function getRetryDelay(errorCode) {
	const delays = {
		server_error: 30000,          // 30 seconds
		temporarily_unavailable: 60000, // 1 minute
		token_expired: 0,             // Immediate
		network_error: 5000,          // 5 seconds
		system_error: 10000           // 10 seconds
	};

	return delays[errorCode] || 0;
}

/**
 * Log OAuth error for debugging
 */
export function logOAuthError(error, context = {}) {
	const logData = {
		timestamp: new Date().toISOString(),
		error: error.code || error.message,
		provider: error.provider,
		details: error.details,
		context,
		userAgent: navigator.userAgent,
		url: window.location.href
	};

	console.error('OAuth Error:', logData);

	// Send to analytics/monitoring service if available
	if (window.analytics?.track) {
		window.analytics.track('OAuth Error', logData);
	}
}