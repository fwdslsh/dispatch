import { json } from '@sveltejs/kit';
import { AuthManager } from '$lib/server/shared/auth/AuthManager.js';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { WebAuthnManager } from '$lib/server/shared/auth/WebAuthnManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
// WebAuthn availability is checked client-side
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * Authentication configuration API
 * GET /api/auth/config - Get complete authentication configuration
 */

export async function GET({ request, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const authManager = new AuthManager(db);
		const oauthManager = new OAuthManager(db, baseUrl);
		const webauthnManager = new WebAuthnManager(db);

		// Get OAuth configuration
		const oauthConfig = await oauthManager.getOAuthConfig();
		const enabledOAuthProviders = await oauthManager.getEnabledProviders();

		// Get WebAuthn configuration
		const webauthnConfig = await webauthnManager.getWebAuthnConfig();
		const isSecure = url.protocol === 'https:' ||
			url.hostname === 'localhost' ||
			url.hostname === '127.0.0.1';

		// Get local authentication settings
		const settings = await db.settings.getByCategory('auth');
		const localAuthEnabled = settings.find(s => s.key === 'local_enabled')?.value === 'true';

		// Check authentication method availability
		const authMethods = {
			local: {
				enabled: localAuthEnabled,
				available: localAuthEnabled,
				name: 'Access Code',
				description: 'Sign in with a local access code'
			},
			webauthn: {
				enabled: webauthnConfig.enabled,
				available: webauthnConfig.enabled && isSecure,
				name: 'Passkey',
				description: 'Sign in with your passkey (Touch ID, Face ID, or security key)',
				warnings: !isSecure ? ['HTTPS required for WebAuthn'] : []
			},
			oauth: {
				enabled: enabledOAuthProviders.length > 0,
				available: enabledOAuthProviders.length > 0,
				name: 'OAuth',
				description: 'Sign in with your social account',
				providers: {}
			}
		};

		// Add OAuth provider details
		for (const provider of enabledOAuthProviders) {
			const providerConfig = oauthConfig[provider];
			if (providerConfig?.enabled) {
				authMethods.oauth.providers[provider] = {
					name: provider === 'google' ? 'Google' : 'GitHub',
					enabled: true,
					hasClientId: Boolean(providerConfig.clientId),
					hasClientSecret: Boolean(providerConfig.clientSecret),
					callbackUrl: oauthManager.getCallbackUrl(provider)
				};
			}
		}

		// Calculate overall availability
		const hasAvailableMethods = authMethods.local.available ||
			authMethods.webauthn.available ||
			authMethods.oauth.available;

		// Get security context information
		const securityContext = {
			isSecure,
			hostname: url.hostname,
			protocol: url.protocol,
			baseUrl,
			isTunnel: url.hostname.includes('localtunnel.me') || url.hostname.includes('ngrok.io')
		};

		// Authentication flow configuration
		const flowConfig = {
			allowGuestAccess: false, // Could be configurable
			requireMFA: false, // Could be enhanced later
			sessionTimeout: 24 * 60 * 60, // 24 hours in seconds
			rememberDevice: true
		};

		return json({
			success: true,
			methods: authMethods,
			security: securityContext,
			flow: flowConfig,
			hasAvailableMethods,
			debugInfo: {
				enabledOAuthProviders,
				webauthnEnabled: webauthnConfig.enabled,
				localAuthEnabled,
				isSecure
			}
		});

	} catch (error) {
		logger.error('AUTH_CONFIG', `Failed to get auth config: ${error.message}`);
		return json({
			success: false,
			error: 'Failed to get authentication configuration',
			details: error.message
		}, { status: 500 });
	}
}