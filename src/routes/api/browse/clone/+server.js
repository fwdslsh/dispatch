import { json } from '@sveltejs/kit';
import { stat, readdir, mkdir, copyFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { constants } from 'node:fs';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

// Validate that the requested path is within allowed bounds
function isPathAllowed(requestedPath) {
	const resolved = resolve(requestedPath);

	// Only block access to truly sensitive system directories
	const blockedDirs = ['/proc', '/sys', '/dev'];
	for (const dir of blockedDirs) {
		if (resolved.startsWith(dir)) {
			return false;
		}
	}

	return true;
}

// Recursive directory copy function using promises
async function copyDirectoryRecursive(source, target) {
	// Ensure source exists and is a directory
	const sourceStat = await stat(source);
	if (!sourceStat.isDirectory()) {
		throw new Error('Source path is not a directory');
	}

	// Create target directory if it doesn't exist
	try {
		await mkdir(target, { recursive: true });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}

	// Read directory contents
	const items = await readdir(source, { withFileTypes: true });

	// Copy each item
	for (const item of items) {
		const sourcePath = join(source, item.name);
		const targetPath = join(target, item.name);

		if (item.isDirectory()) {
			// Recursively copy subdirectory
			await copyDirectoryRecursive(sourcePath, targetPath);
		} else if (item.isFile()) {
			// Copy file
			await copyFile(sourcePath, targetPath);
		}
		// Skip symbolic links and other special files for security
	}
}

export async function POST({ request }) {
	try {
		const { sourcePath, targetPath, overwrite = false } = await request.json();

		if (!sourcePath) {
			throw new BadRequestError('Source path is required', 'MISSING_SOURCE_PATH');
		}

		if (!targetPath) {
			throw new BadRequestError('Target path is required', 'MISSING_TARGET_PATH');
		}

		// Resolve and validate paths
		const resolvedSource = resolve(sourcePath);
		const resolvedTarget = resolve(targetPath);

		if (!isPathAllowed(resolvedSource)) {
			throw new ForbiddenError('Access denied to source directory');
		}

		if (!isPathAllowed(resolvedTarget)) {
			throw new ForbiddenError('Access denied to target location');
		}

		// Validate source exists and is a directory
		try {
			const sourceStat = await stat(resolvedSource);
			if (!sourceStat.isDirectory()) {
				throw new BadRequestError('Source path is not a directory', 'NOT_A_DIRECTORY');
			}
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new NotFoundError('Source directory does not exist');
			}
			throw error;
		}

		// Check if target already exists
		let targetExists = false;
		try {
			await access(resolvedTarget, constants.F_OK);
			targetExists = true;
		} catch (_error) {
			// Target doesn't exist, which is what we want
			targetExists = false;
		}

		// If target exists and overwrite is false, throw error
		if (targetExists && !overwrite) {
			throw new ConflictError('Target directory already exists');
		}

		// Validate parent directory of target exists and is writable
		const targetParent = dirname(resolvedTarget);
		try {
			await access(targetParent, constants.W_OK);
		} catch (_error) {
			throw new ForbiddenError('Target parent directory does not exist or is not writable');
		}

		// Prevent copying a directory into itself or a subdirectory
		if (resolvedTarget.startsWith(resolvedSource + '/') || resolvedTarget === resolvedSource) {
			throw new BadRequestError('Cannot copy directory into itself or its subdirectory', 'INVALID_TARGET');
		}

		// Perform the directory copy
		await copyDirectoryRecursive(resolvedSource, resolvedTarget);

		return json({
			success: true,
			sourcePath: resolvedSource,
			targetPath: resolvedTarget,
			message: 'Directory cloned successfully'
		});
	} catch (err) {
		handleApiError(err, 'POST /api/browse/clone');
	}
}
