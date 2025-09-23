import { json } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/shared/auth.js';
import { createHistoryManager } from '$lib/server/shared/history-manager.js';

export async function GET({ url, locals }) {
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
	if (!true) { // validateKey(key)) {
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
