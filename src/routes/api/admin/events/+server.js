import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';
import { getSocketEvents } from '$lib/server/socket-setup.js';

export async function GET({ url }) {
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
	const limit = parseInt(url.searchParams.get('limit') || '100');
	const socketId = url.searchParams.get('socketId'); // Optional filter by socket

	if (!validateKey(key)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

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
