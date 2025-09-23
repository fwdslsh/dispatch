import { json } from '@sveltejs/kit';

export async function GET({ locals, url }) {
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

		// Get all users
		const users = await authManager.getAllUsers();

		return json({ users });
	} catch (error) {
		console.error('Failed to get users:', error);
		return json({ error: 'Failed to get users' }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
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

		const { username, email, isAdmin = false } = await request.json();

		if (!username || !email) {
			return json({ error: 'Username and email are required' }, { status: 400 });
		}

		// Create new user
		const user = await authManager.createUser({
			username,
			email,
			isAdmin
		});

		return json({ user });
	} catch (error) {
		console.error('Failed to create user:', error);
		return json({ error: error.message || 'Failed to create user' }, { status: 500 });
	}
}