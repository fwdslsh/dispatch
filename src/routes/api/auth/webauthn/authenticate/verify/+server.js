import { json } from '@sveltejs/kit';
import crypto from 'crypto';

/**
 * Verify WebAuthn authentication response
 */
export async function POST({ request, locals, cookies }) {
	try {
		const { challengeId, response } = await request.json();

		const authManager = locals.services.authManager;
		const verification = await authManager.webauthn.verifyAuthenticationResponse(
			challengeId,
			response
		);

		if (!verification.verified || !verification.user) {
			return json({ error: 'Authentication verification failed' }, { status: 400 });
		}

		// Create session
		const sessionId = crypto.randomUUID();
		const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

		await authManager.db.run(
			`INSERT INTO auth_sessions (id, user_id, method, expires_at, created_at, metadata)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[sessionId, verification.user.id, 'webauthn', expiresAt, Date.now(), JSON.stringify({})]
		);

		// Generate JWT
		const token = authManager.generateJWT(verification.user.id, sessionId);

		// Set secure cookie
		cookies.set('dispatch-auth-token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60, // 7 days
			path: '/'
		});

		return json({ 
			success: true, 
			user: {
				id: verification.user.id,
				username: verification.user.username,
				email: verification.user.email,
				isAdmin: verification.user.is_admin
			}
		});
	} catch (error) {
		console.error('WebAuthn authentication verification error:', error);
		return json({ error: error.message || 'Authentication verification failed' }, { status: 500 });
	}
}