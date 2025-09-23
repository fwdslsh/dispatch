import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';
import { getSocketEvents } from '$lib/server/shared/socket-setup.js';

export async function GET({ url, request }) {
	// Verify authentication
	const auth = await verifyAuth(request);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const limit = parseInt(url.searchParams.get('limit') || '100');
	const socketId = url.searchParams.get('socketId'); // Optional filter by socket

	try {
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
	} catch (error) {
		console.error('Error getting socket events:', error);
		return json({ error: 'Failed to get socket events' }, { status: 500 });
	}
}
