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

// Create new branch
export async function POST({ request }) {
	try {
		const { path, name, checkout = false } = await request.json();

		if (!path || !name) {
			return json({ error: 'Path and name are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Create branch
		const args = checkout ? ['checkout', '-b', name] : ['branch', name];
		const result = await execGit(args, resolvedPath);

		return json({ success: true, branch: name, checkout, message: result });
	} catch (error) {
		console.error('Git branch error:', error);
		return json({ error: error.message || 'Failed to create branch' }, { status: 500 });
	}
}
