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
export async function GET({ url, request }) {
	try {
		const userId = url.searchParams.get('userId');

		if (!userId) {
			return json({ error: 'User ID required' }, { status: 400 });
		}

		// Get user's WebAuthn credentials
		const credentials = await webauthnAdapter.getUserCredentials(parseInt(userId));

		return json({
			success: true,
			credentials
		});

	} catch (error) {
		console.error('WebAuthn credentials fetch error:', error);
		return json({
			error: 'Failed to get WebAuthn credentials',
			details: error.message
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ request }) {
	try {
		const { credentialId, userId } = await request.json();

		if (!credentialId || !userId) {
			return json({ error: 'Credential ID and User ID required' }, { status: 400 });
		}

		// Revoke the credential
		const result = await webauthnAdapter.revokeCredential(credentialId, parseInt(userId));

		return json({
			success: true,
			message: 'WebAuthn credential revoked successfully'
		});

	} catch (error) {
		console.error('WebAuthn credential revoke error:', error);
		return json({
			error: 'Failed to revoke WebAuthn credential',
			details: error.message
		}, { status: 500 });
	}
}