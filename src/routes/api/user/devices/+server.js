/**
 * User device management API endpoints
 * Allows users to manage their own devices (view, rename, revoke)
 */

import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, getClientAddress }) {
	try {
		const user = await getAuthenticatedUser(request);
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const deviceManager = globalThis.__API_SERVICES?.deviceManager;
		if (!deviceManager) {
			return json(
				{ success: false, error: 'Device management service unavailable' },
				{ status: 503 }
			);
		}

		// Get user's devices
		const devices = await deviceManager.getUserDevices(user.id);

		// Get current device info (if available from session)
		const sessionToken = extractSessionToken(request);
		let currentDevice = null;

		if (sessionToken) {
			try {
				currentDevice = await deviceManager.getDeviceBySession(sessionToken);
			} catch (error) {
				// Non-fatal - continue without current device info
				console.warn('Could not determine current device:', error.message);
			}
		}

		return json({
			success: true,
			devices: devices.map((device) => ({
				id: device.id,
				deviceName: device.deviceName,
				deviceFingerprint: device.deviceFingerprint,
				isTrusted: device.isTrusted,
				activeSessions: device.activeSessions || 0,
				createdAt: device.createdAt,
				lastActivity: device.lastActivity,
				userAgent: device.userAgent
			})),
			currentDevice: currentDevice
				? {
						id: currentDevice.id,
						deviceName: currentDevice.deviceName
					}
				: null
		});
	} catch (error) {
		console.error('Error fetching user devices:', error);
		return json(
			{
				success: false,
				error: 'Failed to load devices'
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
