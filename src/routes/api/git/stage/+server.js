import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function POST({ request, locals: _locals }) {
	try {
		const data = await request.json();
		const { path, files, action } = data;

		if (!path || !files || !Array.isArray(files) || !action) {
			throw new BadRequestError('Path, files array, and action are required', 'MISSING_PARAMS');
		}

		if (!['stage', 'unstage'].includes(action)) {
			throw new BadRequestError('Action must be "stage" or "unstage"', 'INVALID_ACTION');
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
	} catch (err) {
		handleApiError(err, 'POST /api/git/stage');
	}
}
