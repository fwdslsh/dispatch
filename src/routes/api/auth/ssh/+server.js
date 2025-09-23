import { json } from '@sveltejs/kit';
import { getAuthManager } from '$lib/server/shared/auth.js';

export async function POST({ request, cookies }) {
	const authManager = getAuthManager();
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not initialized' }, { status: 500 });
	}

	try {
		const { publicKey } = await request.json();

		if (!publicKey || typeof publicKey !== 'string') {
			return json({ success: false, error: 'Public key is required' }, { status: 400 });
		}

		// Validate SSH public key format
		const trimmedKey = publicKey.trim();
		if (!isValidSSHPublicKey(trimmedKey)) {
			return json({ success: false, error: 'Invalid SSH public key format' }, { status: 400 });
		}

		// Verify SSH key authentication
		const sshKeyData = await authManager.verifySSHKey(trimmedKey);
		if (!sshKeyData) {
			return json({ success: false, error: 'SSH key not authorized' }, { status: 401 });
		}

		// Create session
		const session = await authManager.createSession(sshKeyData.user_id, 'ssh_key', undefined, {
			sshKeyId: sshKeyData.id,
			fingerprint: sshKeyData.fingerprint
		});

		// Set secure cookie
		cookies.set('dispatch-auth-token', session.token, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({
			success: true,
			user: {
				id: sshKeyData.user_id,
				username: sshKeyData.username,
				email: sshKeyData.email
			},
			sessionId: session.sessionId
		});
	} catch (error) {
		console.error('SSH key authentication error:', error);
		return json({ success: false, error: 'SSH key authentication failed' }, { status: 500 });
	}
}

function isValidSSHPublicKey(key) {
	// Basic SSH public key validation
	// Supports ssh-rsa, ssh-ed25519, ecdsa-sha2-*, ssh-dss
	const sshKeyPattern = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|ssh-dss)\s+[A-Za-z0-9+\/=]+(\s+.*)?$/;
	return sshKeyPattern.test(key);
}