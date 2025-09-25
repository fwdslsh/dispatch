/**
 * User session logout API endpoint
 * Allows users to terminate specific sessions
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

		const { sessionId } = await request.json();

		// Validate input
		if (!sessionId) {
			return json({ success: false, error: 'Session ID is required' }, { status: 400 });
		}

		const authManager = globalThis.__API_SERVICES?.authManager;
		if (!authManager) {
			return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
		}

		// Check if session belongs to user
		const session = await authManager.getSessionById(sessionId);
		if (!session) {
			return json({ success: false, error: 'Session not found' }, { status: 404 });
		}

		if (session.userId !== user.id) {
			return json(
				{ success: false, error: 'Access denied - session does not belong to user' },
				{ status: 403 }
			);
		}

		// Terminate the session
		const success = await authManager.terminateSession(sessionId);

		if (!success) {
			return json({ success: false, error: 'Failed to terminate session' }, { status: 500 });
		}

		// Log the session termination event
		try {
			const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
			if (authEventLogger) {
				await authEventLogger.logEvent({
					userId: user.id,
					deviceId: session.deviceId,
					eventType: 'session_terminated',
					ipAddress: getClientAddress() || 'unknown',
					userAgent: request.headers.get('user-agent') || 'unknown',
					metadata: {
						terminatedSessionId: sessionId,
						terminatedBy: 'user'
					}
				});
			}
		} catch (logError) {
			console.warn('Failed to log session termination event:', logError);
		}

		return json({
			success: true,
			message: 'Session terminated successfully'
		});
	} catch (error) {
		console.error('Error terminating session:', error);
		return json(
			{
				success: false,
				error: 'Failed to terminate session'
			},
			{ status: 500 }
		);
	}
}
