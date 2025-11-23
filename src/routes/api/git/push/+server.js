import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function POST({ request, locals: _locals }) {
	try {
		const { path, remote = 'origin', branch } = await request.json();

		if (!path) {
			throw new BadRequestError('Path is required', 'MISSING_PATH');
		}

		const resolvedPath = resolve(path);

		// Get current branch if not specified
		const currentBranch =
			branch || (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], resolvedPath));

		// Push changes
		const result = await execGit(['push', remote, currentBranch], resolvedPath);

		return json({ success: true, remote, branch: currentBranch, message: result });
	} catch (err) {
		handleApiError(err, 'POST /api/git/push');
	}
}
