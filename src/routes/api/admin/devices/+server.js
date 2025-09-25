import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const userId = url.searchParams.get('userId');
		const page = parseInt(url.searchParams.get('page') || '1', 10);
		const limit = parseInt(url.searchParams.get('limit') || '20', 10);

		const adminManager = new AdminInterfaceManager(locals.db);

		let result;
		if (userId) {
			// Get devices for a specific user
			result = await adminManager.getUserDevices(userId, { page, limit });
		} else {
			// Get all devices across all users
			result = await adminManager.getAllDevices({ page, limit });
		}

		return json(result);
	} catch (error) {
		console.error('Error fetching devices:', error);
		return json({ error: 'Failed to fetch devices' }, { status: 500 });
	}
}
