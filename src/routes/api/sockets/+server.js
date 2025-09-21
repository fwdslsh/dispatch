/**
 * API endpoint to retrieve active Socket.IO connections
 * GET /api/sockets - Returns list of active socket connections
 */

import { getActiveSocketIO } from '$lib/server/shared/socket-setup.js';

export async function GET({ url, locals }) {
	try {
		const io = getActiveSocketIO();

		if (!io) {
			return new Response(
				JSON.stringify({
					error: 'Socket.IO server not available',
					sockets: []
				}),
				{
					status: 503,
					headers: { 'content-type': 'application/json' }
				}
			);
		}

		// Get all connected sockets
		const sockets = await io.fetchSockets();

		// Extract relevant information from each socket
		const socketInfo = sockets.map((socket) => ({
			id: socket.id,
			connected: socket.connected,
			disconnected: socket.disconnected,
			handshake: {
				time: socket.handshake.time,
				address: socket.handshake.address,
				headers: socket.handshake.headers,
				query: socket.handshake.query,
				auth: socket.handshake.auth
			},
			rooms: Array.from(socket.rooms),
			data: socket.data // Custom data attached to the socket
		}));

		// Optional: filter by room if provided
		const room = url.searchParams.get('room');
		const filteredSockets = room ? socketInfo.filter((s) => s.rooms.includes(room)) : socketInfo;

		return new Response(
			JSON.stringify({
				sockets: filteredSockets,
				total: filteredSockets.length,
				timestamp: new Date().toISOString()
			}),
			{
				headers: { 'content-type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('[API] Error fetching sockets:', error);
		return new Response(
			JSON.stringify({
				error: error.message,
				sockets: []
			}),
			{
				status: 500,
				headers: { 'content-type': 'application/json' }
			}
		);
	}
}
