import { json, error } from '@sveltejs/kit';

export async function GET({ params, request, locals }) {
	const { id } = params;

	try {
		const eventStore = locals.services?.eventStore;
		if (!eventStore) {
			throw new Error('EventStore not available');
		}

		// Get all session events from sequence 0
		const events = await eventStore.getEvents(id, 0);
		return json({ events });
	} catch (err) {
		console.error('Failed to read terminal history from database:', err);
		return json({ events: [] }); // Return empty events on error
	}
}
