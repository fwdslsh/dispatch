import { json } from '@sveltejs/kit';

export async function PUT({ params, request, locals }) {
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

		const { userId } = params;
		const updates = await request.json();

		// Prevent removing admin status from the last admin
		if (updates.isAdmin === false) {
			const users = await authManager.getAllUsers();
			const adminUsers = users.filter(u => u.isAdmin && u.id !== parseInt(userId));
			if (adminUsers.length === 0) {
				return json({ error: 'Cannot remove admin status from the last admin user' }, { status: 400 });
			}
		}

		// Update user
		const updatedUser = await authManager.updateUser(userId, updates);

		return json({ user: updatedUser });
	} catch (error) {
		console.error('Failed to update user:', error);
		return json({ error: error.message || 'Failed to update user' }, { status: 500 });
	}
}

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

		const { userId } = params;

		// Prevent deleting the current user
		if (currentUser.id === parseInt(userId)) {
			return json({ error: 'Cannot delete your own account' }, { status: 400 });
		}

		// Prevent deleting the last admin
		const users = await authManager.getAllUsers();
		const userToDelete = users.find(u => u.id === parseInt(userId));
		if (userToDelete?.isAdmin) {
			const adminUsers = users.filter(u => u.isAdmin && u.id !== parseInt(userId));
			if (adminUsers.length === 0) {
				return json({ error: 'Cannot delete the last admin user' }, { status: 400 });
			}
		}

		// Delete user
		await authManager.deleteUser(userId);

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete user:', error);
		return json({ error: error.message || 'Failed to delete user' }, { status: 500 });
	}
}