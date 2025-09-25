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
		const { userId, deviceName } = await request.json();

		if (!userId) {
			return json({ error: 'User ID required' }, { status: 400 });
		}

		// Check if WebAuthn is available
		const isAvailable = await webauthnAdapter.isAvailable(request);
		if (!isAvailable) {
			return json({
				error: 'WebAuthn not available',
				details: 'HTTPS required (except localhost) and stable hostname needed for WebAuthn'
			}, { status: 400 });
		}

		// Begin registration process
		const registrationData = await webauthnAdapter.beginAuthentication(
			request,
			'webauthn-register',
			{ userId, deviceName: deviceName || 'WebAuthn Device' }
		);

		return json({
			success: true,
			sessionId: registrationData.sessionId,
			challenge: registrationData.challenge
		});

	} catch (error) {
		console.error('WebAuthn registration begin error:', error);
		return json({
			error: 'Failed to begin WebAuthn registration',
			details: error.message
		}, { status: 500 });
	}
}