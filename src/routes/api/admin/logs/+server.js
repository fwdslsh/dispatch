import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';

export async function GET({ url, locals }) {
	const databaseManager = locals.services?.database;
	// Get the terminal key from Authorization header or query parameters
	let key = null;
	if (typeof Request !== 'undefined' && typeof arguments[0]?.request !== 'undefined') {
		const auth = arguments[0].request.headers.get('authorization');
		if (auth && auth.startsWith('Bearer ')) {
			key = auth.slice(7);
		}
	}
	if (!key) {
		key = url.searchParams.get('key');
	}
	// Validate the key
	if (!validateKey(key)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse query params for limit, level, component
	const limit = Math.max(1, Math.min(1000, parseInt(url.searchParams.get('limit') || '100')));
	const level = url.searchParams.get('level') || null;
	const component = url.searchParams.get('component') || null;

	try {
		const logs = await databaseManager.getLogs(component, level, limit);
		return json({ logs });
	} catch (error) {
		console.error('Failed to fetch logs from database:', error);
		return json({ error: 'Failed to fetch logs' }, { status: 500 });
	}
}
