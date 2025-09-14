import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';

export async function POST({ params, request }) {
	const { socketId } = params;
	let key = null;
	const auth = request.headers.get('authorization');
	if (auth && auth.startsWith('Bearer ')) {
		key = auth.slice(7);
	}
	if (!key) {
		// fallback to body for backward compatibility
		const body = await request.json();
		key = body.key;
	}
	if (!validateKey(key)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	try {
		// Get the Socket.IO instance from global state
		const io = globalThis.__DISPATCH_SOCKET_IO;

		if (!io) {
			return json({ error: 'Socket.IO server not available' }, { status: 500 });
		}

		// Find and disconnect the specific socket
		const socket = io.sockets.sockets.get(socketId);

		if (!socket) {
			return json({ error: 'Socket not found' }, { status: 404 });
		}

		// Disconnect the socket
		socket.disconnect(true);

		console.log(`[ADMIN] Socket ${socketId} disconnected by admin`);

		return json({
			success: true,
			message: `Socket ${socketId} disconnected successfully`,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('Error disconnecting socket:', error);
		return json({ error: 'Failed to disconnect socket' }, { status: 500 });
	}
}
