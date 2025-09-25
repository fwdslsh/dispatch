/**
 * Configure authentication methods during onboarding
 */

import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { methods } = await request.json();

		if (!methods || typeof methods !== 'object') {
			return json({ success: false, error: 'Authentication methods configuration is required' }, { status: 400 });
		}

		const settingsManager = globalThis.__API_SERVICES?.settingsManager;
		if (!settingsManager) {
			return json({ success: false, error: 'Settings service unavailable' }, { status: 503 });
		}

		// Configure authentication method settings
		const authSettings = {
			'auth.methods.local.enabled': true, // Always enabled as fallback
			'auth.methods.webauthn.enabled': Boolean(methods.webauthn),
			'auth.methods.oauth.enabled': Boolean(methods.oauth)
		};

		// Update settings
		for (const [key, value] of Object.entries(authSettings)) {
			await settingsManager.set(key, value);
		}

		// Configure WebAuthn settings if enabled
		if (methods.webauthn) {
			const hostname = process.env.HOSTNAME || 'localhost';
			const port = process.env.PORT || '3030';
			const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

			await settingsManager.set('auth.webauthn.rp_id', hostname);
			await settingsManager.set('auth.webauthn.rp_name', 'Dispatch');
			await settingsManager.set('auth.webauthn.origin', `${protocol}://${hostname}${port !== '80' && port !== '443' ? `:${port}` : ''}`);
		}

		// Configure OAuth settings if enabled (with default disabled providers)
		if (methods.oauth) {
			await settingsManager.set('auth.oauth.google.enabled', false);
			await settingsManager.set('auth.oauth.github.enabled', false);
			// Providers will need to be configured separately in admin panel
		}

		// Set onboarding completion flag
		await settingsManager.set('system.onboarding.auth_methods_configured', true);

		// Log configuration event
		const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
		if (authEventLogger) {
			await authEventLogger.logEvent({
				userId: null,
				eventType: 'auth_methods_configured',
				ipAddress: 'system',
				userAgent: 'onboarding',
				metadata: {
					configuredMethods: Object.keys(methods).filter(key => methods[key]),
					configuredBy: 'onboarding_flow'
				}
			});
		}

		return json({
			success: true,
			message: 'Authentication methods configured successfully',
			configuredMethods: Object.keys(methods).filter(key => methods[key])
		});

	} catch (error) {
		console.error('Error configuring authentication methods:', error);
		return json({
			success: false,
			error: 'Failed to configure authentication methods'
		}, { status: 500 });
	}
}