import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';

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
       if (!validateKey(key)) {
	       return json({ error: 'Invalid authentication key' }, { status: 401 });
       }

	try {
		// Get the Socket.IO instance from global state
		const io = globalThis.__DISPATCH_SOCKET_IO;

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
