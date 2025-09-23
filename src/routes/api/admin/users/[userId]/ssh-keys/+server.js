import { json } from '@sveltejs/kit';

export async function GET({ params, locals }) {
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

		// Get SSH keys for user
		const sshKeys = await authManager.getUserSSHKeys(userId);

		return json({ sshKeys });
	} catch (error) {
		console.error('Failed to get SSH keys:', error);
		return json({ error: 'Failed to get SSH keys' }, { status: 500 });
	}
}

export async function POST({ params, request, locals }) {
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
		const { name, publicKey } = await request.json();

		if (!name || !publicKey) {
			return json({ error: 'Name and public key are required' }, { status: 400 });
		}

		// Add SSH key for user
		const sshKey = await authManager.addUserSSHKey(userId, { name, publicKey });

		return json({ sshKey });
	} catch (error) {
		console.error('Failed to add SSH key:', error);
		return json({ error: error.message || 'Failed to add SSH key' }, { status: 500 });
	}
}