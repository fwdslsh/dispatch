/**
 * User session management API endpoints
 * Allows users to view and manage their own authentication sessions
 */

import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	try {
		const user = await getAuthenticatedUser(request);
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
		}

		// Get user's sessions
		const sessions = await authManager.getUserSessions(user.id);

		// Get current session info (if available from request)
		const sessionToken = extractSessionToken(request);
		let currentSession = null;

		if (sessionToken) {
			try {
				currentSession = await authManager.getSessionByToken(sessionToken);
			} catch (error) {
				// Non-fatal - continue without current session info
				console.warn('Could not determine current session:', error.message);
			}
		}

		return json({
			success: true,
			sessions: sessions.map(session => ({
				id: session.id,
				deviceId: session.deviceId,
				deviceName: session.deviceName,
				createdAt: session.createdAt,
				expiresAt: session.expiresAt,
				lastActivity: session.lastActivity,
				ipAddress: session.ipAddress,
				userAgent: session.userAgent,
				authMethod: session.authMethod
			})),
			currentSession: currentSession ? {
				id: currentSession.id,
				deviceId: currentSession.deviceId,
				deviceName: currentSession.deviceName,
				createdAt: currentSession.createdAt,
				expiresAt: currentSession.expiresAt,
				lastActivity: currentSession.lastActivity,
				authMethod: currentSession.authMethod
			} : null
		});

	} catch (error) {
		console.error('Error fetching user sessions:', error);
		return json({
			success: false,
			error: 'Failed to load sessions'
		}, { status: 500 });
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