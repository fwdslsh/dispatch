import { json } from '@sveltejs/kit';
import { OAuthManager } from '$lib/server/shared/auth/OAuthManager.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	// Check authentication and admin status
	if (!locals.user || !locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { provider } = await request.json();

		if (!provider) {
			return json({ error: 'Provider is required' }, { status: 400 });
		}

		const oauthManager = new OAuthManager(locals.db);
		const result = await oauthManager.testProvider(provider);

		if (result.success) {
			return json({ success: true, message: `${provider} OAuth configuration is valid` });
		} else {
			return json({ success: false, error: result.error || `Failed to test ${provider} configuration` });
		}
	} catch (error) {
		console.error('Error testing OAuth provider:', error);
		return json({ error: 'Failed to test OAuth provider' }, { status: 500 });
	}
}