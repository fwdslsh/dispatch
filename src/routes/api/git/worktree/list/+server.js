import { json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
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

		// Parse each line - git worktree --porcelain uses "worktree <path>" format
		const path = pathLine.startsWith('worktree ') ? pathLine.substring(9).trim() : pathLine.trim();
		const head = headLine && headLine.startsWith('HEAD ') ? headLine.substring(5).trim() : '';
		const branch = branchLine && branchLine.startsWith('branch ') ? 
			branchLine.substring(7).trim().replace(/^refs\/heads\//, '') : '';

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

		const resolvedPath = resolvePath(path);

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
