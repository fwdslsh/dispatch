import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';
import { historyManager } from '$lib/server/history-manager.js';

export async function GET({ url }) {
	const key = url.searchParams.get('key');
	
	if (!validateKey(key)) {
		return json({ error: 'Invalid authentication key' }, { status: 401 });
	}
	
	try {
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