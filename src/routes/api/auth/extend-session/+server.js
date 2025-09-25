/**
 * Extend current user session
 */

import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
	try {
		const user = await getAuthenticatedUser(request);
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
		}

		// Extract session token
		const sessionToken = extractSessionToken(request);
		if (!sessionToken) {
			return json({ success: false, error: 'No session token found' }, { status: 400 });
		}

		// Get current session
		const currentSession = await authManager.getSessionByToken(sessionToken);
		if (!currentSession) {
			return json({ success: false, error: 'Session not found' }, { status: 404 });
		}

		if (currentSession.userId !== user.id) {
			return json({ success: false, error: 'Session does not belong to user' }, { status: 403 });
		}

		// Check if session is expired
		const now = new Date();
		const expiryDate = new Date(currentSession.expiresAt);
		if (now > expiryDate) {
			return json({ success: false, error: 'Session has already expired' }, { status: 410 });
		}

		// Extend session by default duration (e.g., 24 hours)
		const extensionHours = 24;
		const newExpiryDate = new Date(now.getTime() + extensionHours * 60 * 60 * 1000);

		const extendedSession = await authManager.extendSession(currentSession.id, newExpiryDate);

		if (!extendedSession) {
			return json({ success: false, error: 'Failed to extend session' }, { status: 500 });
		}

		// Log the session extension event
		try {
			const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
			if (authEventLogger) {
				await authEventLogger.logEvent({
					userId: user.id,
					deviceId: currentSession.deviceId,
					eventType: 'session_extended',
					ipAddress: getClientAddress() || 'unknown',
					userAgent: request.headers.get('user-agent') || 'unknown',
					metadata: {
						sessionId: currentSession.id,
						previousExpiry: currentSession.expiresAt,
						newExpiry: newExpiryDate.toISOString(),
						extensionHours,
						extendedBy: 'user_request'
					}
				});
			}
		} catch (logError) {
			console.warn('Failed to log session extension event:', logError);
		}

		return json({
			success: true,
			message: 'Session extended successfully',
			session: {
				id: extendedSession.id,
				expiresAt: extendedSession.expiresAt,
				lastActivity: extendedSession.lastActivity,
				extensionHours
			},
			extendsUntil: newExpiryDate.toISOString()
		});
	} catch (error) {
		console.error('Error extending session:', error);
		return json(
			{
				success: false,
				error: 'Failed to extend session'
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
