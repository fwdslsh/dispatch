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
		const limit = url.searchParams.get('limit') || '20';
		const format = url.searchParams.get('format') || 'oneline';

		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Get git log
		const args = ['log', `--max-count=${limit}`];
		if (format === 'oneline') {
			args.push('--oneline');
		} else if (format === 'pretty') {
			args.push('--pretty=format:%H|%an|%ad|%s', '--date=iso');
		}

		const logOutput = await execGit(args, resolvedPath);

		let commits;
		if (format === 'oneline') {
			commits = logOutput.split('\n').map((line) => {
				const [hash, ...messageParts] = line.split(' ');
				return {
					hash: hash,
					message: messageParts.join(' ')
				};
			});
		} else if (format === 'pretty') {
			commits = logOutput.split('\n').map((line) => {
				const [hash, author, date, message] = line.split('|');
				return {
					hash,
					author,
					date,
					message
				};
			});
		} else {
			commits = logOutput.split('\n');
		}

		return json({ commits });
	} catch (error) {
		console.error('Git log error:', error);
		return json({ error: error.message || 'Failed to get git log' }, { status: 500 });
	}
}
