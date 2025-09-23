import { json, redirect } from '@sveltejs/kit';
import { getAuthManager } from '$lib/server/shared/auth.js';

export async function GET({ url }) {
	const provider = url.searchParams.get('provider');

	if (!provider || !['github', 'google'].includes(provider)) {
		return json({ success: false, error: 'Invalid OAuth provider' }, { status: 400 });
	}

	const authManager = getAuthManager();
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not initialized' }, { status: 500 });
	}

	try {
		// Get OAuth configuration
		const oauthConfig = await authManager.getOAuthConfig(provider);
		if (!oauthConfig) {
			return json({ success: false, error: `${provider} OAuth not configured` }, { status: 400 });
		}

		// Create state for CSRF protection
		const state = await authManager.createOAuthState(provider);

		// Build OAuth URL
		let oauthUrl;
		const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/api/auth/oauth/callback`;

		if (provider === 'github') {
			oauthUrl = `https://github.com/login/oauth/authorize?client_id=${oauthConfig.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
		} else if (provider === 'google') {
			oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthConfig.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email profile&response_type=code&state=${state}`;
		}

		// Redirect to OAuth provider
		throw redirect(302, oauthUrl);
	} catch (error) {
		if (error.status === 302) {
			throw error; // Re-throw redirects
		}
		console.error('OAuth initiation error:', error);
		return json({ success: false, error: 'Failed to initiate OAuth flow' }, { status: 500 });
	}
}