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
		const file = url.searchParams.get('file');
		const staged = url.searchParams.get('staged') === 'true';

		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Build git diff command
		const args = ['diff'];
		if (staged) {
			args.push('--staged');
		}
		if (file) {
			args.push('--', file);
		}

		const diffOutput = await execGit(args, resolvedPath);

		return json({ diff: diffOutput, file, staged });
	} catch (error) {
		console.error('Git diff error:', error);
		return json({ error: error.message || 'Failed to get git diff' }, { status: 500 });
	}
}
