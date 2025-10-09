/**
 * OAuthProviderModel - OAuth provider configuration data model
 * Defines OAuth provider specifications and metadata
 */

/**
 * OAuth provider configuration
 * @typedef {Object} OAuthProvider
 * @property {string} name - Provider display name
 * @property {string} [authUrl] - Authorization endpoint URL
 * @property {string} [tokenUrl] - Token endpoint URL
 * @property {string} defaultScopes - Default OAuth scopes
 * @property {Array<{value: string, label: string}>} scopeOptions - Available scope configurations
 * @property {string} [setupInstructions] - Setup instructions for this provider
 * @property {string} [docsUrl] - Documentation URL
 */

/**
 * OAuth provider registry
 * Contains provider-specific OAuth configurations
 */
export const OAuthProviders = {
	google: {
		name: 'Google',
		authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		defaultScopes: 'openid profile email',
		scopeOptions: [
			{ value: 'openid profile email', label: 'Basic profile and email' },
			{
				value: 'openid profile email https://www.googleapis.com/auth/drive.readonly',
				label: 'Profile + Drive read'
			},
			{
				value: 'openid profile email https://www.googleapis.com/auth/calendar.readonly',
				label: 'Profile + Calendar read'
			}
		],
		setupInstructions:
			'Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID',
		docsUrl: 'https://developers.google.com/identity/protocols/oauth2'
	},
	github: {
		name: 'GitHub',
		authUrl: 'https://github.com/login/oauth/authorize',
		tokenUrl: 'https://github.com/login/oauth/access_token',
		defaultScopes: 'read:user user:email',
		scopeOptions: [
			{ value: 'read:user user:email', label: 'Read user profile and email' },
			{ value: 'repo read:user user:email', label: 'Repository access + profile' },
			{
				value: 'repo read:user user:email workflow',
				label: 'Full repository and workflow access'
			}
		],
		setupInstructions: 'Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App',
		docsUrl: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps'
	},
	custom: {
		name: 'Custom Provider',
		defaultScopes: 'read write',
		scopeOptions: [
			{ value: 'read', label: 'Read access' },
			{ value: 'write', label: 'Write access' },
			{ value: 'admin', label: 'Admin access' },
			{ value: 'openid profile email', label: 'OpenID Connect' }
		]
	}
};

/**
 * Get provider configuration by ID
 * @param {string} providerId - Provider identifier
 * @returns {OAuthProvider|null} Provider configuration
 */
export function getProvider(providerId) {
	return OAuthProviders[providerId] || null;
}

/**
 * Get all available provider IDs
 * @returns {string[]} Array of provider IDs
 */
export function getProviderIds() {
	return Object.keys(OAuthProviders);
}

/**
 * Generate example redirect URI based on current domain
 * @returns {string} Example redirect URI
 */
export function generateExampleRedirectUri() {
	const protocol = window.location.protocol;
	const host = window.location.host;
	return `${protocol}//${host}/api/auth/callback`;
}
