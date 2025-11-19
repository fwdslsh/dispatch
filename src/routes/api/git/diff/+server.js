import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url, request: _request, locals: _locals }) {
	try {
		const path = url.searchParams.get('path');
		const file = url.searchParams.get('file');
		const staged = url.searchParams.get('staged') === 'true';

		if (!path) {
			throw new BadRequestError('Path parameter is required', 'MISSING_PATH');
		}

		const resolvedPath = resolve(path);

		// Build git diff command
		const args = ['diff'];
		if (staged) {
			args.push('--staged');
		}
		if (file) {
			args.push('--', file);
		}

		const diffOutput = await execGit(args, resolvedPath);

		return json({ diff: diffOutput, file, staged });
	} catch (err) {
		handleApiError(err, 'GET /api/git/diff');
	}
}
