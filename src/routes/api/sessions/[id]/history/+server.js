import { json, error } from '@sveltejs/kit';
import { getDatabaseManager } from '$lib/server/db/DatabaseManager.js';

export async function GET({ params }) {
	const { id } = params;

	try {
		const db = getDatabaseManager();
		await db.init();

		// Get terminal history from database
		const history = await db.getTerminalHistory(id);
		return json({ history });
	} catch (err) {
		console.error('Failed to read terminal history from database:', err);
		return json({ history: '' }); // Return empty history on error
	}
}
