import { json } from '@sveltejs/kit';
import { SSHManager } from '$lib/server/auth/SSHManager.js';

export async function GET({ locals }) {
	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not initialized' }, { status: 500 });
	}

	try {
		const isFirstUser = await authManager.checkFirstUser();
		
		// Get OAuth configurations (without secrets)
		const githubConfig = await authManager.getOAuthConfig('github');
		const googleConfig = await authManager.getOAuthConfig('google');

		return json({
			success: true,
			isFirstUser,
			setup: {
				github: !!githubConfig,
				google: !!googleConfig
			}
		});
	} catch (error) {
		console.error('Setup status error:', error);
		return json({ success: false, error: 'Failed to get setup status' }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not initialized' }, { status: 500 });
	}

	try {
		const isFirstUser = await authManager.checkFirstUser();
		if (!isFirstUser) {
			return json({ success: false, error: 'Setup can only be performed by the first user' }, { status: 403 });
		}

		const { username, email, oauth, sshKeys } = await request.json();

		if (!username || !email) {
			return json({ success: false, error: 'Username and email are required' }, { status: 400 });
		}

		// Create the first admin user
		const userId = await authManager.createUser(username, email, true, ['setup']);

		// Configure OAuth providers if provided
		if (oauth) {
			if (oauth.github && oauth.github.clientId && oauth.github.clientSecret) {
				await authManager.setOAuthConfig('github', oauth.github.clientId, oauth.github.clientSecret);
			}
			if (oauth.google && oauth.google.clientId && oauth.google.clientSecret) {
				await authManager.setOAuthConfig('google', oauth.google.clientId, oauth.google.clientSecret);
			}
		}

		// Add SSH keys if provided
		if (sshKeys && Array.isArray(sshKeys)) {
			const sshManager = new SSHManager(authManager);
			await sshManager.init();
			
			for (const sshKey of sshKeys) {
				if (sshKey.publicKey && isValidSSHPublicKey(sshKey.publicKey)) {
					const { keyId } = await authManager.addSSHKey(userId, sshKey.publicKey, sshKey.name || 'Setup Key');
					
					// Also add to system SSH if available
					try {
						await sshManager.addSSHKeyToSystem(username, sshKey.publicKey, keyId);
					} catch (error) {
						console.warn('Failed to add SSH key to system:', error.message);
						// Continue anyway - key is still in database
					}
				}
			}
		}

		return json({
			success: true,
			message: 'Setup completed successfully',
			userId
		});
	} catch (error) {
		console.error('Setup error:', error);
		return json({ success: false, error: 'Setup failed' }, { status: 500 });
	}
}

function isValidSSHPublicKey(key) {
	// Basic SSH public key validation
	const sshKeyPattern = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|ssh-dss)\s+[A-Za-z0-9+\/=]+(\s+.*)?$/;
	return sshKeyPattern.test(key.trim());
}