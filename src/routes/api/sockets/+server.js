/**
 * API endpoint to retrieve active Socket.IO connections
 * GET /api/sockets - Returns list of active socket connections
 */

import { json } from '@sveltejs/kit';
import { getActiveSocketIO } from '$lib/server/shared/socket-setup.js';
import { ServiceUnavailableError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url, request: _request, locals: _locals }) {
	try {
		const io = getActiveSocketIO();

		if (!io) {
			throw new ServiceUnavailableError('Socket.IO server not available');
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

		return json({
			sockets: filteredSockets,
			total: filteredSockets.length,
			timestamp: new Date().toISOString()
		});
	} catch (err) {
		handleApiError(err, 'GET /api/sockets');
	}
}
