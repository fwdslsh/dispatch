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

		// Get all devices across all users
		const devices = await locals.db.all(`
			SELECT d.id, d.device_name as deviceName, d.device_fingerprint as deviceFingerprint,
				   d.is_trusted as isTrusted, d.created_at as createdAt,
				   u.username, u.id as userId,
				   COUNT(s.id) as activeSessions
			FROM user_devices d
			JOIN users u ON d.user_id = u.id
			LEFT JOIN auth_sessions s ON d.id = s.device_id AND s.is_active = 1
			GROUP BY d.id
			ORDER BY d.created_at DESC
		`);

		return json({ devices });
	} catch (error) {
		console.error('Error listing all devices:', error);
		return json({ error: 'Failed to list devices' }, { status: 500 });
	}
}
