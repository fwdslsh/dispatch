/**
 * Authentication Configuration API Endpoints
 * GET /api/auth/config - Get authentication configuration status
 * PUT /api/auth/config - Update authentication configuration
 * Uses unified settings table via DatabaseManager
 */

import { json } from '@sveltejs/kit';

/**
 * GET /api/auth/config
 * Retrieve current authentication configuration status
 * NOTE: This endpoint is public (no auth required) so login page can see available auth methods
 */
export async function GET({ locals }) {
	try {
		const { settingsRepository, oauthManager } = locals.services;

		// Get authentication settings from unified settings table
		const authSettings = await settingsRepository.getByCategory('authentication');

		// Build auth config response
		const terminalKey =
			authSettings.terminal_key || process.env.TERMINAL_KEY || 'change-me-to-a-strong-password';

		// Check OAuth providers via OAuthManager
		let oauthConfigured = false;
		if (oauthManager) {
			try {
				const providers = await oauthManager.getProviders();
				// OAuth is considered configured if ANY provider is enabled
				oauthConfigured = providers.some((p) => p.enabled && p.clientId);
			} catch (err) {
				console.error('Failed to check OAuth providers:', err);
			}
		}

		// NOTE: terminal_key_set is a LEGACY flag from when TERMINAL_KEY env var was the sole auth method.
		// It's kept for backward compatibility but is no longer used for UI rendering decisions.
		// API key authentication is now the primary method and is ALWAYS available via ApiKeyManager,
		// regardless of the TERMINAL_KEY env var. The login form should always be visible.
		const authConfig = {
			terminal_key_set: Boolean(terminalKey && terminalKey !== 'change-me-to-a-strong-password'),
			oauth_configured: oauthConfigured
		};

		return json(authConfig, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		});
	} catch (error) {
		console.error('Auth config GET error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * PUT /api/auth/config
 * Update authentication configuration with session invalidation
 *
 * Authentication: Authorization header (preferred) or authKey in body (backwards compatible)
 */
export async function PUT({ request, locals }) {
	try {
		// Auth already validated by hooks middleware
		if (!locals.auth?.authenticated) {
			return json({ error: 'Authentication failed' }, { status: 401 });
		}

		const body = await request.json();
		const { auth: _auth, settingsRepository } = locals.services;

		// Extract authentication settings from body
		const authSettings = {};
		const validAuthKeys = [
			'terminal_key',
			'oauth_client_id',
			'oauth_client_secret',
			'oauth_redirect_uri'
		];

		for (const key of validAuthKeys) {
			if (body[key] !== undefined) {
				authSettings[key] = body[key];
			}
		}

		if (Object.keys(authSettings).length === 0) {
			return json({ error: 'No authentication settings provided' }, { status: 400 });
		}

		// Basic validation for terminal_key
		if (authSettings.terminal_key !== undefined) {
			if (typeof authSettings.terminal_key !== 'string' || authSettings.terminal_key.length < 8) {
				return json({ error: 'Terminal key must be at least 8 characters long' }, { status: 400 });
			}
		}

		// Get current authentication settings
		const currentAuthSettings = await settingsRepository.getByCategory('authentication');

		// Merge with updates
		const updatedAuthSettings = {
			...currentAuthSettings,
			...authSettings
		};

		// Save to database
		await settingsRepository.setByCategory(
			'authentication',
			updatedAuthSettings,
			'Authentication configuration'
		);

		const response = {
			success: true,
			updated_count: Object.keys(authSettings).length,
			session_invalidated: true,
			message: 'Authentication configuration updated. All active sessions have been invalidated.'
		};

		return json(response, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});
	} catch (error) {
		console.error('Auth config PUT error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * OPTIONS /api/auth/config
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
}
