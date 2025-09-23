import { json, redirect } from '@sveltejs/kit';

export async function GET({ url, cookies, locals }) {
	const provider = url.searchParams.get('provider');
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not initialized' }, { status: 500 });
	}

	// Handle OAuth error response
	if (error) {
		return json({ success: false, error: `OAuth error: ${error}` }, { status: 400 });
	}

	// Validate required parameters
	if (!provider || !code || !state) {
		return json({ success: false, error: 'Missing required OAuth parameters' }, { status: 400 });
	}

	if (!['github', 'google'].includes(provider)) {
		return json({ success: false, error: 'Unsupported OAuth provider' }, { status: 400 });
	}

	try {
		// Verify state for CSRF protection
		const validState = await authManager.verifyOAuthState(state, provider);
		if (!validState) {
			return json({ success: false, error: 'Invalid or expired OAuth state' }, { status: 400 });
		}

		// Get OAuth configuration
		const oauthConfig = await authManager.getOAuthConfig(provider);
		if (!oauthConfig) {
			return json({ success: false, error: `${provider} OAuth not configured` }, { status: 400 });
		}

		// Exchange code for access token
		let profile;
		if (provider === 'github') {
			profile = await exchangeGitHubCode(code, oauthConfig);
		} else if (provider === 'google') {
			profile = await exchangeGoogleCode(code, oauthConfig);
		}

		if (!profile) {
			return json({ success: false, error: 'Failed to get user profile from OAuth provider' }, { status: 400 });
		}

		// Find or create user
		const user = await authManager.findOrCreateOAuthUser(provider, profile);
		
		// Create session
		const session = await authManager.createSession(user.id, `${provider}_oauth`);
		
		// Set secure cookie
		cookies.set('dispatch-auth-token', session.token, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		// Redirect to workspace
		throw redirect(302, '/workspace');
	} catch (error) {
		if (error.status === 302) {
			throw error; // Re-throw redirects
		}
		console.error('OAuth callback error:', error);
		return json({ success: false, error: 'OAuth authentication failed' }, { status: 500 });
	}
}

async function exchangeGitHubCode(code, config) {
	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			client_id: config.client_id,
			client_secret: config.client_secret,
			code
		})
	});

	if (!tokenResponse.ok) {
		throw new Error('Failed to exchange code for token');
	}

	const tokenData = await tokenResponse.json();
	if (tokenData.error) {
		throw new Error(`GitHub OAuth error: ${tokenData.error}`);
	}

	// Get user profile
	const userResponse = await fetch('https://api.github.com/user', {
		headers: {
			'Authorization': `Bearer ${tokenData.access_token}`,
			'User-Agent': 'Dispatch-Auth'
		}
	});

	if (!userResponse.ok) {
		throw new Error('Failed to get GitHub user profile');
	}

	const userData = await userResponse.json();

	// Get user email if not public
	if (!userData.email) {
		const emailResponse = await fetch('https://api.github.com/user/emails', {
			headers: {
				'Authorization': `Bearer ${tokenData.access_token}`,
				'User-Agent': 'Dispatch-Auth'
			}
		});

		if (emailResponse.ok) {
			const emails = await emailResponse.json();
			const primaryEmail = emails.find(email => email.primary && email.verified);
			userData.email = primaryEmail?.email || userData.login + '@github.local';
		}
	}

	return {
		username: userData.login,
		email: userData.email,
		name: userData.name
	};
}

async function exchangeGoogleCode(code, config) {
	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: config.client_id,
			client_secret: config.client_secret,
			code,
			grant_type: 'authorization_code',
			redirect_uri: `${process.env.PUBLIC_URL || 'http://localhost:5173'}/api/auth/oauth/callback`
		})
	});

	if (!tokenResponse.ok) {
		throw new Error('Failed to exchange code for token');
	}

	const tokenData = await tokenResponse.json();
	if (tokenData.error) {
		throw new Error(`Google OAuth error: ${tokenData.error}`);
	}

	// Get user profile
	const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
		headers: {
			'Authorization': `Bearer ${tokenData.access_token}`
		}
	});

	if (!userResponse.ok) {
		throw new Error('Failed to get Google user profile');
	}

	const userData = await userResponse.json();

	return {
		username: userData.email.split('@')[0],
		email: userData.email,
		name: userData.name
	};
}