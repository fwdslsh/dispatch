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

		// Complete authentication process
		const result = await webauthnAdapter.completeAuthentication(
			sessionId,
			request,
			{ credential }
		);

		if (!result.success) {
			return json({
				error: 'Authentication failed',
				details: result.message
			}, { status: 401 });
		}

		return json({
			success: true,
			user: result.user,
			authMethod: 'webauthn'
		});

	} catch (error) {
		console.error('WebAuthn authentication complete error:', error);
		return json({
			error: 'Failed to complete WebAuthn authentication',
			details: error.message
		}, { status: 500 });
	}
}