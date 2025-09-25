/**
 * User session logout-all API endpoint
 * Allows users to terminate all sessions except the current one
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

		// Get current session token to exclude from termination
		const currentSessionToken = extractSessionToken(request);
		let currentSessionId = null;

		if (currentSessionToken) {
			try {
				const currentSession = await authManager.getSessionByToken(currentSessionToken);
				currentSessionId = currentSession?.id;
			} catch (error) {
				console.warn('Could not determine current session:', error.message);
			}
		}

		// Get all user sessions
		const userSessions = await authManager.getUserSessions(user.id);

		// Filter out current session and expired sessions
		const sessionsToTerminate = userSessions.filter((session) => {
			if (session.id === currentSessionId) return false;

			// Skip already expired sessions
			const isExpired = new Date(session.expiresAt) <= new Date();
			return !isExpired;
		});

		if (sessionsToTerminate.length === 0) {
			return json({
				success: true,
				message: 'No other active sessions to terminate',
				terminatedCount: 0
			});
		}

		// Terminate all other sessions
		let terminatedCount = 0;
		const terminationResults = await Promise.allSettled(
			sessionsToTerminate.map((session) => authManager.terminateSession(session.id))
		);

		// Count successful terminations
		terminationResults.forEach((result, index) => {
			if (result.status === 'fulfilled' && result.value === true) {
				terminatedCount++;
			} else {
				console.warn(
					`Failed to terminate session ${sessionsToTerminate[index].id}:`,
					result.reason
				);
			}
		});

		// Log the bulk session termination event
		try {
			const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
			if (authEventLogger) {
				await authEventLogger.logEvent({
					userId: user.id,
					eventType: 'sessions_terminated_bulk',
					ipAddress: getClientAddress() || 'unknown',
					userAgent: request.headers.get('user-agent') || 'unknown',
					metadata: {
						terminatedCount,
						requestedCount: sessionsToTerminate.length,
						terminatedBy: 'user',
						excludedCurrentSession: currentSessionId !== null
					}
				});
			}
		} catch (logError) {
			console.warn('Failed to log bulk session termination event:', logError);
		}

		return json({
			success: true,
			message: `Terminated ${terminatedCount} session${terminatedCount !== 1 ? 's' : ''}`,
			terminatedCount
		});
	} catch (error) {
		console.error('Error terminating sessions:', error);
		return json(
			{
				success: false,
				error: 'Failed to terminate sessions'
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
