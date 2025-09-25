import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const params = await request.json();

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.getAuditLogs({
			page: params.page || 1,
			limit: Math.min(params.limit || 50, 100), // Cap at 100 per page
			eventType: params.eventType || '',
			userId: params.userId || '',
			ipAddress: params.ipAddress || '',
			dateFrom: params.dateFrom || null,
			dateTo: params.dateTo || null
		});

		return json(result);
	} catch (error) {
		console.error('Error getting audit logs:', error);
		return json({ error: 'Failed to get audit logs' }, { status: 500 });
	}
}
