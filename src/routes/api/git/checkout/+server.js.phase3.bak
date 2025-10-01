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
	// Require authentication
	const authKey = locals.services.auth.getAuthKeyFromRequest(request);
	if (!locals.services.auth.validateKey(authKey)) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { path, branch } = await request.json();

		if (!path || !branch) {
			return json({ error: 'Path and branch are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Checkout branch
		const result = await execGit(['checkout', branch], resolvedPath);

		return json({ success: true, branch, message: result });
	} catch (error) {
		console.error('Git checkout error:', error);
		return json({ error: error.message || 'Failed to checkout branch' }, { status: 500 });
	}
}
