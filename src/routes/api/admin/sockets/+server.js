import { json } from '@sveltejs/kit';
import { getActiveSocketIO } from '$lib/server/shared/socket-setup.js';

export async function GET({ url: _url, locals: _locals, request: _request }) {
	try {
		const io = getActiveSocketIO();

		if (!io) {
			return json({ error: 'Socket.IO server not available' }, { status: 500 });
		}

		// Get all connected sockets
		const sockets = [];
		const socketIds = await io.allSockets();

		for (const socketId of socketIds) {
			const socket = io.sockets.sockets.get(socketId);
			if (socket) {
				const socketInfo = {
					id: socketId,
					ip: socket.handshake.address || socket.conn.remoteAddress || 'Unknown',
					connectedAt: socket.data?.connectedAt || socket.handshake.time || Date.now(),
					authenticated: socket.data?.authenticated || false,
					userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
					rooms: Array.from(socket.rooms).filter((room) => room !== socketId)
				};
				sockets.push(socketInfo);
			}
		}

		return json({
			sockets,
			total: sockets.length,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('Error getting active sockets:', error);
		return json({ error: 'Failed to get active sockets' }, { status: 500 });
	}
}
