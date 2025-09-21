import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/shared/auth.js';
import { createHistoryManager } from '$lib/server/shared/history-manager.js';

export async function GET({ params, url, locals }) {
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
	const { socketId } = params;

	if (!validateKey(key)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}

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
