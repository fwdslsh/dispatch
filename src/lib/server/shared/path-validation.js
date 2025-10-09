import { resolve, normalize, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

/**
 * Validate and resolve a file path, preventing path traversal attacks
 *
 * @param {string} path - The path to validate
 * @param {Object} [options] - Validation options
 * @param {string} [options.baseDir] - Base directory to restrict access to
 * @param {boolean} [options.mustExist=false] - Whether the path must exist
 * @param {boolean} [options.allowHome=true] - Whether to allow ~ expansion
 * @returns {{valid: boolean, resolvedPath?: string, error?: string}}
 */
export function validateAndResolvePath(path, options = {}) {
	const { baseDir = null, mustExist = false, allowHome = true } = options;

	// Check for null/undefined
	if (!path || typeof path !== 'string') {
		return { valid: false, error: 'Path is required and must be a string' };
	}

	// Expand tilde if allowed
	let expandedPath = path;
	if (allowHome && (path.startsWith('~/') || path === '~')) {
		expandedPath = path.replace(/^~/, homedir());
	}

	// Normalize and resolve the path
	const normalizedPath = normalize(expandedPath);
	const resolvedPath = isAbsolute(normalizedPath)
		? normalizedPath
		: resolve(process.cwd(), normalizedPath);

	// Check for path traversal attempts
	if (normalizedPath.includes('..')) {
		return { valid: false, error: 'Path traversal detected' };
	}

	// If baseDir is specified, ensure the path is within it
	if (baseDir) {
		const resolvedBaseDir = resolve(baseDir);
		if (!resolvedPath.startsWith(resolvedBaseDir)) {
			return {
				valid: false,
				error: `Path must be within ${resolvedBaseDir}`
			};
		}
	}

	// Check existence if required
	if (mustExist && !existsSync(resolvedPath)) {
		return { valid: false, error: 'Path does not exist' };
	}

	return { valid: true, resolvedPath };
}

/**
 * Validate multiple paths
 * @param {string[]} paths - Paths to validate
 * @param {Object} [options] - Validation options (same as validateAndResolvePath)
 * @returns {{valid: boolean, resolvedPaths?: string[], error?: string, invalidPath?: string}}
 */
export function validateAndResolvePaths(paths, options = {}) {
	if (!Array.isArray(paths)) {
		return { valid: false, error: 'Paths must be an array' };
	}

	const resolvedPaths = [];
	for (const path of paths) {
		const result = validateAndResolvePath(path, options);
		if (!result.valid) {
			return {
				valid: false,
				error: result.error,
				invalidPath: path
			};
		}
		resolvedPaths.push(result.resolvedPath);
	}

	return { valid: true, resolvedPaths };
}
