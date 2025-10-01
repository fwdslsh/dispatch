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
		const { path, message } = await request.json();

		if (!path || !message) {
			return json({ error: 'Path and message are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Create commit
		const result = await execGit(['commit', '-m', message], resolvedPath);

		return json({ success: true, message: result });
	} catch (error) {
		console.error('Git commit error:', error);
		return json({ error: error.message || 'Failed to commit changes' }, { status: 500 });
	}
}
