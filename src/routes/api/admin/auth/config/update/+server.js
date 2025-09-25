import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { updates } = await request.json();

		if (!updates) {
			return json({ error: 'Updates are required' }, { status: 400 });
		}

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.updateAuthConfiguration(updates);

		return json(result);
	} catch (error) {
		console.error('Error updating auth configuration:', error);
		return json({ error: 'Failed to update authentication configuration' }, { status: 500 });
	}
}