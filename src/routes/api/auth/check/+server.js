import { json } from '@sveltejs/kit';
import { validateKey, verifyAuth, getAuthManager } from '$lib/server/shared/auth.js';

export async function GET({ url, request }) {
	// Check for new token-based auth first
	const auth = await verifyAuth(request);
	if (auth) {
		return json({ success: true, method: auth.legacy ? 'legacy' : auth.method });
	}

	// Fallback to legacy key validation
	const key = url.searchParams.get('key') || '';
	if (!validateKey(key)) {
		return json({ success: false, error: 'Invalid key' }, { status: 401 });
	}
	return json({ success: true, method: 'legacy' });
}

export async function POST({ request, cookies }) {
	try {
		const { key } = await request.json();
		
		// First try new authentication system
		const authManager = getAuthManager();
		if (authManager && key !== process.env.TERMINAL_KEY) {
			// Try to interpret key as an SSH public key
			if (isValidSSHPublicKey(key)) {
				const sshKeyData = await authManager.verifySSHKey(key);
				if (sshKeyData) {
					// Create session for SSH key auth
					const session = await authManager.createSession(sshKeyData.user_id, 'ssh_key');
					
					// Set secure cookie
					cookies.set('dispatch-auth-token', session.token, {
						path: '/',
						httpOnly: true,
						secure: process.env.NODE_ENV === 'production',
						sameSite: 'lax',
						maxAge: 60 * 60 * 24 * 7 // 7 days
					});
					
					return json({ success: true, method: 'ssh_key' });
				}
			}
		}

		// Fallback to legacy key validation
		if (!validateKey(key)) {
			return json({ success: false, error: 'Invalid key' }, { status: 401 });
		}
		return json({ success: true, method: 'legacy' });
	} catch (err) {
		console.error('Auth check error:', err);
		return json({ success: false, error: 'Malformed request' }, { status: 400 });
	}
}

function isValidSSHPublicKey(key) {
	// Basic SSH public key validation
	const sshKeyPattern = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|ssh-dss)\s+[A-Za-z0-9+\/=]+(\s+.*)?$/;
	return sshKeyPattern.test(key.trim());
}
