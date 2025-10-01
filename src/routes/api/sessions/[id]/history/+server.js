import { json, error } from '@sveltejs/kit';

export async function GET({ params, request, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: \'Authentication required\' }, { status: 401 });
	}

	const { id } = params;

	try {
		const db = locals.services?.database;
		if (!db) {
			throw new Error('Database not available');
		}

		// Get session events from unified database
		const events = await db.getSessionEventsSince(id, 0);
		return json({ events });
	} catch (err) {
		console.error('Failed to read terminal history from database:', err);
		return json({ history: '' }); // Return empty history on error
	}
}
