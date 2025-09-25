/**
 * Get current authentication status
 */

import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	try {
		const user = await getAuthenticatedUser(request);

		if (!user) {
			return json({
				success: true,
				authenticated: false,
				user: null,
				session: null
			});
		}

		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
		}

		// Get current session info
		const sessionToken = extractSessionToken(request);
		let sessionInfo = null;

		if (sessionToken) {
			try {
				const currentSession = await authManager.getSessionByToken(sessionToken);
				if (currentSession && currentSession.userId === user.id) {
					sessionInfo = {
						id: currentSession.id,
						deviceId: currentSession.deviceId,
						deviceName: currentSession.deviceName,
						createdAt: currentSession.createdAt,
						expiresAt: currentSession.expiresAt,
						lastActivity: currentSession.lastActivity,
						authMethod: currentSession.authMethod,
						ipAddress: currentSession.ipAddress
					};
				}
			} catch (error) {
				console.warn('Could not retrieve session info:', error.message);
			}
		}

		// Calculate session status
		let sessionStatus = 'unknown';
		let timeUntilExpiry = null;

		if (sessionInfo) {
			const now = new Date();
			const expiryDate = new Date(sessionInfo.expiresAt);
			const timeDiff = expiryDate.getTime() - now.getTime();

			if (timeDiff <= 0) {
				sessionStatus = 'expired';
			} else if (timeDiff <= 15 * 60 * 1000) {
				// 15 minutes
				sessionStatus = 'expiring_soon';
			} else {
				sessionStatus = 'active';
			}

			timeUntilExpiry = Math.max(0, Math.floor(timeDiff / 1000)); // seconds
		}

		return json({
			success: true,
			authenticated: true,
			user: {
				id: user.id,
				email: user.email,
				displayName: user.displayName,
				role: user.role,
				isActive: user.isActive,
				createdAt: user.createdAt
			},
			session: sessionInfo,
			sessionStatus,
			timeUntilExpiry,
			serverTime: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error getting authentication status:', error);
		return json(
			{
				success: false,
				error: 'Failed to get authentication status'
			},
			{ status: 500 }
		);
	}
}

/**
 * Extract session token from request
 */
function extractSessionToken(request) {
	// Try cookies first
	const cookieHeader = request.headers.get('cookie');
	if (cookieHeader) {
		const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
			const [key, value] = cookie.trim().split('=');
			acc[key] = value;
			return acc;
		}, {});

		if (cookies.sessionToken) {
			return cookies.sessionToken;
		}
	}

	// Try Authorization header as fallback
	const authHeader = request.headers.get('authorization');
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.substring(7);
	}

	return null;
}
