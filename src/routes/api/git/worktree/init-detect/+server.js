import { json } from '@sveltejs/kit';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import {
	BadRequestError,
	NotFoundError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

// Expand tilde (~) in paths
function expandTilde(filepath) {
	if (filepath.startsWith('~/') || filepath === '~') {
		return filepath.replace(/^~/, homedir());
	}
	return filepath;
}

// Resolve path with proper tilde expansion
function resolvePath(filepath) {
	const expanded = expandTilde(filepath);
	return resolve(expanded);
}

// Common initialization patterns based on project files
const INIT_PATTERNS = [
	{
		files: ['package.json'],
		commands: ['npm install'],
		description: 'Node.js project detected'
	},
	{
		files: ['yarn.lock'],
		commands: ['yarn install'],
		description: 'Yarn project detected'
	},
	{
		files: ['pnpm-lock.yaml'],
		commands: ['pnpm install'],
		description: 'PNPM project detected'
	},
	{
		files: ['requirements.txt'],
		commands: ['pip install -r requirements.txt'],
		description: 'Python requirements.txt detected'
	},
	{
		files: ['Pipfile'],
		commands: ['pipenv install'],
		description: 'Python Pipenv project detected'
	},
	{
		files: ['pyproject.toml'],
		commands: ['pip install -e .'],
		description: 'Python pyproject.toml detected'
	},
	{
		files: ['Gemfile'],
		commands: ['bundle install'],
		description: 'Ruby Gemfile detected'
	},
	{
		files: ['Cargo.toml'],
		commands: ['cargo build'],
		description: 'Rust Cargo project detected'
	},
	{
		files: ['go.mod'],
		commands: ['go mod download'],
		description: 'Go module detected'
	},
	{
		files: ['Makefile'],
		commands: ['make install'],
		description: 'Makefile detected'
	},
	{
		files: ['composer.json'],
		commands: ['composer install'],
		description: 'PHP Composer project detected'
	}
];

// Detect initialization commands based on project files
function detectInitCommands(projectPath) {
	const detected = [];

	for (const pattern of INIT_PATTERNS) {
		const hasFiles = pattern.files.some((file) => existsSync(join(projectPath, file)));
		if (hasFiles) {
			detected.push({
				...pattern,
				matched: pattern.files.filter((file) => existsSync(join(projectPath, file)))
			});
		}
	}

	return detected;
}

// Check for existing initialization scripts
// NOTE: .dispatchrc is now read-only for display purposes
// Execution has been removed for security (command injection risk)
function findExistingInitScript(projectPath) {
	const dispatchrcPath = join(projectPath, '.dispatchrc');

	if (existsSync(dispatchrcPath)) {
		try {
			const content = readFileSync(dispatchrcPath, 'utf8');
			return {
				path: dispatchrcPath,
				content: content.trim(),
				commands: content
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith('#')),
				warning: 'Script file detected but will not be executed automatically for security reasons'
			};
		} catch (error) {
			console.warn(`Failed to read .dispatchrc ${dispatchrcPath}:`, error.message);
		}
	}

	return null;
}

export async function GET({ url, request: _request, locals: _locals }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			throw new BadRequestError('Path parameter is required', 'MISSING_PATH');
		}

		const resolvedPath = resolvePath(path);

		// Check if directory exists
		if (!existsSync(resolvedPath)) {
			throw new NotFoundError('Directory does not exist');
		}

		// Detect initialization patterns
		const detectedPatterns = detectInitCommands(resolvedPath);

		// Check for existing initialization scripts
		const existingScript = findExistingInitScript(resolvedPath);

		// Combine all detected commands
		const allCommands = [];

		if (existingScript) {
			allCommands.push(...existingScript.commands);
		} else {
			// Add detected commands from patterns
			for (const pattern of detectedPatterns) {
				allCommands.push(...pattern.commands);
			}
		}

		return json({
			detected: detectedPatterns,
			existingScript,
			suggestedCommands: [...new Set(allCommands)], // Remove duplicates
			hasDispatchrc: !!existingScript
		});
	} catch (err) {
		handleApiError(err, 'GET /api/git/worktree/init-detect');
	}
}

export async function POST({ request, locals: _locals }) {
	try {
		const { path, commands } = await request.json();

		if (!path || !commands || !Array.isArray(commands)) {
			throw new BadRequestError('Path and commands array are required', 'MISSING_PARAMS');
		}

		const resolvedPath = resolvePath(path);

		// Check if directory exists
		if (!existsSync(resolvedPath)) {
			throw new NotFoundError('Directory does not exist');
		}

		// Save as .dispatchrc in the root
		const savePath = join(resolvedPath, '.dispatchrc');

		// Create script content
		const scriptContent = [
			'#!/bin/bash',
			'# Auto-generated initialization script for git worktrees',
			'set -e',
			'',
			...commands,
			''
		].join('\n');

		// Save script
		writeFileSync(savePath, scriptContent, 'utf8');

		return json({
			success: true,
			scriptPath: savePath,
			commands,
			message: `Initialization script saved to ${savePath}`
		});
	} catch (err) {
		handleApiError(err, 'POST /api/git/worktree/init-detect');
	}
}
