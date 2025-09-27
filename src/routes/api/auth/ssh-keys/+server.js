import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';

/**
 * SSH Keys management API
 * GET - List user's SSH keys
 * POST - Add new SSH key
 * DELETE - Remove SSH key
 */

export async function GET({ request, locals }) {
	const auth = await verifyAuth(request);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const sshKeys = await locals.services.authManager.db.all(
			'SELECT id, name, fingerprint, created_at FROM ssh_keys WHERE user_id = ? ORDER BY created_at DESC',
			[auth.user.id]
		);

		return json({ keys: sshKeys });
	} catch (error) {
		console.error('Error listing SSH keys:', error);
		return json({ error: 'Failed to list SSH keys' }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	const auth = await verifyAuth(request);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { publicKey, name } = await request.json();

		if (!publicKey || !name) {
			return json({ error: 'Public key and name are required' }, { status: 400 });
		}

		// Use SSHManager to add the key
		const sshManager = locals.services.sshManager;
		const result = await sshManager.addSSHKey(auth.user.id, publicKey, name);

		return json({ 
			success: true, 
			keyId: result.keyId,
			fingerprint: result.fingerprint 
		});
	} catch (error) {
		console.error('Error adding SSH key:', error);
		return json({ error: error.message || 'Failed to add SSH key' }, { status: 500 });
	}
}

export async function DELETE({ request, locals }) {
	const auth = await verifyAuth(request);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { keyId } = await request.json();

		if (!keyId) {
			return json({ error: 'Key ID is required' }, { status: 400 });
		}

		// Use SSHManager to remove the key
		const sshManager = locals.services.sshManager;
		const success = await sshManager.removeSSHKey(auth.user.id, keyId);

		if (!success) {
			return json({ error: 'SSH key not found or access denied' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error removing SSH key:', error);
		return json({ error: 'Failed to remove SSH key' }, { status: 500 });
	}
}