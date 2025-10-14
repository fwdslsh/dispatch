import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';

export async function POST({ request, locals: _locals }) {
	try {
		const { path, message } = await request.json();

		if (!path || !message) {
			return json({ error: 'Path and message are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Create commit
		const result = await execGit(['commit', '-m', message], resolvedPath);

		return json({ success: true, message: result });
	} catch (error) {
		console.error('Git commit error:', error);
		return json({ error: error.message || 'Failed to commit changes' }, { status: 500 });
	}
}
