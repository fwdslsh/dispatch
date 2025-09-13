import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/auth.js';

export async function GET({ url }) {
	const key = url.searchParams.get('key') || '';
	if (!validateKey(key)) {
		return json({ success: false, error: 'Invalid key' }, { status: 401 });
	}
	return json({ success: true });
}

export async function POST({ request }) {
	try {
		const { key } = await request.json();
		if (!validateKey(key)) {
			return json({ success: false, error: 'Invalid key' }, { status: 401 });
		}
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: 'Malformed request' }, { status: 400 });
	}
}

