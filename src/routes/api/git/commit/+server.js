import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, InternalServerError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function POST({ request, locals: _locals }) {
	try {
		const { path, message } = await request.json();

		if (!path || !message) {
			throw new BadRequestError('Path and message are required', 'MISSING_PARAMS');
		}

		const resolvedPath = resolve(path);

		// Create commit
		try {
			const result = await execGit(['commit', '-m', message], resolvedPath);
			return json({ success: true, message: result });
		} catch (err) {
			// Convert git errors to API errors with the git error message
			throw new InternalServerError(err.message || 'Git commit failed');
		}
	} catch (err) {
		handleApiError(err, 'POST /api/git/commit');
	}
}
