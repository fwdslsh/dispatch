import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';
import crypto from 'crypto';

/**
 * Verify WebAuthn registration response
 */
export async function POST({ request, locals, cookies }) {
	try {
		const { challengeId, response, credentialName, userData } = await request.json();

		const authManager = locals.services.authManager;

		// Check if this is first user setup and create user BEFORE verifying registration
		let userId = null;
		if (authManager.isFirstUser && userData) {
			// Create the first user account
			userId = crypto.randomUUID();
			const now = Date.now();

			await authManager.db.run(
				`INSERT INTO users (id, username, email, is_admin, auth_methods, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					userId,
					userData.username,
					userData.email || null,
					true, // First user is admin
					JSON.stringify(['webauthn']),
					now,
					now
				]
			);

			// Update the challenge with the real user ID before verification
			await authManager.db.run(
				'UPDATE webauthn_challenges SET user_id = ? WHERE id = ?',
				[userId, challengeId]
			);
		}

		const verification = await authManager.webauthn.verifyRegistrationResponse(
			challengeId,
			response,
			credentialName
		);

		if (!verification.verified) {
			// Rollback user creation if verification fails
			if (userId) {
				await authManager.db.run('DELETE FROM users WHERE id = ?', [userId]);
			}
			return json({ error: 'Registration verification failed' }, { status: 400 });
		}

		// Check if this is first user setup
		if (authManager.isFirstUser && userData && userId) {
			// Create session
			const sessionId = crypto.randomUUID();
			const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

			await authManager.db.run(
				`INSERT INTO auth_sessions (id, user_id, method, expires_at, created_at, metadata)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				[sessionId, userId, 'webauthn', expiresAt, Date.now(), JSON.stringify({ credentialId: verification.credentialId })]
			);

			// Generate JWT
			const token = authManager.generateJWT(userId, sessionId);

			// Set secure cookie
			cookies.set('dispatch-auth-token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 7 * 24 * 60 * 60, // 7 days
				path: '/'
			});

			await authManager.checkFirstUser(); // Update first user status

			return json({ success: true, isFirstUser: true });
		}

		// Adding credential to existing user
		return json({ success: true, credentialId: verification.credentialId });
	} catch (error) {
		console.error('WebAuthn registration verification error:', error);
		return json({ error: error.message || 'Registration verification failed' }, { status: 500 });
	}
}