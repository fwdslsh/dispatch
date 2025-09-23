import { json } from '@sveltejs/kit';
import { extractToken } from '$lib/server/shared/auth.js';

export async function GET({ request, locals }) {
	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not available' }, { status: 500 });
	}

	// Check for token-based auth
	const token = extractToken(request);
	if (!token) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	const auth = await authManager.verifyToken(token);
	if (auth) {
		return json({ success: true, method: auth.method, userId: auth.userId });
	}

	return json({ success: false, error: 'Not authenticated' }, { status: 401 });
}

export async function POST({ request, locals }) {
	const authManager = locals.services?.authManager;
	if (!authManager) {
		return json({ success: false, error: 'Authentication system not available' }, { status: 500 });
	}

	// POST method also uses token-based auth for consistency
	const token = extractToken(request);
	if (!token) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	const auth = await authManager.verifyToken(token);
	if (auth) {
		return json({ success: true, method: auth.method, userId: auth.userId });
	}

	return json({ success: false, error: 'Not authenticated' }, { status: 401 });
}
