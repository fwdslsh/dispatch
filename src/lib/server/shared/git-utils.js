/**
 * Git Utility Functions
 * Shared utilities for git operations across API routes
 */

import { spawn } from 'node:child_process';

/**
 * Execute git command in specified directory
 * @param {string[]} args - Git command arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<string>} Command output
 */
export function execGit(args, cwd) {
	return new Promise((resolve, reject) => {
		const git = spawn('git', args, { cwd, encoding: 'utf8' });
		let stdout = '';
		let stderr = '';

		// Handle stdout - check for null
		if (git.stdout) {
			git.stdout.on('data', (data) => {
				stdout += data;
			});
		}

		// Handle stderr - check for null
		if (git.stderr) {
			git.stderr.on('data', (data) => {
				stderr += data;
			});
		}

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
