import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';

export async function POST({ request, locals: _locals }) {
	try {
		const { path, branch } = await request.json();

		if (!path || !branch) {
			return json({ error: 'Path and branch are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Checkout branch
		const result = await execGit(['checkout', branch], resolvedPath);

		return json({ success: true, branch, message: result });
	} catch (error) {
		console.error('Git checkout error:', error);
		return json({ error: error.message || 'Failed to checkout branch' }, { status: 500 });
	}
}
