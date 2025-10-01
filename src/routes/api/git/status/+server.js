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

// Parse git status output
function parseGitStatus(output) {
	const lines = output.split('\n').filter((line) => line.trim());
	const status = {
		modified: [],
		staged: [],
		untracked: [],
		ahead: 0,
		behind: 0
	};

	for (const line of lines) {
		const statusCode = line.substring(0, 2);
		const filePath = line.substring(3);

		// Parse file status
		if (statusCode[0] === 'M' || statusCode[0] === 'A' || statusCode[0] === 'D') {
			status.staged.push(filePath);
		}
		if (statusCode[1] === 'M' || statusCode[1] === 'D') {
			status.modified.push(filePath);
		}
		if (statusCode === '??') {
			status.untracked.push(filePath);
		}

		// Parse ahead/behind info
		if (line.includes('ahead')) {
			const match = line.match(/ahead (\d+)/);
			if (match) status.ahead = parseInt(match[1]);
		}
		if (line.includes('behind')) {
			const match = line.match(/behind (\d+)/);
			if (match) status.behind = parseInt(match[1]);
		}
	}

	return status;
}

export async function GET({ url, request, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: \'Authentication required\' }, { status: 401 });
	}

	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Check if it's a git repository
		try {
			await execGit(['rev-parse', '--git-dir'], resolvedPath);
		} catch (error) {
			return json({ error: 'Not a git repository' }, { status: 404 });
		}

		// Get current branch
		const branch = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], resolvedPath);

		// Get status with ahead/behind info
		const statusOutput = await execGit(['status', '--porcelain', '-b'], resolvedPath);
		const status = parseGitStatus(statusOutput);

		return json({
			branch,
			status,
			isGitRepo: true
		});
	} catch (error) {
		console.error('Git status error:', error);
		return json({ error: error.message || 'Failed to get git status' }, { status: 500 });
	}
}
