import { json } from '@sveltejs/kit';
import { extractToken } from '$lib/server/shared/auth.js';
import { SSHManager } from '$lib/server/auth/SSHManager.js';

export async function GET({ request, locals }) {
	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ error: 'Authentication system not available' }, { status: 500 });
	}

	// Verify authentication
	const token = extractToken(request);
	if (!token) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const auth = await authManager.verifyToken(token);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const sshManager = new SSHManager(authManager);
		const status = await sshManager.getSSHStatus();

		return json({
			success: true,
			ssh: status
		});
	} catch (error) {
		console.error('SSH status error:', error);
		return json({ error: 'Failed to get SSH status' }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ error: 'Authentication system not available' }, { status: 500 });
	}

	// Verify authentication and admin privileges
	const token = extractToken(request);
	if (!token) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const auth = await authManager.verifyToken(token);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Check if user is admin
	const user = await authManager.db.get('SELECT * FROM users WHERE id = ?', [auth.userId]);
	if (!user || !user.is_admin) {
		return json({ error: 'Admin privileges required' }, { status: 403 });
	}

	try {
		const { enabled, port, allowPasswordAuth } = await request.json();
		
		const sshManager = new SSHManager(authManager);
		const result = await sshManager.updateSSHConfig({
			enabled,
			port,
			allowPasswordAuth
		});

		return json({
			success: true,
			message: result.message
		});
	} catch (error) {
		console.error('SSH config update error:', error);
		return json({ error: error.message || 'Failed to update SSH configuration' }, { status: 500 });
	}
}