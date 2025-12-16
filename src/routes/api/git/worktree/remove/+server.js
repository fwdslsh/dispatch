import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import {
	BadRequestError,
	NotFoundError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

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

export async function POST({ request, locals: _locals }) {
	try {
		const { path, worktreePath, force = false } = await request.json();

		if (!path || !worktreePath) {
			throw new BadRequestError('Path and worktreePath are required', 'MISSING_PARAMS');
		}

		const resolvedPath = resolvePath(path);
		const resolvedWorktreePath = resolvePath(worktreePath);

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (_error) {
			throw new NotFoundError('Not a git repository');
		}

		// Remove worktree
		const args = ['worktree', 'remove'];
		if (force) {
			args.push('--force');
		}
		args.push(resolvedWorktreePath);

		const result = await execGit(args, resolvedPath);

		return json({
			success: true,
			worktreePath: resolvedWorktreePath,
			message: result
		});
	} catch (err) {
		handleApiError(err, 'POST /api/git/worktree/remove');
	}
}
