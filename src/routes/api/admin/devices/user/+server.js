import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { userId } = await request.json();

		if (!userId) {
			return json({ error: 'User ID is required' }, { status: 400 });
		}

		const adminManager = new AdminInterfaceManager(locals.db);
		const devices = await adminManager.listUserDevices(userId);

		return json({ devices });
	} catch (error) {
		console.error('Error listing user devices:', error);
		return json({ error: 'Failed to list user devices' }, { status: 500 });
	}
}