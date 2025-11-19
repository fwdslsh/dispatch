import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function POST({ request, locals: _locals }) {
	try {
		const { path, branch } = await request.json();

		if (!path || !branch) {
			throw new BadRequestError('Path and branch are required', 'MISSING_PARAMS');
		}

		const resolvedPath = resolve(path);

		// Checkout branch
		const result = await execGit(['checkout', branch], resolvedPath);

		return json({ success: true, branch, message: result });
	} catch (err) {
		handleApiError(err, 'POST /api/git/checkout');
	}
}
