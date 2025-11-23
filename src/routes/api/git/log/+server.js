import { json } from '@sveltejs/kit';
import { execGit } from '$lib/server/shared/git-utils.js';
import { resolve } from 'node:path';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url, request: _request, locals: _locals }) {
	try {
		const path = url.searchParams.get('path');
		const limit = url.searchParams.get('limit') || '20';
		const format = url.searchParams.get('format') || 'oneline';

		if (!path) {
			throw new BadRequestError('Path parameter is required', 'MISSING_PATH');
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
	} catch (err) {
		handleApiError(err, 'GET /api/git/log');
	}
}
