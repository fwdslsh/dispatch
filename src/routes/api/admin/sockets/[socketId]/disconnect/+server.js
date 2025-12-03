import { json } from '@sveltejs/kit';
import { getActiveSocketIO } from '$lib/server/shared/socket-setup.js';
import { logger } from '$lib/server/shared/utils/logger.js';
import { ServiceUnavailableError, NotFoundError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function POST({ params, request: _request, locals: _locals }) {
	try {
		const { socketId } = params;

		const io = getActiveSocketIO();

		if (!io) {
			throw new ServiceUnavailableError('Socket.IO server not available');
		}

		// Find and disconnect the specific socket
		const socket = io.sockets.sockets.get(socketId);

		if (!socket) {
			throw new NotFoundError('Socket not found');
		}

		// Disconnect the socket
		socket.disconnect(true);

		logger.info('ADMIN', `Socket ${socketId} disconnected by admin`);

		return json({
			success: true,
			message: `Socket ${socketId} disconnected successfully`,
			timestamp: Date.now()
		});
	} catch (err) {
		handleApiError(err, 'POST /api/admin/sockets/[socketId]/disconnect');
	}
}
