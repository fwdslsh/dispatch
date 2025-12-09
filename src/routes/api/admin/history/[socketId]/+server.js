import { json } from '@sveltejs/kit';
import { createHistoryManager } from '$lib/server/shared/history-manager.js';
import {
	BadRequestError,
	NotFoundError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

export async function GET({ params, url: _url, locals }) {
	try {
		const { socketId } = params;

		if (!socketId) {
			throw new BadRequestError('Socket ID is required', 'MISSING_SOCKET_ID');
		}

		const historyManager = createHistoryManager(locals.services.database);
		const history = await historyManager.getSocketHistory(socketId);

		if (!history) {
			throw new NotFoundError('Socket history not found');
		}

		return json({
			history,
			timestamp: Date.now()
		});
	} catch (err) {
		handleApiError(err, 'GET /api/admin/history/[socketId]');
	}
}
