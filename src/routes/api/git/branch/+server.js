import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';

// Create new branch
export async function POST({ request, locals }) {
	try {
		const { path, name, checkout = false } = await request.json();

		if (!path || !name) {
			return json({ error: 'Path and name are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Create branch
		const args = checkout ? ['checkout', '-b', name] : ['branch', name];
		const result = await execGit(args, resolvedPath);

		return json({ success: true, branch: name, checkout, message: result });
	} catch (error) {
		console.error('Git branch error:', error);
		return json({ error: error.message || 'Failed to create branch' }, { status: 500 });
	}
}
