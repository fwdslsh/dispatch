import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const deviceId = params.id;

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.revokeDevice(deviceId);

		return json(result);
	} catch (error) {
		console.error('Error revoking device:', error);
		return json({ error: error.message || 'Failed to revoke device' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const deviceId = params.id;
		const updates = await request.json();

		const adminManager = new AdminInterfaceManager(locals.db);

		if ('deviceName' in updates) {
			// Rename device
			const result = await adminManager.renameDevice(deviceId, updates.deviceName);
			return json(result);
		} else if ('isTrusted' in updates) {
			// Toggle trust status
			const result = await adminManager.toggleDeviceTrust(deviceId, updates.isTrusted);
			return json(result);
		} else {
			return json({ error: 'Invalid update operation' }, { status: 400 });
		}
	} catch (error) {
		console.error('Error updating device:', error);
		return json({ error: error.message || 'Failed to update device' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const deviceId = params.id;

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.getDeviceDetails(deviceId);

		return json(result);
	} catch (error) {
		console.error('Error fetching device details:', error);
		return json({ error: error.message || 'Failed to fetch device details' }, { status: 500 });
	}
}