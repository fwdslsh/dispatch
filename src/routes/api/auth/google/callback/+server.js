import { json, redirect } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { AuthManager } from '$lib/server/shared/auth/AuthManager.js';
import { SessionManager } from '$lib/server/shared/auth/SessionManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * Google OAuth callback handler
 * GET /api/auth/google/callback
 */
export async function GET({ request, url, cookies }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const baseUrl = `${url.protocol}//${url.host}`;
		const oauthManager = new OAuthManager(db, baseUrl);

		// Get authorization code and state from query parameters
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const error = url.searchParams.get('error');

		// Handle OAuth error
		if (error) {
			logger.warn('OAUTH', `Google OAuth error: ${error}`);
			throw redirect(
				302,
				`/login?error=oauth_error&provider=google&details=${encodeURIComponent(error)}`
			);
		}

		// Validate required parameters
		if (!code || !state) {
			logger.warn('OAUTH', 'Google OAuth callback missing required parameters');
			throw redirect(302, '/login?error=oauth_invalid_callback&provider=google');
		}

		// Validate state parameter
		const stateData = oauthManager.validateState(state);
		if (!stateData) {
			logger.warn('OAUTH', 'Invalid or expired OAuth state');
			throw redirect(302, '/login?error=oauth_invalid_state&provider=google');
		}

		// Exchange authorization code for tokens
		const tokenResult = await exchangeCodeForTokens('google', code, baseUrl);
		if (!tokenResult.success) {
			logger.error('OAUTH', `Google token exchange failed: ${tokenResult.error}`);
			throw redirect(
				302,
				`/login?error=oauth_token_exchange&provider=google&details=${encodeURIComponent(tokenResult.error)}`
			);
		}

		// Get user profile from Google
		const profileResult = await fetchGoogleProfile(tokenResult.accessToken);
		if (!profileResult.success) {
			logger.error('OAUTH', `Google profile fetch failed: ${profileResult.error}`);
			throw redirect(
				302,
				`/login?error=oauth_profile_fetch&provider=google&details=${encodeURIComponent(profileResult.error)}`
			);
		}

		// Create OAuth profile object
		const oauthProfile = {
			provider: 'google',
			id: profileResult.profile.sub || profileResult.profile.id,
			email: profileResult.profile.email,
			displayName: profileResult.profile.name,
			username: profileResult.profile.email ? profileResult.profile.email.split('@')[0] : null,
			emails: profileResult.profile.email ? [{ value: profileResult.profile.email }] : []
		};

		// Handle OAuth callback
		const authResult = await oauthManager.handleOAuthCallback(
			oauthProfile,
			tokenResult.accessToken,
			tokenResult.refreshToken
		);

		if (!authResult.success) {
			logger.error('OAUTH', `Google OAuth callback failed: ${authResult.error}`);
			throw redirect(
				302,
				`/login?error=oauth_callback&provider=google&details=${encodeURIComponent(authResult.error)}`
			);
		}

		// Create authentication session
		const sessionManager = new SessionManager(db);
		const session = await sessionManager.createSession({
			userId: authResult.user.id,
			deviceId: null, // OAuth doesn't require device tracking initially
			ipAddress: getClientIP(request),
			userAgent: request.headers.get('user-agent') || 'Unknown'
		});

		// Set session cookie
		cookies.set('auth-token', session.sessionToken, {
			path: '/',
			maxAge: 24 * 60 * 60, // 24 hours
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax'
		});

		// Log successful authentication
		logger.info('OAUTH', `Successful Google OAuth login for user: ${authResult.user.username}`);

		// Redirect to return URL or dashboard
		const returnTo = stateData.returnTo || '/';
		throw redirect(302, returnTo);
	} catch (error) {
		if (error.status === 302) {
			// Re-throw redirect responses
			throw error;
		}

		logger.error('OAUTH', `Google OAuth callback error: ${error.message}`);
		throw redirect(302, '/login?error=oauth_callback&provider=google');
	}
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(provider, code, baseUrl) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const oauthManager = new OAuthManager(db, baseUrl);
		const providerConfig = await oauthManager.getProviderConfig(provider);

		const tokenUrl = 'https://oauth2.googleapis.com/token';
		const params = new URLSearchParams({
			code,
			client_id: providerConfig.clientId,
			client_secret: providerConfig.clientSecret,
			redirect_uri: providerConfig.callbackUrl,
			grant_type: 'authorization_code'
		});

		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: params
		});

		if (!response.ok) {
			const errorData = await response.text();
			return { success: false, error: `Token exchange failed: ${errorData}` };
		}

		const tokens = await response.json();
		return {
			success: true,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresIn: tokens.expires_in,
			idToken: tokens.id_token
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Fetch user profile from Google
 */
async function fetchGoogleProfile(accessToken) {
	try {
		const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (!response.ok) {
			const errorData = await response.text();
			return { success: false, error: `Profile fetch failed: ${errorData}` };
		}

		const profile = await response.json();
		return { success: true, profile };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Extract client IP address
 */
function getClientIP(request) {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	return request.headers.get('x-real-ip') || 'unknown';
}
