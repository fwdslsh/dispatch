import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';

export async function POST({ request, locals }) {
	let action = 'unknown'; // Define in outer scope for error handler
	try {
		const data = await request.json();
		const { path, files } = data;
		action = data.action;

		if (!path || !files || !Array.isArray(files) || !action) {
			return json({ error: 'Path, files array, and action are required' }, { status: 400 });
		}

		if (!['stage', 'unstage'].includes(action)) {
			return json({ error: 'Action must be "stage" or "unstage"' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Execute git add or git reset for each file
		for (const file of files) {
			if (action === 'stage') {
				await execGit(['add', file], resolvedPath);
			} else {
				await execGit(['reset', 'HEAD', file], resolvedPath);
			}
		}

		return json({ success: true, action, files });
	} catch (error) {
		console.error('Git stage error:', error);
		return json({ error: error.message || `Failed to ${action} files` }, { status: 500 });
	}
}
