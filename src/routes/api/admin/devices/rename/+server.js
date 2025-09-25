import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { deviceId, newName } = await request.json();

		if (!deviceId) {
			return json({ error: 'Device ID is required' }, { status: 400 });
		}

		if (!newName || !newName.trim()) {
			return json({ error: 'Device name is required' }, { status: 400 });
		}

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.renameDevice(deviceId, newName.trim());

		return json(result);
	} catch (error) {
		console.error('Error renaming device:', error);
		return json({ error: 'Failed to rename device' }, { status: 500 });
	}
}