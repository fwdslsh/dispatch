import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';
import { getActiveSocketIO } from '$lib/server/socket-setup.js';

export async function POST({ params, request, locals }) {
	const { socketId } = params;
	const auth = request.headers.get('authorization');
	const key = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
	if (!validateKey(key)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	try {
		const io = getActiveSocketIO();

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
