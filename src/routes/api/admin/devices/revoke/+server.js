import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { deviceId } = await request.json();

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.revokeDevice(deviceId);

		return json(result);
	} catch (error) {
		console.error('Error revoking device:', error);
		return json({ error: 'Failed to revoke device' }, { status: 500 });
	}
}