import { json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Execute git command in specified directory
function execGit(args, cwd) {
	return new Promise((resolve, reject) => {
		const git = spawn('git', args, { cwd, encoding: 'utf8' });
		let stdout = '';
		let stderr = '';

		git.stdout.on('data', (data) => {
			stdout += data;
		});

		git.stderr.on('data', (data) => {
			stderr += data;
		});

		git.on('close', (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(stderr.trim() || `Git command failed with code ${code}`));
			}
		});

		git.on('error', (error) => {
			reject(error);
		});
	});
}

export async function POST({ request }) {
	try {
		const { path, worktreePath, force = false } = await request.json();

		if (!path || !worktreePath) {
			return json({ error: 'Path and worktreePath are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);
		const resolvedWorktreePath = resolve(worktreePath);

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (error) {
			return json({ error: 'Not a git repository' }, { status: 404 });
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
	} catch (error) {
		console.error('Git worktree remove error:', error);
		return json({ error: error.message || 'Failed to remove worktree' }, { status: 500 });
	}
}
