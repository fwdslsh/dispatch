import { json } from '@sveltejs/kit';
import { createHistoryManager } from '$lib/server/shared/history-manager.js';

export async function GET({ params, url, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	const { socketId } = params;

	if (!socketId) {
		return json({ error: 'Socket ID is required' }, { status: 400 });
	}

	try {
		const historyManager = createHistoryManager(locals.services.database);
		const history = await historyManager.getSocketHistory(socketId);

		if (!history) {
			return json({ error: 'Socket history not found' }, { status: 404 });
		}

		return json({
			history,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error(`Error getting socket history for ${socketId}:`, error);
		return json({ error: 'Failed to get socket history' }, { status: 500 });
	}
}
