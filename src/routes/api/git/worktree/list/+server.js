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
		
		const path = pathLine.trim();
		const head = headLine ? headLine.replace('HEAD ', '').trim() : '';
		const branch = branchLine ? branchLine.replace(/^\[(.+)\]$/, '$1').trim() : '';
		
		worktrees.push({
			path,
			head,
			branch: branch === 'detached HEAD' ? null : branch
		});
	}
	
	return worktrees;
}

export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (error) {
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