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
		const { sessionId, credential } = await request.json();

		if (!sessionId || !credential) {
			return json({ error: 'Session ID and credential required' }, { status: 400 });
		}

		// Complete registration process
		const result = await webauthnAdapter.completeAuthentication(
			sessionId,
			request,
			{ credential }
		);

		return json({
			success: true,
			message: result.message,
			credentialId: result.credentialId
		});

	} catch (error) {
		console.error('WebAuthn registration complete error:', error);
		return json({
			error: 'Failed to complete WebAuthn registration',
			details: error.message
		}, { status: 500 });
	}
}