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
		const { oldHostname, newHostname, userId } = await request.json();

		if (!oldHostname || !newHostname) {
			return json({ error: 'Old hostname and new hostname required' }, { status: 400 });
		}

		// Check hostname compatibility
		const compatibility = await webauthnAdapter.checkHostnameCompatibility(
			oldHostname,
			newHostname,
			userId ? parseInt(userId) : null
		);

		return json({
			success: true,
			compatibility
		});

	} catch (error) {
		console.error('WebAuthn hostname check error:', error);
		return json({
			error: 'Failed to check hostname compatibility',
			details: error.message
		}, { status: 500 });
	}
}