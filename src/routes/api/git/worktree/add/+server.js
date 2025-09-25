import { json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

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

// Execute shell command in specified directory
function execShell(command, cwd) {
	return new Promise((resolve, reject) => {
		const shell = spawn('sh', ['-c', command], { cwd, encoding: 'utf8' });
		let stdout = '';
		let stderr = '';

		shell.stdout.on('data', (data) => {
			stdout += data;
		});

		shell.stderr.on('data', (data) => {
			stderr += data;
		});

		shell.on('close', (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(stderr.trim() || `Command failed with code ${code}`));
			}
		});

		shell.on('error', (error) => {
			reject(error);
		});
	});
}

export async function POST({ request }) {
	try {
		const { path, worktreePath, branch, newBranch, runInit = false, initCommands = [] } = await request.json();

		if (!path || !worktreePath) {
			return json({ error: 'Path and worktreePath are required' }, { status: 400 });
		}

		if (!branch && !newBranch) {
			return json({ error: 'Either branch or newBranch is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);
		const resolvedWorktreePath = resolve(worktreePath);

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (error) {
			return json({ error: 'Not a git repository' }, { status: 404 });
		}

		// Check if worktree path already exists
		if (existsSync(resolvedWorktreePath)) {
			return json({ error: 'Worktree path already exists' }, { status: 400 });
		}

		// Build git worktree add command
		const args = ['worktree', 'add'];
		
		if (newBranch) {
			args.push('-b', newBranch);
		}
		
		args.push(resolvedWorktreePath);
		
		if (branch && !newBranch) {
			args.push(branch);
		}

		// Create worktree
		const result = await execGit(args, resolvedPath);

		// Run initialization commands if requested
		let initResults = [];
		if (runInit && initCommands.length > 0) {
			for (const command of initCommands) {
				try {
					const initResult = await execShell(command, resolvedWorktreePath);
					initResults.push({ command, success: true, output: initResult });
				} catch (error) {
					initResults.push({ command, success: false, error: error.message });
				}
			}
		}

		return json({ 
			success: true, 
			worktreePath: resolvedWorktreePath,
			branch: newBranch || branch,
			message: result,
			initResults
		});
	} catch (error) {
		console.error('Git worktree add error:', error);
		return json({ error: error.message || 'Failed to add worktree' }, { status: 500 });
	}
}