import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';

export async function GET({ request }) {
	// Check for new token-based auth
	const auth = await verifyAuth(request);
	if (auth) {
		return json({ success: true, method: auth.method, userId: auth.userId });
	}

	return json({ success: false, error: 'Not authenticated' }, { status: 401 });
}

export async function POST({ request }) {
	// POST method also uses token-based auth for consistency
	const auth = await verifyAuth(request);
	if (auth) {
		return json({ success: true, method: auth.method, userId: auth.userId });
	}

	return json({ success: false, error: 'Not authenticated' }, { status: 401 });
}
