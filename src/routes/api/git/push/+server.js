import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';


export async function POST({ request, locals }) {
	try {
		const { path, remote = 'origin', branch } = await request.json();

		if (!path) {
			return json({ error: 'Path is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Get current branch if not specified
		const currentBranch =
			branch || (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], resolvedPath));

		// Push changes
		const result = await execGit(['push', remote, currentBranch], resolvedPath);

		return json({ success: true, remote, branch: currentBranch, message: result });
	} catch (error) {
		console.error('Git push error:', error);
		return json({ error: error.message || 'Failed to push changes' }, { status: 500 });
	}
