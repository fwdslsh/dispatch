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
export async function GET({ request }) {
	try {
		// Get WebAuthn configuration for the current environment
		const config = await webauthnAdapter.getConfig(request);
		const isAvailable = await webauthnAdapter.isAvailable(request);
		const adapterInfo = webauthnAdapter.getInfo();

		return json({
			success: true,
			config: {
				...config,
				isAvailable
			},
			adapter: adapterInfo,
			browserSupported: true // Will be checked on client-side
		});

	} catch (error) {
		console.error('WebAuthn config error:', error);
		return json({
			error: 'Failed to get WebAuthn configuration',
			details: error.message,
			isAvailable: false
		}, { status: 500 });
	}
}