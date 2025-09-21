/**
 * File scanning utilities to reduce repetitive directory operations
 *
 * Provides standardized patterns for common file system operations
 * following SOLID principles while maintaining simplicity.
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from './logger.js';

/**
 * Scan directories looking for files matching a pattern
 * @param {string} baseDir - Base directory to scan
 * @param {function} matcher - Function to test if file matches criteria
 * @param {object} options - Configuration options
 * @returns {Promise<Array>} Array of matching files with metadata
 */
export async function scanForFiles(baseDir, matcher, options = {}) {
	const { recursive = false, includeStats = true, component = 'FILE_SCANNER' } = options;
	const results = [];

	try {
		const entries = await readdir(baseDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(baseDir, entry.name);

			if (entry.isDirectory() && recursive) {
				// Recursively scan subdirectories
				const subResults = await scanForFiles(fullPath, matcher, options);
				results.push(...subResults);
				continue;
			}

			if (entry.isFile()) {
				const fileInfo = { name: entry.name, path: fullPath, entry };

				// Add file stats if requested
				if (includeStats) {
					try {
						fileInfo.stats = await stat(fullPath);
						fileInfo.mtimeMs = fileInfo.stats.mtimeMs;
					} catch (error) {
						// Skip files that can't be stat'd
						continue;
					}
				}

				// Test if file matches criteria
				if (matcher(fileInfo)) {
					results.push(fileInfo);
				}
			}
		}

		return results;
	} catch (error) {
		logger.warn(component, `Failed to scan directory ${baseDir}:`, error.message);
		return [];
	}
}

/**
 * Find a specific file across multiple directories
 * @param {Array<string>} directories - Directories to search
 * @param {string} filename - Filename to find
 * @param {object} options - Configuration options
 * @returns {Promise<object|null>} File info if found, null otherwise
 */
export async function findFileInDirectories(directories, filename, options = {}) {
	const { component = 'FILE_FINDER' } = options;

	for (const dir of directories) {
		try {
			const entries = await readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) continue;

				const fullPath = join(dir, entry.name);
				if (entry.name === filename) {
					try {
						const stats = await stat(fullPath);
						return {
							name: entry.name,
							path: fullPath,
							directory: dir,
							stats,
							mtimeMs: stats.mtimeMs
						};
					} catch (error) {
						// File exists in readdir but can't be stat'd, skip
						continue;
					}
				}
			}
		} catch (error) {
			logger.debug(component, `Could not scan directory ${dir}:`, error.message);
			// Continue to next directory
		}
	}

	return null;
}

/**
 * Get files in a directory with a specific extension, sorted by modification time
 * @param {string} directory - Directory to scan
 * @param {string} extension - File extension (e.g., '.jsonl')
 * @param {object} options - Configuration options
 * @returns {Promise<Array>} Sorted array of file info objects
 */
export async function getFilesByExtension(directory, extension, options = {}) {
	const { sortBy = 'newest', component = 'FILE_SCANNER' } = options;

	const matcher = (fileInfo) => fileInfo.name.endsWith(extension);
	const files = await scanForFiles(directory, matcher, { includeStats: true, component });

	// Sort by modification time
	if (sortBy === 'newest') {
		files.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
	} else if (sortBy === 'oldest') {
		files.sort((a, b) => (a.mtimeMs || 0) - (b.mtimeMs || 0));
	}

	return files;
}

/**
 * Find session files across project directories
 * @param {string} baseProjectsDir - Base projects directory
 * @param {string} sessionId - Session ID to find
 * @param {object} options - Configuration options
 * @returns {Promise<object|null>} Session file info if found
 */
export async function findSessionFile(baseProjectsDir, sessionId, options = {}) {
	const { component = 'SESSION_FINDER' } = options;
	const filename = `${sessionId}.jsonl`;

	try {
		const projectDirs = await readdir(baseProjectsDir, { withFileTypes: true });
		const dirPaths = projectDirs
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(baseProjectsDir, entry.name));

		const result = await findFileInDirectories(dirPaths, filename, { component });

		if (result) {
			// Extract project directory name
			const projectDirName = result.directory.split('/').pop();
			return {
				...result,
				projectDirName,
				projectsDir: baseProjectsDir,
				sessionId: sessionId
			};
		}

		return null;
	} catch (error) {
		logger.warn(component, `Failed to find session file for ${sessionId}:`, error.message);
		return null;
	}
}

/**
 * Check if a file exists in any of the project directories
 * @param {string} baseProjectsDir - Base projects directory
 * @param {string} sessionId - Session ID to check
 * @param {object} options - Configuration options
 * @returns {Promise<boolean>} True if file exists
 */
export async function sessionFileExists(baseProjectsDir, sessionId, options = {}) {
	const result = await findSessionFile(baseProjectsDir, sessionId, options);
	return result !== null;
}
