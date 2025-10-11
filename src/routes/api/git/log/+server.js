import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';

export async function GET({ url, request, locals }) {
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
