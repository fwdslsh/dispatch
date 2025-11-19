import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

// Create new branch
export async function POST({ request, locals: _locals }) {
	try {
		const { path, name, checkout = false } = await request.json();

		if (!path || !name) {
			throw new BadRequestError('Path and name are required', 'MISSING_PARAMS');
		}

		const resolvedPath = resolve(path);

		// Create branch
		const args = checkout ? ['checkout', '-b', name] : ['branch', name];
		const result = await execGit(args, resolvedPath);

		return json({ success: true, branch: name, checkout, message: result });
	} catch (err) {
		handleApiError(err, 'POST /api/git/branch');
	}
}
