import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// Expand tilde (~) in paths
function expandTilde(filepath) {
	if (filepath.startsWith('~/') || filepath === '~') {
		return filepath.replace(/^~/, homedir());
	}
	return filepath;
}

// Resolve path with proper tilde expansion
function resolvePath(filepath) {
	const expanded = expandTilde(filepath);
	return resolve(expanded);
}

// Parse git worktree list output
function parseWorktreeList(output) {
	if (!output.trim()) return [];

	const lines = output.split('\n').filter((line) => line.trim());
	const worktrees = [];

	for (let i = 0; i < lines.length; i += 3) {
		const pathLine = lines[i];
		const headLine = lines[i + 1];
		const branchLine = lines[i + 2];

		if (!pathLine) continue;

		// Parse each line - git worktree --porcelain uses "worktree <path>" format
		const path = pathLine.startsWith('worktree ') ? pathLine.substring(9).trim() : pathLine.trim();
		const head = headLine && headLine.startsWith('HEAD ') ? headLine.substring(5).trim() : '';
		const branch =
			branchLine && branchLine.startsWith('branch ')
				? branchLine
						.substring(7)
						.trim()
						.replace(/^refs\/heads\//, '')
				: '';

		worktrees.push({
			path,
			head,
			branch: branch === 'detached HEAD' ? null : branch
		});
	}

	return worktrees;
}

export async function GET({ url, request: _request, locals: _locals }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolvePath(path);

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (_error) {
			return json({ error: 'Not a git repository' }, { status: 404 });
		}

		// List worktrees
		const worktreeOutput = await execGit(['worktree', 'list', '--porcelain'], resolvedPath);
		const worktrees = parseWorktreeList(worktreeOutput);

		return json({ worktrees });
	} catch (error) {
		console.error('Git worktree list error:', error);
		return json({ error: error.message || 'Failed to list worktrees' }, { status: 500 });
	}
}
