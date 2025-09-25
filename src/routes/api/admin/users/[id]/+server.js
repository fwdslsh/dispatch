import { json } from '@sveltejs/kit';
import { AdminInterfaceManager } from '$lib/server/shared/admin/AdminInterfaceManager.js';

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const userId = params.id;

		// Prevent admin from deleting themselves
		if (userId === locals.user.id) {
			return json({ error: 'Cannot delete your own account' }, { status: 400 });
		}

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.deleteUser(userId);

		return json(result);
	} catch (error) {
		console.error('Error deleting user:', error);
		return json({ error: error.message || 'Failed to delete user' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const userId = params.id;
		const updates = await request.json();

		const adminManager = new AdminInterfaceManager(locals.db);
		const result = await adminManager.updateUser(userId, updates);

		return json(result);
	} catch (error) {
		console.error('Error updating user:', error);
		return json({ error: error.message || 'Failed to update user' }, { status: 500 });
	}
}
