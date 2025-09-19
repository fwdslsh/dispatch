import { json, error } from '@sveltejs/kit';

export async function GET({ params, locals }) {
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
