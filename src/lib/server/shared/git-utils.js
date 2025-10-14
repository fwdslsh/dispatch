/**
 * Git Utility Functions
 * Shared utilities for git operations across API routes
 */

import { spawn } from 'node:child_process';
import { validateAndResolvePath } from './path-validation.js';

/**
 * Execute git command in specified directory with path validation
 * @param {string[]} args - Git command arguments
 * @param {string} cwd - Working directory
 * @param {Object} [options] - Execution options
 * @param {boolean} [options.skipValidation=false] - Skip path validation (use carefully)
 * @returns {Promise<string>} Command output
 */
export function execGit(args, cwd, options = {}) {
	return new Promise((resolve, reject) => {
		// Validate path unless explicitly skipped
		if (!options.skipValidation) {
			const validation = validateAndResolvePath(cwd, {
				mustExist: true,
				allowHome: true
			});

			if (!validation.valid) {
				reject(new Error(`Invalid path: ${validation.error}`));
				return;
			}

			// Use validated path
			cwd = validation.resolvedPath;
		}

		// Sanitize git arguments to prevent command injection
		const sanitizedArgs = args.map((arg) => {
			if (typeof arg !== 'string') {
				throw new Error('Git arguments must be strings');
			}
			// Prevent command injection via semicolons, pipes, etc.
			if (arg.includes(';') || arg.includes('|') || arg.includes('&')) {
				throw new Error('Invalid characters in git argument');
			}
			return arg;
		});

		const git = spawn('git', sanitizedArgs, { cwd });
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
