import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';
import crypto from 'crypto';

/**
 * Generate WebAuthn registration options
 */
export async function POST({ request, locals }) {
	try {
		// Check if user is authenticated (for adding additional credentials)
		// Or if this is first user setup
		const auth = await verifyAuth(request);
		const { username, userDisplayName } = await request.json();

		if (!auth && !locals.services?.authManager?.isFirstUser) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// If authenticated, use existing user; otherwise create new user for first setup
		let userId = auth?.user?.id;
		let actualUsername = auth?.user?.username || username;
		let actualDisplayName = auth?.user?.username || userDisplayName || username;

		if (!userId) {
			// First user setup - create temporary user ID
			userId = crypto.randomUUID();
		}

		const options = await locals.services.authManager.webauthn.generateRegistrationOptions(
			userId,
			actualUsername,
			actualDisplayName
		);

		return json(options);
	} catch (error) {
		console.error('WebAuthn registration options error:', error);
		return json({ error: 'Failed to generate registration options' }, { status: 500 });
	}
}