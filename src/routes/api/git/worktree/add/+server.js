import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { validateAndResolvePath } from '$lib/server/shared/path-validation.js';
import { existsSync } from 'node:fs';

/**
 * Add a new git worktree
 *
 * SECURITY NOTE: .dispatchrc execution has been removed for security reasons
 * (command injection risk). Users should manually run initialization commands.
 *
 * @route POST /api/git/worktree/add
 */
export async function POST({ request, locals: _locals }) {
	try {
		const { path, worktreePath, branch, newBranch } = await request.json();

		// Validate required parameters
		if (!path || !worktreePath) {
			return json({ error: 'Path and worktreePath are required' }, { status: 400 });
		}

		if (!branch && !newBranch) {
			return json({ error: 'Either branch or newBranch is required' }, { status: 400 });
		}

		// Validate and resolve repository path
		const repoValidation = validateAndResolvePath(path, {
			mustExist: true,
			allowHome: true
		});

		if (!repoValidation.valid) {
			return json({ error: `Invalid repository path: ${repoValidation.error}` }, { status: 400 });
		}

		const resolvedPath = repoValidation.resolvedPath;

		// Validate and resolve worktree path
		const worktreeValidation = validateAndResolvePath(worktreePath, {
			mustExist: false,
			allowHome: true
		});

		if (!worktreeValidation.valid) {
			return json({ error: `Invalid worktree path: ${worktreeValidation.error}` }, { status: 400 });
		}

		const resolvedWorktreePath = worktreeValidation.resolvedPath;

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (_error) {
			return json({ error: 'Not a git repository' }, { status: 404 });
		}

		// Check if worktree path already exists
		if (existsSync(resolvedWorktreePath)) {
			return json({ error: 'Worktree path already exists' }, { status: 400 });
		}

		// Build git worktree add command
		const args = ['worktree', 'add'];

		if (newBranch) {
			// Validate branch name to prevent injection
			if (!newBranch.match(/^[a-zA-Z0-9_\-/.]+$/)) {
				return json({ error: 'Invalid branch name format' }, { status: 400 });
			}
			args.push('-b', newBranch);
		}

		args.push(resolvedWorktreePath);

		if (branch && !newBranch) {
			// Validate branch name to prevent injection
			if (!branch.match(/^[a-zA-Z0-9_\-/.]+$/)) {
				return json({ error: 'Invalid branch name format' }, { status: 400 });
			}
			args.push(branch);
		}

		// Create worktree
		const result = await execGit(args, resolvedPath);

		return json({
			success: true,
			worktreePath: resolvedWorktreePath,
			branch: newBranch || branch,
			message: result,
			securityNotice:
				'Automatic command execution disabled. Please run initialization commands manually.'
		});
	} catch (error) {
		console.error('Git worktree add error:', error);
		return json({ error: error.message || 'Failed to add worktree' }, { status: 500 });
	}
}
