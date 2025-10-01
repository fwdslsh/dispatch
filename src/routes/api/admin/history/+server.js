import { json } from '@sveltejs/kit';
import { createHistoryManager } from '$lib/server/shared/history-manager.js';

export async function GET({ url, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

	try {
		const historyManager = createHistoryManager(locals.services.database);
		const histories = await historyManager.listSocketHistories();

		return json({
			histories,
			total: histories.length,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('Error getting socket histories:', error);
		return json({ error: 'Failed to get socket histories' }, { status: 500 });
	}
}
