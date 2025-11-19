import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url, request: _request, locals: _locals }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			throw new BadRequestError('Path parameter is required', 'MISSING_PATH');
		}

		const resolvedPath = resolve(path);

		// Get all branches (local and remote)
		const branchOutput = await execGit(['branch', '-a'], resolvedPath);
		const branches = branchOutput
			.split('\n')
			.map((line) =>
				line
					.trim()
					.replace(/^\*\s+/, '')
					.replace(/^remotes\/origin\//, '')
			)
			.filter((branch) => branch && !branch.includes('HEAD'))
			.filter((branch, index, arr) => arr.indexOf(branch) === index); // Remove duplicates

		return json({ branches });
	} catch (err) {
		handleApiError(err, 'GET /api/git/branches');
	}
}
