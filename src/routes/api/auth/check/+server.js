import { json } from '@sveltejs/kit';

export async function GET({ url, locals }) {
	const key = url.searchParams.get('key') || '';
	if (!locals.services.auth.validateKey(key)) {
		return json({ success: false, error: 'Invalid key' }, { status: 401 });
	}
	return json({ success: true });
}

export async function POST({ request, locals }) {
	try {
		const { key } = await request.json();
		if (!locals.services.auth.validateKey(key)) {
			return json({ success: false, error: 'Invalid key' }, { status: 401 });
		}
		return json({ success: true });
	} catch (err) {
		return json({ success: false, error: 'Malformed request' }, { status: 400 });
	}
}
