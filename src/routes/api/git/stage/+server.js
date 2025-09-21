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
		const { path, files, action } = await request.json();

		if (!path || !files || !Array.isArray(files) || !action) {
			return json({ error: 'Path, files array, and action are required' }, { status: 400 });
		}

		if (!['stage', 'unstage'].includes(action)) {
			return json({ error: 'Action must be "stage" or "unstage"' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Execute git add or git reset for each file
		for (const file of files) {
			if (action === 'stage') {
				await execGit(['add', file], resolvedPath);
			} else {
				await execGit(['reset', 'HEAD', file], resolvedPath);
			}
		}

		return json({ success: true, action, files });
	} catch (error) {
		console.error('Git stage error:', error);
		return json({ error: error.message || `Failed to ${action} files` }, { status: 500 });
	}
}
