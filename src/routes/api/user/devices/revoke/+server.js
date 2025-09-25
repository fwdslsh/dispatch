/**
 * User device revocation API endpoint
 * Allows users to revoke their own devices (except current device)
 */

import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ request, getClientAddress }) {
	try {
		const user = await getAuthenticatedUser(request);
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const { deviceId } = await request.json();

		// Validate input
		if (!deviceId) {
			return json({ success: false, error: 'Device ID is required' }, { status: 400 });
		}

		const deviceManager = globalThis.__API_SERVICES?.deviceManager;
		const authManager = globalThis.__API_SERVICES?.authManager;

		if (!deviceManager || !authManager) {
			return json({ success: false, error: 'Authentication services unavailable' }, { status: 503 });
		}

		// Check if device belongs to user
		const device = await deviceManager.getDeviceById(deviceId);
		if (!device) {
			return json({ success: false, error: 'Device not found' }, { status: 404 });
		}

		if (device.userId !== user.id) {
			return json({ success: false, error: 'Access denied - device does not belong to user' }, { status: 403 });
		}

		// Prevent revoking current device (for security)
		const sessionToken = extractSessionToken(request);
		if (sessionToken) {
			try {
				const currentDevice = await deviceManager.getDeviceBySession(sessionToken);
				if (currentDevice && currentDevice.id === deviceId) {
					return json({
						success: false,
						error: 'Cannot revoke current device. Use a different device to revoke this one.'
					}, { status: 400 });
				}
			} catch (error) {
				// Non-fatal - continue with revocation
				console.warn('Could not verify current device:', error.message);
			}
		}

		// Revoke the device (this will end all sessions for this device)
		const success = await deviceManager.revokeDevice(deviceId);

		if (!success) {
			return json({ success: false, error: 'Failed to revoke device' }, { status: 500 });
		}

		// Log the revocation event
		try {
			const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
			if (authEventLogger) {
				await authEventLogger.logEvent({
					userId: user.id,
					deviceId,
					eventType: 'device_revoked',
					ipAddress: getClientAddress() || 'unknown',
					userAgent: request.headers.get('user-agent') || 'unknown',
					metadata: {
						deviceName: device.deviceName,
						revokedBy: 'user'
					}
				});
			}
		} catch (logError) {
			console.warn('Failed to log device revocation event:', logError);
		}

		return json({
			success: true,
			message: `Device "${device.deviceName}" has been revoked successfully`
		});

	} catch (error) {
		console.error('Error revoking device:', error);
		return json({
			success: false,
			error: 'Failed to revoke device'
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