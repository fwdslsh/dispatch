import { json } from '@sveltejs/kit';
import { getSocketEvents } from '$lib/server/shared/socket-setup.js';
import { handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url, locals: _locals }) {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const socketId = url.searchParams.get('socketId'); // Optional filter by socket

		let events = getSocketEvents(Math.min(limit, 500));

		// Filter by socketId if specified
		if (socketId) {
			events = events.filter((event) => event.socketId === socketId);
		}

		return json({
			events,
			total: events.length,
			timestamp: Date.now()
		});
	} catch (err) {
		handleApiError(err, 'GET /api/admin/events');
	}
}
