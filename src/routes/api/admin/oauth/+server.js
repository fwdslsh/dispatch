import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
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

		// Get OAuth configuration
		const oauthConfig = await authManager.getAllOAuthConfig();

		return json({ oauthConfig });
	} catch (error) {
		console.error('Failed to get OAuth config:', error);
		return json({ error: 'Failed to get OAuth config' }, { status: 500 });
	}
}

export async function PUT({ request, locals }) {
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

		const oauthConfig = await request.json();

		// Update OAuth configuration
		await authManager.updateOAuthConfig(oauthConfig);

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update OAuth config:', error);
		return json({ error: error.message || 'Failed to update OAuth config' }, { status: 500 });
	}
}