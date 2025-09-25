import { json, redirect } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';
import { AuthManager } from '$lib/server/shared/auth/AuthManager.js';
import { SessionManager } from '$lib/server/shared/auth/SessionManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * GitHub OAuth callback handler
 * GET /api/auth/github/callback
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
			logger.warn('OAUTH', `GitHub OAuth error: ${error}`);
			throw redirect(
				302,
				`/login?error=oauth_error&provider=github&details=${encodeURIComponent(error)}`
			);
		}

		// Validate required parameters
		if (!code || !state) {
			logger.warn('OAUTH', 'GitHub OAuth callback missing required parameters');
			throw redirect(302, '/login?error=oauth_invalid_callback&provider=github');
		}

		// Validate state parameter
		const stateData = oauthManager.validateState(state);
		if (!stateData) {
			logger.warn('OAUTH', 'Invalid or expired OAuth state');
			throw redirect(302, '/login?error=oauth_invalid_state&provider=github');
		}

		// Exchange authorization code for tokens
		const tokenResult = await exchangeCodeForTokens('github', code, baseUrl);
		if (!tokenResult.success) {
			logger.error('OAUTH', `GitHub token exchange failed: ${tokenResult.error}`);
			throw redirect(
				302,
				`/login?error=oauth_token_exchange&provider=github&details=${encodeURIComponent(tokenResult.error)}`
			);
		}

		// Get user profile from GitHub
		const profileResult = await fetchGitHubProfile(tokenResult.accessToken);
		if (!profileResult.success) {
			logger.error('OAUTH', `GitHub profile fetch failed: ${profileResult.error}`);
			throw redirect(
				302,
				`/login?error=oauth_profile_fetch&provider=github&details=${encodeURIComponent(profileResult.error)}`
			);
		}

		// Get user emails from GitHub (separate API call)
		const emailsResult = await fetchGitHubEmails(tokenResult.accessToken);
		const emails = emailsResult.success ? emailsResult.emails : [];

		// Create OAuth profile object
		const oauthProfile = {
			provider: 'github',
			id: profileResult.profile.id.toString(),
			username: profileResult.profile.login,
			displayName: profileResult.profile.name || profileResult.profile.login,
			email: profileResult.profile.email,
			emails:
				emails.length > 0
					? emails.map((email) => ({ value: email.email, primary: email.primary }))
					: []
		};

		// Handle OAuth callback
		const authResult = await oauthManager.handleOAuthCallback(
			oauthProfile,
			tokenResult.accessToken,
			tokenResult.refreshToken
		);

		if (!authResult.success) {
			logger.error('OAUTH', `GitHub OAuth callback failed: ${authResult.error}`);
			throw redirect(
				302,
				`/login?error=oauth_callback&provider=github&details=${encodeURIComponent(authResult.error)}`
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
		logger.info('OAUTH', `Successful GitHub OAuth login for user: ${authResult.user.username}`);

		// Redirect to return URL or dashboard
		const returnTo = stateData.returnTo || '/';
		throw redirect(302, returnTo);
	} catch (error) {
		if (error.status === 302) {
			// Re-throw redirect responses
			throw error;
		}

		logger.error('OAUTH', `GitHub OAuth callback error: ${error.message}`);
		throw redirect(302, '/login?error=oauth_callback&provider=github');
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

		const tokenUrl = 'https://github.com/login/oauth/access_token';
		const params = new URLSearchParams({
			client_id: providerConfig.clientId,
			client_secret: providerConfig.clientSecret,
			code
		});

		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: params
		});

		if (!response.ok) {
			const errorData = await response.text();
			return { success: false, error: `Token exchange failed: ${errorData}` };
		}

		const tokens = await response.json();

		if (tokens.error) {
			return {
				success: false,
				error: `Token exchange failed: ${tokens.error_description || tokens.error}`
			};
		}

		return {
			success: true,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			tokenType: tokens.token_type,
			scope: tokens.scope
		};
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Fetch user profile from GitHub
 */
async function fetchGitHubProfile(accessToken) {
	try {
		const response = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `token ${accessToken}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Dispatch-OAuth-Client'
			}
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
 * Fetch user emails from GitHub
 */
async function fetchGitHubEmails(accessToken) {
	try {
		const response = await fetch('https://api.github.com/user/emails', {
			headers: {
				Authorization: `token ${accessToken}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'Dispatch-OAuth-Client'
			}
		});

		if (!response.ok) {
			// Emails endpoint might not be accessible, return empty array
			return { success: false, emails: [] };
		}

		const emails = await response.json();
		return { success: true, emails };
	} catch (error) {
		return { success: false, emails: [] };
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
