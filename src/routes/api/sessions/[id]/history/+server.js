import { json } from '@sveltejs/kit';
import { ServiceUnavailableError, handleApiError } from '$lib/server/shared/utils/api-errors.js';
import { logger } from '$lib/server/shared/utils/logger.js';

export async function GET({ params, request: _request, locals }) {
	const { id } = params;

	try {
		const eventStore = locals.services?.eventStore;
		if (!eventStore) {
			throw new ServiceUnavailableError('EventStore not available', 'EVENTSTORE_UNAVAILABLE');
		}

		// Get all session events from sequence 0
		const events = await eventStore.getEvents(id, 0);
		return json({ events });
	} catch (err) {
		// Log the error but return empty events gracefully for better UX
		// Session history is non-critical and should degrade gracefully
		logger.warn('SESSION_HISTORY', `Failed to read session history for ${id}:`, err);
		return json({ events: [] });
	}
}
