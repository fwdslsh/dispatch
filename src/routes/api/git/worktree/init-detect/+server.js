import { json } from '@sveltejs/kit';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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
function findExistingInitScript(projectPath) {
	const possiblePaths = [
		join(projectPath, 'init.sh'),
		join(projectPath, 'scripts', 'init.sh'),
		join(projectPath, 'setup.sh'),
		join(projectPath, 'scripts', 'setup.sh')
	];

	for (const scriptPath of possiblePaths) {
		if (existsSync(scriptPath)) {
			try {
				const content = readFileSync(scriptPath, 'utf8');
				return {
					path: scriptPath,
					content: content.trim(),
					commands: content
						.split('\n')
						.map((line) => line.trim())
						.filter((line) => line && !line.startsWith('#'))
				};
			} catch (error) {
				console.warn(`Failed to read init script ${scriptPath}:`, error.message);
			}
		}
	}

	return null;
}

export async function GET({ url }) {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			return json({ error: 'Path parameter is required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Check if directory exists
		if (!existsSync(resolvedPath)) {
			return json({ error: 'Directory does not exist' }, { status: 404 });
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
			hasInitScript: !!existingScript
		});
	} catch (error) {
		console.error('Init detection error:', error);
		return json({ error: error.message || 'Failed to detect initialization' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const { path, commands, saveAs = 'init.sh' } = await request.json();

		if (!path || !commands || !Array.isArray(commands)) {
			return json({ error: 'Path and commands array are required' }, { status: 400 });
		}

		const resolvedPath = resolve(path);

		// Check if directory exists
		if (!existsSync(resolvedPath)) {
			return json({ error: 'Directory does not exist' }, { status: 404 });
		}

		// Determine save path
		let savePath;
		if (saveAs === 'scripts/init.sh') {
			const scriptsDir = join(resolvedPath, 'scripts');
			if (!existsSync(scriptsDir)) {
				// We'd need to create the scripts directory, but let's keep changes minimal
				// for now and default to root init.sh
				savePath = join(resolvedPath, 'init.sh');
			} else {
				savePath = join(scriptsDir, 'init.sh');
			}
		} else {
			savePath = join(resolvedPath, saveAs);
		}

		// Create script content
		const scriptContent = [
			'#!/bin/bash',
			'# Auto-generated initialization script',
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
	} catch (error) {
		console.error('Save init script error:', error);
		return json(
			{ error: error.message || 'Failed to save initialization script' },
			{ status: 500 }
		);
	}
}
