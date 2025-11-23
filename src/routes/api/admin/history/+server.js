import { json } from '@sveltejs/kit';
import { createHistoryManager } from '$lib/server/shared/history-manager.js';
import { handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url: _url, locals }) {
	try {
		const historyManager = createHistoryManager(locals.services.database);
		const histories = await historyManager.listSocketHistories();

		return json({
			histories,
			total: histories.length,
			timestamp: Date.now()
		});
	} catch (err) {
		handleApiError(err, 'GET /api/admin/history');
	}
}
