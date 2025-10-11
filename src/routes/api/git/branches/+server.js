import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';

export async function GET({ url, request, locals }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
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
	} catch (error) {
		console.error('Git branches error:', error);
		return json({ error: error.message || 'Failed to get branches' }, { status: 500 });
	}
}
