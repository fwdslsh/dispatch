import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';
import { getActiveSocketIO } from '$lib/server/shared/socket-setup.js';

export async function POST({ params, request }) {
	// Verify authentication
	const auth = await verifyAuth(request);
	if (!auth) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { socketId } = params;

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
