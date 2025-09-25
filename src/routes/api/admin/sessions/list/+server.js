import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const adminManager = new AdminInterfaceManager(locals.db);
		const sessions = await adminManager.listActiveSessions();

		return json({ sessions });
	} catch (error) {
		console.error('Error listing active sessions:', error);
		return json({ error: 'Failed to list active sessions' }, { status: 500 });
	}
}