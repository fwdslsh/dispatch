import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { page, limit, search, orderBy, order } = await request.json();

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.listUsers({
			page: page || 1,
			limit: Math.min(limit || 10, 100), // Cap at 100 per page
			search: search || '',
			orderBy: orderBy || 'created_at',
			order: order || 'DESC'
		});

		return json(result);
	} catch (error) {
		console.error('Error listing users:', error);
		return json({ error: 'Failed to list users' }, { status: 500 });
	}
}