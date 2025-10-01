import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * OAuth Callback Handler
 * Exchanges authorization code for access token and creates user session
 */
export async function POST({ request, locals }) {
	try {
		const { code, state } = await request.json();

		if (!code) {
			logger.warn('AUTH', 'OAuth callback missing authorization code');
			return json({ success: false, error: 'Missing authorization code' }, { status: 400 });
		}

		// Get auth manager from locals (populated by hooks)
		const authManager = locals.services?.multiAuthManager;
		if (!authManager) {
			logger.error('AUTH', 'Auth manager not initialized');
			return json({ success: false, error: 'Authentication not configured' }, { status: 500 });
		}

		const githubProvider = authManager.providers.get('github');
		if (!githubProvider || !githubProvider.isEnabled) {
			logger.error('AUTH', 'GitHub OAuth provider not available or not configured');
			return json(
				{ success: false, error: 'GitHub authentication not configured' },
				{ status: 500 }
			);
		}

		// Handle OAuth callback
		const user = await githubProvider.handleCallback({ code, state });
		if (!user) {
			logger.warn('AUTH', 'GitHub OAuth callback failed');
			return json({ success: false, error: 'Authentication failed' }, { status: 401 });
		}

		// Create or update user record
		await authManager.upsertUser(user);

		// Create session
		const session = await authManager.createSession(user.id, 'github', {
			expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 days
			userAgent: request.headers.get('user-agent'),
			ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
		});

		logger.info('AUTH', `User ${user.id} authenticated via GitHub OAuth`);

		return json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				email: user.email,
				avatar: user.avatar
			},
			session: {
				sessionId: session.sessionId,
				userId: session.userId,
				provider: session.provider,
				expiresAt: session.expiresAt
			}
		});
	} catch (error) {
		logger.error('AUTH', 'OAuth callback error:', error);
		return json(
			{ success: false, error: error.message || 'Authentication failed' },
			{ status: 500 }
		);
	}
}
