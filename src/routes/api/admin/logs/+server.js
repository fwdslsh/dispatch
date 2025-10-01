import { json } from '@sveltejs/kit';

export async function GET({ url, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const databaseManager = locals.services?.database;

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
