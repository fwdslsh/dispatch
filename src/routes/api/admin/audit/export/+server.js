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
		const result = await adminManager.exportAuditLogs({
			format: params.format || 'json',
			dateFrom: params.dateFrom || null,
			dateTo: params.dateTo || null
		});

		return json(result);
	} catch (error) {
		console.error('Error exporting audit logs:', error);
		return json({ error: 'Failed to export audit logs' }, { status: 500 });
	}
}
