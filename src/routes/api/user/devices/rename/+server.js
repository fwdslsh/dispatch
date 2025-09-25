/**
 * User device rename API endpoint
 * Allows users to rename their own devices
 */

import { json } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/shared/auth/middleware.js';

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request }) {
	try {
		const user = await getAuthenticatedUser(request);
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const { deviceId, newName } = await request.json();

		// Validate input
		if (!deviceId) {
			return json({ success: false, error: 'Device ID is required' }, { status: 400 });
		}

		if (!newName || typeof newName !== 'string' || !newName.trim()) {
			return json({ success: false, error: 'Device name is required' }, { status: 400 });
		}

		const trimmedName = newName.trim();
		if (trimmedName.length < 1 || trimmedName.length > 100) {
			return json(
				{ success: false, error: 'Device name must be between 1 and 100 characters' },
				{ status: 400 }
			);
		}

		const deviceManager = globalThis.__API_SERVICES?.deviceManager;
		if (!deviceManager) {
			return json(
				{ success: false, error: 'Device management service unavailable' },
				{ status: 503 }
			);
		}

		// Check if device belongs to user
		const device = await deviceManager.getDeviceById(deviceId);
		if (!device) {
			return json({ success: false, error: 'Device not found' }, { status: 404 });
		}

		if (device.userId !== user.id) {
			return json(
				{ success: false, error: 'Access denied - device does not belong to user' },
				{ status: 403 }
			);
		}

		// Rename the device
		const success = await deviceManager.renameDevice(deviceId, trimmedName);

		if (!success) {
			return json({ success: false, error: 'Failed to rename device' }, { status: 500 });
		}

		// Log the rename event
		try {
			const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
			if (authEventLogger) {
				await authEventLogger.logEvent({
					userId: user.id,
					deviceId,
					eventType: 'device_renamed',
					ipAddress: getClientAddress(request) || 'unknown',
					userAgent: request.headers.get('user-agent') || 'unknown',
					metadata: {
						oldName: device.deviceName,
						newName: trimmedName
					}
				});
			}
		} catch (logError) {
			console.warn('Failed to log device rename event:', logError);
		}

		return json({
			success: true,
			message: 'Device renamed successfully'
		});
	} catch (error) {
		console.error('Error renaming device:', error);
		return json(
			{
				success: false,
				error: 'Failed to rename device'
			},
			{ status: 500 }
		);
	}
}
