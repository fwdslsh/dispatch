import { json } from '@sveltejs/kit';

export async function GET({ url, locals }) {
	// Auth check endpoint - validates via hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ success: false, error: 'Invalid key' }, { status: 401 });
	}
	return json({ success: true });
}

export async function POST({ request, locals }) {
	// Auth check endpoint - validates via hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ success: false, error: 'Invalid key' }, { status: 401 });
	}
	return json({ success: true });
}
