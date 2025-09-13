/**
 * Environment and execution options utilities
 * Provides standardized environment and options building for Claude and other processes
 */
import { resolve } from 'node:path';
import { homedir } from 'node:os';

/**
 * Build execution environment for spawned processes
 * @param {Object} options - Environment options
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.extraEnv] - Additional environment variables
 * @param {boolean} [options.preserveHome] - Whether to preserve HOME variable
 * @returns {Object} Environment object
 */
export function buildExecEnv({ cwd, extraEnv = {}, preserveHome = true } = {}) {
	const baseEnv = { ...process.env };

	// Ensure HOME is set if preserveHome is true
	if (preserveHome && !baseEnv.HOME) {
		baseEnv.HOME = homedir();
	}

	// Add working directory to PATH if provided
	if (cwd) {
		const currentPath = baseEnv.PATH || '';
		const cwdBin = resolve(cwd, 'node_modules', '.bin');
		baseEnv.PATH = currentPath ? `${cwdBin}:${currentPath}` : cwdBin;
	}

	// Merge additional environment variables
	return {
		...baseEnv,
		...extraEnv
	};
}

/**
 * Build Claude Code execution options
 * @param {Object} options - Claude options
 * @param {string} options.cwd - Working directory (required)
 * @param {string} [options.pathToClaude] - Path to Claude executable
 * @param {number} [options.maxTurns] - Maximum conversation turns
 * @param {string} [options.outputStyle] - Output style preference
 * @param {string} [options.customSystemPrompt] - Custom system prompt
 * @param {Array} [options.allowedTools] - Allowed tools array
 * @param {string} [options.permissionMode] - Permission mode
 * @param {Object} [options.extraEnv] - Additional environment variables
 * @returns {Object} Claude options object
 */
export function buildClaudeOptions(options) {
	if (!options || !options.cwd) {
		throw new Error('cwd is required for Claude options');
	}

	const {
		cwd,
		pathToClaude,
		maxTurns = 50,
		outputStyle = 'semantic-html',
		customSystemPrompt = 'You are a helpful coding assistant integrated into a web terminal interface.',
		allowedTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'Task'],
		permissionMode = 'bypassPermissions',
		extraEnv = {}
	} = options;

	// Default path to Claude executable if not provided
	const defaultClaudePath = resolve(process.cwd(), './node_modules/.bin/claude');
	const claudePath = pathToClaude || defaultClaudePath;

	return {
		cwd,
		maxTurns,
		outputStyle,
		customSystemPrompt,
		allowedTools,
		permissionMode,
		pathToClaudeCodeExecutable: claudePath,
		env: buildExecEnv({ cwd, extraEnv, preserveHome: true })
	};
}

/**
 * Build terminal execution options
 * @param {Object} options - Terminal options
 * @param {string} options.cwd - Working directory (required)
 * @param {string} [options.shell] - Shell executable path
 * @param {Array} [options.args] - Shell arguments
 * @param {Object} [options.extraEnv] - Additional environment variables
 * @returns {Object} Terminal options object
 */
export function buildTerminalOptions(options) {
	if (!options || !options.cwd) {
		throw new Error('cwd is required for terminal options');
	}

	const { cwd, shell = process.env.SHELL || '/bin/bash', args = [], extraEnv = {} } = options;

	return {
		cwd,
		shell,
		args,
		env: buildExecEnv({ cwd, extraEnv, preserveHome: true })
	};
}

/**
 * Normalize and validate working directory path
 * @param {string} workspacePath - Workspace path to normalize
 * @param {string} [defaultPath] - Default path if workspace path is invalid
 * @returns {string} Normalized absolute path
 */
export function normalizeWorkspacePath(workspacePath, defaultPath = process.cwd()) {
	if (!workspacePath || typeof workspacePath !== 'string') {
		return resolve(defaultPath);
	}

	try {
		return resolve(workspacePath);
	} catch (error) {
		console.warn(`Invalid workspace path "${workspacePath}", using default: ${defaultPath}`);
		return resolve(defaultPath);
	}
}
