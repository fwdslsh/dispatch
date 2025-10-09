import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';


export async function GET({ url, request, locals }) {
	try {
		const path = url.searchParams.get('path');
		const file = url.searchParams.get('file');
		const staged = url.searchParams.get('staged') === 'true';

		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
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
	} catch (error) {
		console.error('Git diff error:', error);
		return json({ error: error.message || 'Failed to get git diff' }, { status: 500 });
	}
}
