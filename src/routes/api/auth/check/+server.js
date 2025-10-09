import { json } from '@sveltejs/kit';

/**
 * Public endpoint to check authentication status
 * Always returns 200 OK with authenticated flag
 */
export async function GET({ url, locals }) {
	// Return authentication status without 401 error
	if (!locals.auth?.authenticated) {
		return json({ authenticated: false });
	}

	return json({
		authenticated: true,
		provider: locals.auth.provider,
		userId: locals.auth.userId
	});
}

export async function POST({ request, locals }) {
	// Same as GET - just check auth status
	if (!locals.auth?.authenticated) {
		return json({ authenticated: false });
	}

	return json({
		authenticated: true,
		provider: locals.auth.provider,
		userId: locals.auth.userId
	});
}
