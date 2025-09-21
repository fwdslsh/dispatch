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

export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Get all branches (local and remote)
		const branchOutput = await execGit(['branch', '-a'], resolvedPath);
		const branches = branchOutput
			.split('\n')
			.map((line) =>
				line
					.trim()
					.replace(/^\*\s+/, '')
					.replace(/^remotes\/origin\//, '')
			)
			.filter((branch) => branch && !branch.includes('HEAD'))
			.filter((branch, index, arr) => arr.indexOf(branch) === index); // Remove duplicates

		return json({ branches });
	} catch (error) {
		console.error('Git branches error:', error);
		return json({ error: error.message || 'Failed to get branches' }, { status: 500 });
	}
}
