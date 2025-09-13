/**
 * Path validation utilities
 * 
 * This module provides both restrictive path validation (for workspace boundaries)
 * and basic sanitization (for general path cleaning without restrictions).
 * 
 * Use basic sanitization when sessions should be able to access any directory
 * the server process can read. Use restrictive validation only when workspace
 * boundaries need to be enforced for specific features.
 */
import { resolve, relative, isAbsolute, join } from 'node:path';
import { stat } from 'node:fs/promises';
import { logger } from './logger.js';

/**
 * Validate that a path is within the specified root directory
 * @param {string} targetPath - Path to validate
 * @param {string} rootPath - Root directory that target must be within
 * @returns {boolean} True if path is safe and within root
 */
export function isPathWithinRoot(targetPath, rootPath) {
	if (!targetPath || !rootPath) return false;
	
	try {
		const resolvedTarget = resolve(targetPath);
		const resolvedRoot = resolve(rootPath);
		const relativePath = relative(resolvedRoot, resolvedTarget);
		
		// Path is safe if it doesn't start with '..' and isn't absolute after relativization
		return !relativePath.startsWith('..') && !isAbsolute(relativePath);
	} catch (error) {
		logger.warn('PathValidation', 'Error validating path:', error.message);
		return false;
	}
}

/**
 * Assert that a workspace path is within the workspace root
 * Throws an error if validation fails
 * @param {string} workspacePath - Path to validate
 * @param {string} [workspaceRoot] - Workspace root (defaults to WORKSPACES_ROOT)
 * @throws {Error} If path is outside workspace root
 */
export function assertInWorkspacesRoot(workspacePath, workspaceRoot = null) {
	const root = workspaceRoot || process.env.WORKSPACES_ROOT || process.cwd();
	
	if (!isPathWithinRoot(workspacePath, root)) {
		const error = new Error(`Path traversal denied: ${workspacePath} is outside workspace root ${root}`);
		logger.error('PathValidation', error.message);
		throw error;
	}
	
	logger.debug('PathValidation', `Path validated: ${workspacePath} is within ${root}`);
}

/**
 * Safely resolve a path within a root directory
 * @param {string} requestedPath - Path requested by user/client
 * @param {string} rootPath - Root directory to resolve within
 * @returns {string} Safely resolved absolute path
 * @throws {Error} If resulting path would be outside root
 */
export function safeResolve(requestedPath, rootPath) {
	if (!requestedPath || typeof requestedPath !== 'string') {
		throw new Error('Invalid path: must be a non-empty string');
	}
	
	// Normalize the requested path
	const cleanPath = requestedPath.trim();
	if (!cleanPath) {
		throw new Error('Invalid path: cannot be empty or whitespace');
	}
	
	// Resolve the path
	const resolvedPath = isAbsolute(cleanPath) 
		? resolve(cleanPath)
		: resolve(rootPath, cleanPath);
	
	// Validate it's within the root
	if (!isPathWithinRoot(resolvedPath, rootPath)) {
		throw new Error(`Path traversal denied: requested path would escape root directory`);
	}
	
	return resolvedPath;
}

/**
 * Sanitize a path by removing potentially dangerous characters
 * This provides basic sanitization without restricting directory access
 * @param {string} path - Path to sanitize
 * @returns {string} Sanitized path
 */
export function sanitizePath(path) {
	if (!path || typeof path !== 'string') {
		return '';
	}
	
	// Remove null bytes and other control characters that could cause issues
	let sanitized = path.replace(/[\x00-\x1f\x7f]/g, '');
	
	// Remove Windows reserved characters that could cause filesystem issues
	sanitized = sanitized.replace(/[<>:"|?*]/g, '');
	
	// Remove leading/trailing whitespace but preserve relative path indicators like '../'
	sanitized = sanitized.trim();
	
	return sanitized;
}

/**
 * Enhanced sanitization that also removes path traversal indicators
 * Use this when you want to prevent directory traversal while still sanitizing
 * @param {string} path - Path to sanitize
 * @returns {string} Sanitized path with traversal prevention
 */
export function sanitizePathStrict(path) {
	if (!path || typeof path !== 'string') {
		return '';
	}
	
	// Start with basic sanitization
	let sanitized = sanitizePath(path);
	
	// Remove leading/trailing dots that could indicate current/parent directory
	sanitized = sanitized.replace(/^\.+|\.+$/g, '');
	
	return sanitized;
}

/**
 * Validate that a directory exists and is accessible
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<boolean>} True if directory exists and is accessible
 */
export async function isValidDirectory(dirPath) {
	try {
		const stats = await stat(dirPath);
		return stats.isDirectory();
	} catch (error) {
		logger.debug('PathValidation', `Directory validation failed for ${dirPath}:`, error.message);
		return false;
	}
}

/**
 * Create a safe path within a workspace root
 * Combines sanitization, validation, and safe resolution
 * @param {string} requestedPath - User-requested path
 * @param {string} workspaceRoot - Workspace root directory
 * @returns {string} Safe, validated absolute path
 * @throws {Error} If path cannot be safely created
 */
export function createSafeWorkspacePath(requestedPath, workspaceRoot) {
	// First sanitize the requested path
	const sanitized = sanitizePath(requestedPath);
	if (!sanitized) {
		throw new Error('Invalid path after sanitization');
	}
	
	// Then safely resolve it
	const safePath = safeResolve(sanitized, workspaceRoot);
	
	// Validate it's within workspace root
	assertInWorkspacesRoot(safePath, workspaceRoot);
	
	return safePath;
}