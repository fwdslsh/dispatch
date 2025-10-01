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

export async function POST({ request, locals }) {
	try {
		const { path, remote = 'origin', branch } = await request.json();

		if (!path) {
			return json({ error: 'Path is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Get current branch if not specified
		const currentBranch =
			branch || (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], resolvedPath));

		// Pull changes
		const result = await execGit(['pull', remote, currentBranch], resolvedPath);

		return json({ success: true, remote, branch: currentBranch, message: result });
	} catch (error) {
		console.error('Git pull error:', error);
		return json({ error: error.message || 'Failed to pull changes' }, { status: 500 });
	}
}
