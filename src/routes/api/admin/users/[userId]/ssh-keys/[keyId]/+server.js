import { json } from '@sveltejs/kit';

export async function DELETE({ params, locals }) {
	const authManager = locals.services?.authManager;

	if (!authManager) {
		return json({ error: 'Authentication system not initialized' }, { status: 500 });
	}

	try {
		// Get current user to check admin status
		const currentUser = locals.user;
		if (!currentUser || !currentUser.isAdmin) {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		const { userId, keyId } = params;

		// Delete SSH key
		await authManager.deleteUserSSHKey(userId, keyId);

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete SSH key:', error);
		return json({ error: error.message || 'Failed to delete SSH key' }, { status: 500 });
	}
}