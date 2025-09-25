import { json } from '@sveltejs/kit';
import { WebAuthnAdapter } from '$lib/server/shared/auth/adapters/WebAuthnAdapter.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';

const db = new DatabaseManager();
let webauthnAdapter;

// Initialize WebAuthn adapter
(async () => {
	await db.init();
	webauthnAdapter = new WebAuthnAdapter(db);
})();

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { username } = await request.json();

		// Check if WebAuthn is available
		const isAvailable = await webauthnAdapter.isAvailable(request);
		if (!isAvailable) {
			return json({
				error: 'WebAuthn not available',
				details: 'HTTPS required (except localhost) and stable hostname needed for WebAuthn'
			}, { status: 400 });
		}

		// Begin authentication process
		const authData = await webauthnAdapter.beginAuthentication(
			request,
			'webauthn-authenticate',
			{ username }
		);

		return json({
			success: true,
			sessionId: authData.sessionId,
			challenge: authData.challenge
		});

	} catch (error) {
		console.error('WebAuthn authentication begin error:', error);
		return json({
			error: 'Failed to begin WebAuthn authentication',
			details: error.message
		}, { status: 500 });
	}
}