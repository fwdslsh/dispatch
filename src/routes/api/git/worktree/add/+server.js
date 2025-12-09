import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { validateAndResolvePath } from '$lib/server/shared/path-validation.js';
import { existsSync } from 'node:fs';
import {
	BadRequestError,
	NotFoundError,
	ConflictError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

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
			throw new BadRequestError('Path and worktreePath are required', 'MISSING_PARAMS');
		}

		if (!branch && !newBranch) {
			throw new BadRequestError('Either branch or newBranch is required', 'MISSING_BRANCH');
		}

		// Validate and resolve repository path
		const repoValidation = validateAndResolvePath(path, {
			mustExist: true,
			allowHome: true
		});

		if (!repoValidation.valid) {
			throw new BadRequestError(`Invalid repository path: ${repoValidation.error}`, 'INVALID_PATH');
		}

		const resolvedPath = repoValidation.resolvedPath;

		// Validate and resolve worktree path
		const worktreeValidation = validateAndResolvePath(worktreePath, {
			mustExist: false,
			allowHome: true
		});

		if (!worktreeValidation.valid) {
			throw new BadRequestError(
				`Invalid worktree path: ${worktreeValidation.error}`,
				'INVALID_WORKTREE_PATH'
			);
		}

		const resolvedWorktreePath = worktreeValidation.resolvedPath;

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (_error) {
			throw new NotFoundError('Not a git repository');
		}

		// Check if worktree path already exists
		if (existsSync(resolvedWorktreePath)) {
			throw new ConflictError('Worktree path already exists');
		}

		// Build git worktree add command
		const args = ['worktree', 'add'];

		if (newBranch) {
			// Validate branch name to prevent injection
			if (!newBranch.match(/^[a-zA-Z0-9_\-/.]+$/)) {
				throw new BadRequestError('Invalid branch name format', 'INVALID_BRANCH_NAME');
			}
			args.push('-b', newBranch);
		}

		args.push(resolvedWorktreePath);

		if (branch && !newBranch) {
			// Validate branch name to prevent injection
			if (!branch.match(/^[a-zA-Z0-9_\-/.]+$/)) {
				throw new BadRequestError('Invalid branch name format', 'INVALID_BRANCH_NAME');
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
	} catch (err) {
		handleApiError(err, 'POST /api/git/worktree/add');
	}
}
